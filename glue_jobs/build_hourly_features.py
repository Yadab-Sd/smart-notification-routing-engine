# smart-router/glue_jobs/build_hourly_features.py
import sys
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from awsglue.context import GlueContext
from awsglue.job import Job
from pyspark.sql import functions as F
from pyspark.sql.types import IntegerType

args = getResolvedOptions(sys.argv, ['JOB_NAME', 'EVENTS_BUCKET', 'CURATED_BUCKET'])
sc = SparkContext()
glueContext = GlueContext(sc)
spark = glueContext.spark_session
job = Job(glueContext)
job.init(args['JOB_NAME'], args)

events_bucket = args['EVENTS_BUCKET']
curated_bucket = args['CURATED_BUCKET']

events_path = f"s3://{events_bucket}/raw/"

# read raw JSONL (may be many small files)
df = spark.read.option("multiLine", False).json(events_path)

# normalize timestamp column name (try ts or timestamp)
if 'ts' not in df.columns and 'timestamp' in df.columns:
    df = df.withColumn('ts', F.col('timestamp'))

df = df.withColumn('ts', F.to_timestamp('ts')) \
    .withColumn('hour', F.hour('ts'))

# Example: build per-user-hour sends and clicks
sends = df.filter(F.col('type') == 'SEND').select('userId','ts','hour')
clicks = df.filter(F.col('type') == 'CLICK').select('userId','ts')

# join sends->clicks within 24h
joined = sends.alias('s').join(
    clicks.alias('c'),
    (F.col('s.userId') == F.col('c.userId')) &
    (F.col('c.ts') >= F.col('s.ts')) &
    (F.col('c.ts') <= F.expr("timestampadd(HOUR,24, s.ts)")),
    how='left'
)

labeled = joined.groupBy('s.userId','s.hour','s.ts') \
    .agg((F.count('c.ts') > 0).cast(IntegerType()).alias('label'),
         F.count('s.ts').alias('sends_count_hour')) \
    .withColumnRenamed('s.userId','userId')

# a simple rolling click_rate_7d placeholder (for demo: average label per user-hour)
features = labeled.groupBy('userId','hour').agg(
    F.avg('label').alias('click_rate_7d'),
    F.sum('sends_count_hour').alias('sends_count_hour'),
    F.max('label').alias('label')  # label: existence in window
)

# write parquet
out_path = f"s3://{curated_bucket}/features/"
features.repartition(10).write.mode('overwrite').parquet(out_path)

job.commit()
