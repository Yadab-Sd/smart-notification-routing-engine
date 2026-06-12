# Architecture Deep Dive

## System Components

### 1. Data Ingestion Layer

**Control Plane API** (Java 21 Lambda)
- REST API for event ingestion and user management
- Endpoints: `/v1/events`, `/v1/users/{id}`, `/v1/users/{id}/preferences`
- Authentication: Cognito JWT validation
- Rate limiting: API Gateway throttling (5000 req/sec)

**Kinesis Data Streams**
- Real-time event streaming
- Auto-sharding based on throughput
- 24-hour retention period
- Partition key: userId for ordered processing

**Events Consumer** (Java 21 Lambda)
- Triggered by Kinesis stream (batch size: 100)
- Writes to S3 in time-partitioned format: `s3://bucket/raw/dt=YYYY-MM-DD/h=HH/events.jsonl`
- Updates DynamoDB counters: `clicks`, `sends`, `events`
- Idempotent processing with sequence numbers

---

### 2. Machine Learning Pipeline

**AWS Glue ETL Job**
- Spark-based feature engineering
- Runs nightly at 02:00 UTC
- Workers: G.1X (4 vCPU, 16GB memory)
- Input: S3 raw events (JSONL)
- Output: S3 curated features (CSV for XGBoost)

**Feature Engineering Steps**:
1. Read events from S3 (recursive, multi-line JSON)
2. Filter by event type (CLICK, SEND)
3. Create labels: click within 24h of send = 1, else 0
4. Aggregate features:
   - `hour`: Extract hour from timestamp (0-23)
   - `click_rate_7d`: Rolling 7-day user click rate
   - `sends_count_hour`: Historical send volume per hour
5. Write CSV: `label,hour,click_rate_7d,sends_count_hour`

**SageMaker Training Job**
- Algorithm: XGBoost (binary classification)
- Instance: ml.m5.xlarge (4 vCPU, 16GB)
- Training time: 10-20 minutes
- Hyperparameters:
  - Trees: 200
  - Max depth: 6
  - Learning rate: 0.05
  - Objective: `binary:logistic`
- Output: `model.tar.gz` to S3

**Step Functions Orchestration**
- Trigger: EventBridge cron (02:00 UTC daily)
- Steps:
  1. Start Glue job (feature engineering)
  2. Wait for Glue completion
  3. Start SageMaker training
  4. Wait for training completion
  5. Deploy model to endpoint (Lambda function)
- Error handling: SNS notification on failure

**SageMaker Endpoint**
- Instance: ml.m5.large (2 vCPU, 8GB)
- Auto-scaling: Min 1, Max 3 instances
- Latency: ~45ms p50, ~95ms p99
- Model format: XGBoost binary (joblib)

---

### 3. Decision & Delivery Layer

**Decision Service** (Java 21 Lambda)
- Input: `{ userId, windowStart, windowEnd }`
- Algorithm:
  ```
  1. Fetch user profile from DynamoDB
  2. For each hour in window (0-48):
     a. Build feature vector: [hour, clickRate, sendCount]
     b. Invoke SageMaker endpoint
     c. Get probability score
  3. Select hour with highest score
  4. Create EventBridge schedule
  ```
- Output: `{ hour, probability, scheduleId }`

**EventBridge Scheduler**
- One-time schedules (not recurring)
- Precision: second-level accuracy
- Schedule format: `at(YYYY-MM-DDTHH:mm:ss)`
- Target: Sender Lambda ARN
- Payload: `{ userId }`

**Sender Service** (Java 21 Lambda)
- Triggered by EventBridge schedule
- Steps:
  1. Fetch user email from DynamoDB
  2. Load template from S3 (Handlebars format)
  3. Render template with variables
  4. Send via Pinpoint SendMessages API
- Delivery tracking: Write event to Kinesis

**Amazon Pinpoint**
- Transactional messaging only (no campaigns/segments)
- Channels: Email, SMS
- Email: Via Amazon SES integration
- SMS: Via carrier aggregators

---

### 4. Storage & State

**S3 Data Lake**
- Buckets:
  1. `events-bucket`: Raw events (JSONL, time-partitioned)
  2. `curated-bucket`: ML features (CSV), templates (Handlebars)
  3. `models-bucket`: Trained models, Glue scripts
  4. `logs-bucket`: Application logs, audit trails
  5. `artifacts-bucket`: CDK deployment artifacts
- Lifecycle policies:
  - Archive to Glacier after 90 days
  - Delete after 365 days (except models)

**DynamoDB Table** (`UserProfiles`)
- Partition key: `pk` (String) - "USER#{userId}"
- Sort key: `sk` (String) - "PROFILE"
- Attributes:
  - `email`: String (user email)
  - `counters`: Map
    - `events`: Number (total events)
    - `clicks`: Number (total clicks)
    - `sends`: Number (total sends)
  - `lastSeenAt`: String (ISO timestamp)
  - `prefs`: Map (user preferences)
- Billing: On-demand (pay per request)
- Encryption: KMS CMK

---

### 5. Security & Observability

**Amazon Cognito**
- User Pool: Email/password authentication
- App Client: JWT token generation
- Token expiry: 1 hour (access token), 30 days (refresh token)
- MFA: Optional (TOTP)

**AWS KMS**
- Customer-managed key (CMK)
- Auto-rotation: Enabled (annual)
- Key policy: Least-privilege access
- Used for:
  - S3 server-side encryption
  - DynamoDB encryption at rest
  - Kinesis stream encryption

**VPC Configuration**
- CIDR: 10.0.0.0/16
- Subnets:
  - Public: 10.0.1.0/24, 10.0.2.0/24 (2 AZs)
  - Private: 10.0.11.0/24, 10.0.12.0/24 (2 AZs)
