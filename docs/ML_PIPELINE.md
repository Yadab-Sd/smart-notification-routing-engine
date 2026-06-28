# ML Pipeline

## Overview

The ML pipeline trains an XGBoost model nightly to predict optimal notification send times.

**Flow**: Events (S3) → Glue (Feature Engineering) → SageMaker (Training) → Endpoint (Inference)

---

## Pipeline Components

### 1. Feature Engineering (AWS Glue)

**Script**: `glue-jobs/build_hourly_features.py`

**Input**: S3 raw events (`s3://events-bucket/raw/`)

**Output**: CSV features (`s3://curated-bucket/features-csv/`)

**Features Generated**:
- `hour`: Hour of day (0-23)
- `click_rate_7d`: User's 7-day click rate
- `sends_count_hour`: Historical send volume per hour

**Schedule**: Daily at 02:00 UTC by default (`ENABLE_ML_SCHEDULE=true`)

**Duration**: 10-20 minutes (depends on data volume)

**Cost**: ~$4-66/month (based on data size)

---

### 2. Model Training (SageMaker)

**Algorithm**: XGBoost binary classification

**Hyperparameters**:
```python
{
  'num_round': 200,
  'max_depth': 6,
  'learning_rate': 0.05,
  'objective': 'binary:logistic',
  'eval_metric': 'auc'
}
```

**Instance**: ml.c5.xlarge (4 vCPU, 8GB RAM)

**Training Time**: 10-15 minutes

**Output**: Model artifact (`s3://models-bucket/model.tar.gz`)

---

### 3. Model Deployment

**Endpoint**: `send-time-v1`

**Instance**: ml.m5.large (2 vCPU, 8GB RAM)

**Auto-scaling**:
- Min instances: 1
- Max instances: 3
- Target: 1000 invocations/instance

---

### 4. Inference (Decision Lambda)

**Input**: User profile + prediction window

**Process**:
1. Fetch user click rate from DynamoDB
2. For each hour in window:
   - Build feature vector
   - Call SageMaker endpoint
   - Get probability score
3. Select hour with highest score

**Latency**: Not guaranteed. Measure p50/p95/p99 in the adopter's own AWS
account after deployment, because endpoint type, traffic, region, quotas, and
model size affect performance.

---

## Feature Engineering Details

### Data Processing Steps

**Glue Script** (`build_hourly_features.py`):

```python
# 1. Read raw events from S3
df = spark.read.json(f"s3://{events_bucket}/raw/")

# 2. Extract timestamp features
df = df.withColumn('hour', F.hour('ts'))

# 3. Separate sends and clicks
sends = df.filter(F.col('type') == 'SEND')
clicks = df.filter(F.col('type') == 'CLICK')

# 4. Create labels (click within 24h of send)
labeled = sends.join(clicks, 
    (sends.userId == clicks.userId) & 
    (clicks.ts.between(sends.ts, sends.ts + interval_24h)),
    'left'
).withColumn('label', when(clicks.ts.isNotNull(), 1).otherwise(0))

# 5. Calculate user click rate (7-day window)
click_rate = clicks.groupBy('userId')\
    .agg((count('*') / 7).alias('click_rate_7d'))

# 6. Calculate send volume per hour
sends_per_hour = sends.groupBy('hour')\
    .agg(count('*').alias('sends_count_hour'))

# 7. Join features
features = labeled.join(click_rate, 'userId')\
    .join(sends_per_hour, 'hour')

# 8. Write CSV for XGBoost
features.select('label', 'hour', 'click_rate_7d', 'sends_count_hour')\
    .write.csv(f"s3://{curated_bucket}/features-csv/")
```

---

## Training Pipeline Orchestration

**Step Functions State Machine**:

```json
{
  "StartAt": "StartGlueJob",
  "States": {
    "StartGlueJob": {
      "Type": "Task",
      "Resource": "arn:aws:states:::glue:startJobRun.sync",
      "Parameters": {
        "JobName": "FeatureEngineeringJob"
      },
      "Next": "StartSageMakerTraining"
    },
    "StartSageMakerTraining": {
      "Type": "Task",
      "Resource": "arn:aws:states:::sagemaker:createTrainingJob.sync",
      "Parameters": {
        "TrainingJobName.$": "$$.Execution.Name",
        "AlgorithmSpecification": {
          "TrainingImage": "xgboost:latest",
          "TrainingInputMode": "File"
        }
      },
      "Next": "DeployModel"
    },
    "DeployModel": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:*:*:function:EndpointDeployer",
      "End": true
    }
  }
}
```

---

## Manual Trigger

**Trigger pipeline manually**:

```bash
# Get state machine ARN
STATE_MACHINE_ARN=$(aws cloudformation describe-stacks \
  --stack-name SR-ML \
  --query "Stacks[0].Outputs[?OutputKey=='TrainingPipelineArn'].OutputValue" \
  --output text)

# Start execution
aws stepfunctions start-execution \
  --state-machine-arn $STATE_MACHINE_ARN \
  --name "manual-$(date +%s)"

# Monitor execution
aws stepfunctions describe-execution \
  --execution-arn $EXECUTION_ARN
```

---

## Model Performance Metrics

No production model-performance metrics are claimed yet. AUC, precision,
recall, lift, and engagement impact must be measured from each adopter's own
training data and pilot outcomes.

Recommended pilot reporting:
- Baseline send-time policy
- Model or heuristic policy used
- Sample size and observation window
- Engagement, unsubscribe, complaint, bounce, and defer rates
- Confidence notes and known data limitations

---

## Data Requirements

**Minimum data for training**:
- 10,000+ events (SEND + CLICK)
- 1,000+ users
- 7+ days of historical data

**Insufficient data**: Pipeline will log warning and skip training

Decision Service remains available if the SageMaker endpoint is missing or the nightly pipeline fails. In that case `/v1/decisions/preview` and `/v1/decisions/schedule` return `modelSource: "FALLBACK_HEURISTIC"` and `modelConfidence: "LOW_STARTUP_ESTIMATE"`. The returned scores are startup timing estimates, not trained click predictions, until `send-time-v1` is available.

---

## Troubleshooting

### Error: "No events found"

**Cause**: S3 bucket empty

**Solution**: Ingest events via API first
```bash
curl -X POST $API_URL/v1/events \
  -d '{"userId":"test","type":"SEND","ts":"..."}'
```

### Error: "Model training failed"

**Check CloudWatch logs**:
```bash
aws logs tail /aws/sagemaker/TrainingJobs --follow
```

**Common issues**:
- Insufficient data (< 1000 records)
- Invalid CSV format
- S3 permissions

---

## Cost Optimization

**Reduce costs**:
1. **Skip training if no new data**:
   - Check event count before starting
   - Only train if >1000 new events

2. **Scale instance based on data size**:
   - ml.m5.large for <10M events (default)
   - ml.m5.xlarge for 10-50M events (requires quota increase)
   - ml.m5.2xlarge for >50M events (requires quota increase)

3. **Serverless inference**:
   - Evaluate when traffic is intermittent or still in pilot
   - Compare current AWS pricing and quota availability before enabling

---

## Future Improvements

**Planned features**:
- Online learning (incremental updates)
- More features (timezone, day of week, device)
- A/B testing framework
- Model performance tracking
- Automatic retraining on drift

---

**Last Updated**: June 2026
