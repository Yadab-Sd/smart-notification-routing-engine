# smart-router/glue-jobs/build_hourly_features.py
import sys
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from awsglue.context import GlueContext
from awsglue.job import Job
from pyspark.sql import functions as F
from pyspark.sql.types import IntegerType, DoubleType, TimestampType

args = getResolvedOptions(sys.argv, ['JOB_NAME', 'EVENTS_BUCKET', 'CURATED_BUCKET'])
sc = SparkContext()
glueContext = GlueContext(sc)
spark = glueContext.spark_session
job = Job(glueContext)
job.init(args['JOB_NAME'], args)

events_bucket = args['EVENTS_BUCKET']
curated_bucket = args['CURATED_BUCKET']

# Debug: Print bucket names
print(f"EVENTS_BUCKET argument: '{events_bucket}'")
print(f"CURATED_BUCKET argument: '{curated_bucket}'")

if not events_bucket or not curated_bucket:
    raise ValueError(f"Bucket names not provided. EVENTS_BUCKET='{events_bucket}', CURATED_BUCKET='{curated_bucket}'. Check Glue job DefaultArguments.")

events_path = f"s3://{events_bucket}/raw/"
out_path = f"s3://{curated_bucket}/features-csv/"  # <-- CSV for XGBoost

print(f"Events path: {events_path}")
print(f"Output path: {out_path}")

spark._jsc.hadoopConfiguration().set("mapreduce.fileoutputcommitter.marksuccessfuljobs", "false") # not to create empty csv

# Try to read events - if path doesn't exist or is empty, catch the exception
print(f"Attempting to read events from {events_path}")
try:
    # Read JSON files recursively, ignoring partition directories
    df = spark.read.option("multiLine", False) \
        .option("recursiveFileLookup", "true") \
        .json(events_path)

    # Debug: Print schema and sample data
    print(f"Schema from {events_path}:")
    df.printSchema()
    print("Sample rows:")
    df.show(5, truncate=False)
    print(f"Total records: {df.count()}")

    if df.count() == 0:
        error_msg = f"No events found in {events_path}. Please ingest events via /v1/events API before running the ML pipeline."
        print(f"ERROR: {error_msg}")
        job.commit()
        raise ValueError(error_msg)

    # Check if _corrupt_record exists (indicates JSON parsing issues)
    if '_corrupt_record' in df.columns:
        print("WARNING: Found _corrupt_record column. Some JSON records are malformed.")
        df.filter(F.col('_corrupt_record').isNotNull()).show(10, truncate=False)
        error_msg = "JSON parsing errors detected. Events are not in valid JSONL format. Check the event format in S3."
        print(f"ERROR: {error_msg}")
        job.commit()
        raise ValueError(error_msg)

except ValueError as e:
    # Re-raise ValueError exceptions (our custom errors)
    raise e
except Exception as e:
    error_str = str(e)
    # Check for specific error patterns
    if "Path does not exist" in error_str or "No such file or directory" in error_str:
        error_msg = f"Events path {events_path} does not exist. No events have been ingested yet. Please send events via /v1/events API endpoint first, then retry the pipeline."
    elif "Access Denied" in error_str or "AccessDenied" in error_str:
        error_msg = f"Access denied reading from {events_path}. Check IAM permissions for Glue role."
    else:
        error_msg = f"Error reading from {events_path}: {error_str}. Please check S3 permissions and data format."

    print(f"ERROR: {error_msg}")
    job.commit()
    raise ValueError(error_msg)

# Normalize timestamp column
if 'ts' not in df.columns and 'timestamp' in df.columns:
    df = df.withColumn('ts', F.col('timestamp'))
df = df.withColumn('ts', F.col('ts').cast(TimestampType())) \
    .withColumn('hour', F.hour('ts'))

print(f"Total events after timestamp parsing: {df.count()}")
print("Event types distribution:")
df.groupBy('type').count().show()

# Build sends/clicks
sends = df.filter(F.col('type') == 'PLAY_MOVIE').select('userId', 'ts', 'hour')
clicks = df.filter(F.col('type') == 'CLICK').select('userId', 'ts')

print(f"PLAY_MOVIE events: {sends.count()}")
print(f"CLICK events: {clicks.count()}")

if sends.count() == 0:
    print("WARNING: No PLAY_MOVIE events found. Using all events as sends.")
    sends = df.select('userId', 'ts', 'hour')

if clicks.count() == 0:
    print("WARNING: No CLICK events found. Creating synthetic clicks from all events.")
    clicks = df.select('userId', 'ts')

# Join sends with clicks in next 24h
joined = sends.alias('s').join(
    clicks.alias('c'),
    (F.col('s.userId') == F.col('c.userId')) &
    (F.col('c.ts') >= F.col('s.ts')) &
    (F.col('c.ts') <= F.expr("s.ts + INTERVAL 24 HOURS")),
    how='left'
)

print(f"Joined records: {joined.count()}")
joined.show(5)

labeled = (joined
           .groupBy('s.userId', 's.hour', 's.ts')
           .agg(
    (F.count('c.ts') > 0).cast(IntegerType()).alias('label'),
    F.count('s.ts').alias('sends_count_hour')
)
           .withColumnRenamed('s.userId', 'userId')
           )

print(f"Labeled records: {labeled.count()}")
labeled.show(5)

# Aggregate to features per user-hour
features = (labeled
.groupBy('userId', 'hour')
.agg(
    F.avg('label').alias('click_rate_7d'),
    F.sum('sends_count_hour').alias('sends_count_hour'),
    F.max('label').alias('label')  # binary label proxy
)
)

print(f"Feature records: {features.count()}")
features.show(10)

# ⚠️ XGBoost algorithm mode requirements:
#  - Drop non-numeric ID cols (userId) or encode them. Here we drop it.
#  - Label first column
#  - Cast to numeric types and fill null/NaN
final_df = (features
            .select(
    F.col('label').cast(IntegerType()).alias('label'),
    F.col('hour').cast(IntegerType()).alias('hour'),
    F.col('click_rate_7d').cast(DoubleType()).alias('click_rate_7d'),
    F.col('sends_count_hour').cast(IntegerType()).alias('sends_count_hour')
)
            .na.fill({'click_rate_7d': 0.0, 'sends_count_hour': 0, 'hour': 0, 'label': 0})
            )

print(f"Final dataframe schema:")
final_df.printSchema()
print(f"Final dataframe count: {final_df.count()}")

if final_df.count() == 0:
    error_msg = """
    No training data generated. Possible reasons:
    1. Not enough events ingested (need both PLAY_MOVIE and CLICK events)
    2. Events don't have matching userIds
    3. Timestamps are in the wrong format or outside 24h window
    Please ingest more events via /v1/events endpoint and retry.
    """
    print(f"ERROR: {error_msg}")
    job.commit()
    raise ValueError(error_msg)  # ← Raise exception instead of sys.exit

# Write CSV suitable for XGBoost:
#  - No header
#  - Uncompressed (CompressionType.NONE in training job)


# write to a dedicated train/ prefix and force a single part file
print(f"Writing {final_df.count()} rows to {out_path}")
final_df.show(10)

(final_df
 .coalesce(1)  # <- single file so the first file surely has data
 .write
 .mode('overwrite')
 .option('header', 'false')
 .option('quote', '\u0000')   # disable quoting
 .option('escape', '\u0000')  # disable escaping
 .csv(out_path))

print(f"Successfully wrote CSV files to {out_path}")
print("Verify files at: aws s3 ls " + out_path + " --recursive")

job.commit()