- NAT Gateway: Public subnet (for Lambda internet access)
- VPC Endpoints:
  - S3 (Gateway endpoint)
  - DynamoDB (Gateway endpoint)
  - Kinesis (Interface endpoint)

**CloudWatch**
- Log Groups:
  - `/aws/lambda/SR-Compute-ControlPlaneFn`
  - `/aws/lambda/SR-Compute-EventsConsumerFn`
  - `/aws/lambda/SR-Compute-DecisionFn`
  - `/aws/lambda/SR-Compute-SenderFn`
  - `/aws-glue/jobs/output`
- Retention: 7 days (adjustable)
- Metrics:
  - Lambda: Invocations, Errors, Duration
  - Kinesis: IncomingRecords, IteratorAge
  - SageMaker: ModelLatency, Invocations
  - DynamoDB: ConsumedReadCapacity, ConsumedWriteCapacity

---

## Data Flow Diagrams

### Event Ingestion Flow

```
┌─────────────┐
│  User App   │
└──────┬──────┘
       │ POST /v1/events
       │ { userId, type, ts, attrs }
       ▼
┌─────────────────────┐
│   API Gateway       │
│   (JWT Validation)  │
└──────┬──────────────┘
       │
       ▼
┌──────────────────────┐
│  Control Plane       │
│  Lambda              │
│  - Validate schema   │
│  - Write to Kinesis  │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Kinesis Stream      │
│  (Buffering)         │
└──────┬───────────────┘
       │ Batch (100 records)
       ▼
┌──────────────────────┐
│  Events Consumer     │
│  Lambda              │
│  - Write to S3       │
│  - Update DynamoDB   │
└──────┬───────────────┘
       │
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌─────────────┐   ┌──────────────┐
│  S3 Bucket  │   │  DynamoDB    │
│  (raw/)     │   │  (counters)  │
└─────────────┘   └──────────────┘
```

### ML Training Flow

```
┌──────────────────┐
│  EventBridge     │
│  (02:00 UTC)     │
└────────┬─────────┘
         │ Trigger daily
         ▼
┌──────────────────┐
│  Step Functions  │
│  (Orchestrator)  │
└────────┬─────────┘
         │ Start Glue job
         ▼
┌──────────────────────────┐
│  Glue ETL Job            │
│  - Read S3 raw/          │
│  - Feature engineering   │
│  - Write features-csv/   │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│  SageMaker Training      │
│  - XGBoost binary clf    │
│  - Train on features     │
│  - Save model.tar.gz     │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│  Endpoint Deployer       │
│  Lambda                  │
│  - Create/update         │
│    SageMaker endpoint    │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│  SageMaker Endpoint      │
│  (send-time-v1)          │
│  Ready for inference     │
└──────────────────────────┘
```

### Prediction & Scheduling Flow

```
┌─────────────┐
│  User App   │
└──────┬──────┘
       │ POST /v1/decisions/schedule
       │ { userId, windowStart, windowEnd }
       ▼
┌─────────────────────┐
│  Decision Service   │
│  Lambda             │
└──────┬──────────────┘
       │
       ├──────────────────┐
       │                  │
       ▼                  ▼
┌─────────────┐   ┌────────────────┐
│  DynamoDB   │   │   SageMaker    │
│  (user      │   │   Endpoint     │
│   profile)  │   │   (predict)    │
└─────────────┘   └────────────────┘
       │                  │
       │                  │
       └────────┬─────────┘
                │ bestHour, bestScore
                ▼
┌────────────────────────────┐
│  EventBridge Scheduler     │
│  Create one-time schedule  │
│  at(YYYY-MM-DDTHH:mm:ss)   │
└────────┬───────────────────┘
         │ At scheduled time
         ▼
┌────────────────────────────┐
│  Sender Service Lambda     │
│  - Fetch user email        │
│  - Render template         │
│  - Send via Pinpoint       │
└────────┬───────────────────┘
         │
         ▼
┌────────────────────────────┐
│  Amazon Pinpoint           │
│  (Email/SMS delivery)      │
└────────────────────────────┘
```

---

## Infrastructure as Code

### CDK Stack Dependencies

```
SR-Network (VPC, subnets)
    ↓
SR-Security (KMS key)
    ↓
SR-Identity (Cognito)
    ↓
SR-Data (S3, DynamoDB, Kinesis)
    ↓
    ├─→ SR-Compute (Lambdas, API Gateway)
    │
    ├─→ SR-ML (Glue, Step Functions)
    │
    └─→ SR-Messaging (Pinpoint)
```

### Resource Naming Convention

- Stack prefix: `SR-{StackName}`
- Resources: `SR-{StackName}-{ResourceType}-{ID}`
- Example: `SR-Compute-ControlPlaneFn-ABC123`

---

## Scalability Considerations

### Kinesis Sharding Strategy

- **1 shard** = 1MB/sec write, 2MB/sec read
- **Events/sec per shard**: ~4000 (250 bytes/event)
- **Auto-scaling**: Based on iterator age (CloudWatch alarm)

### Lambda Concurrency

- **Reserved concurrency**: 100 per function (adjustable)
- **Burst limit**: 3000 (account-level)
- **SnapStart**: Enabled for Java functions (80% cold start reduction)

### DynamoDB Scaling

- **Billing mode**: On-demand (auto-scales)
- **Alternative**: Provisioned with auto-scaling (predictable traffic)
- **Global tables**: Not implemented (single-region deployment)

### SageMaker Endpoint Scaling

- **Auto-scaling policy**:
  - Min instances: 1
  - Max instances: 3
  - Target metric: `InvocationsPerInstance = 1000`
  - Scale-up cooldown: 60 seconds
  - Scale-down cooldown: 300 seconds

---

**Last Updated**: June 2026
