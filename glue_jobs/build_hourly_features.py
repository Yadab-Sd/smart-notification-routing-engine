# smart-router/glue_jobs/build_hourly_features.py
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

events_path = f"s3://{events_bucket}/raw/"
out_path = f"s3://{curated_bucket}/features-csv/"  # <-- CSV for XGBoost

spark._jsc.hadoopConfiguration().set("mapreduce.fileoutputcommitter.marksuccessfuljobs", "false") # not to create empty csv

# Read raw JSONL
df = spark.read.option("multiLine", False).json(events_path)

# Normalize timestamp column
if 'ts' not in df.columns and 'timestamp' in df.columns:
    df = df.withColumn('ts', F.col('timestamp'))
df = df.withColumn('ts', F.col('ts').cast(TimestampType())) \
    .withColumn('hour', F.hour('ts'))

# Build sends/clicks
sends = df.filter(F.col('type') == 'PLAY_MOVIE').select('userId', 'ts', 'hour')
clicks = df.filter(F.col('type') == 'CLICK').select('userId', 'ts') # TODO: Change to CLICK, payload of event - type field

# Join sends with clicks in next 24h
joined = sends.alias('s').join(
    clicks.alias('c'),
    (F.col('s.userId') == F.col('c.userId')) &
    (F.col('c.ts') >= F.col('s.ts')) &
    (F.col('c.ts') <= F.expr("s.ts + INTERVAL 24 HOURS")),
    how='left'
)

labeled = (joined
           .groupBy('s.userId', 's.hour', 's.ts')
           .agg(
    (F.count('c.ts') > 0).cast(IntegerType()).alias('label'),
    F.count('s.ts').alias('sends_count_hour')
)
           .withColumnRenamed('s.userId', 'userId')
           )

# Aggregate to features per user-hour
features = (labeled
.groupBy('userId', 'hour')
.agg(
    F.avg('label').alias('click_rate_7d'),
    F.sum('sends_count_hour').alias('sends_count_hour'),
    F.max('label').alias('label')  # binary label proxy
)
)

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

# Write CSV suitable for XGBoost:
#  - No header
#  - Uncompressed (CompressionType.NONE in training job)


# write to a dedicated train/ prefix and force a single part file
(final_df
 .coalesce(1)  # <- single file so the first file surely has data
 .write
 .mode('overwrite')
 .option('header', 'false')
 .option('quote', '\u0000')   # disable quoting
 .option('escape', '\u0000')  # disable escaping
 .csv(out_path))

job.commit()
