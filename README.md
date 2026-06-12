<div align="center">

# Smart Notification Routing Engine

**ML-Powered Notification Delivery Optimization**

[![AWS](https://img.shields.io/badge/AWS-Cloud%20Native-orange?logo=amazon-aws)](https://aws.amazon.com/)
[![Java](https://img.shields.io/badge/Java-21-blue?logo=openjdk)](https://openjdk.org/)
[![Python](https://img.shields.io/badge/Python-3.10-green?logo=python)](https://www.python.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Technical Deep Dive](#technical-deep-dive)
- [Development Workflow](#development-workflow)
- [Configuration](#configuration)
- [Monitoring & Operations](#monitoring--operations)
- [Security](#security)
- [Performance Benchmarks](#performance-benchmarks)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

A production-grade notification routing engine that uses machine learning to optimize message delivery timing. Instead of sending notifications at fixed times, this system learns when individual users are most likely to engage and schedules accordingly.

Built entirely on AWS serverless architecture, the system processes millions of events, trains ML models nightly, and serves real-time predictions with sub-second latency.

### Key Capabilities

- **ML-Driven Send-Time Optimization**: XGBoost models predict optimal delivery windows per user
- **Real-Time Feature Engineering**: Apache Spark ETL pipelines transform raw events into ML features
- **Sub-Second Inference**: SageMaker endpoints serve predictions with <100ms p99 latency
- **Event-Driven Architecture**: Fully decoupled microservices using Kinesis and EventBridge
- **Enterprise Security**: KMS encryption, VPC isolation, Cognito authentication, IAM least-privilege
- **Scalable Data Lake**: S3-based architecture handling 10M+ events/day with efficient partitioning
- **Multi-Channel Support**: Unified delivery via Amazon Pinpoint (Email, SMS, Push)
- **Infrastructure as Code**: Complete AWS CDK deployment with modular stack architecture

---

## Architecture

![Architecture Diagram](https://raw.githubusercontent.com/Yadab-Sd/my-profile/main/public/blog/ml-notification-router/notification-architecture.svg)

### System Components

#### 1. Data Ingestion Layer
- **Control Plane API** (Java 21 Lambda): REST API for event ingestion and user management
- **Kinesis Data Streams**: Real-time event streaming with automatic sharding
- **Events Consumer** (Java 21 Lambda): Stream processor writing to S3 data lake and DynamoDB

#### 2. Machine Learning Pipeline
- **AWS Glue ETL**: Nightly Spark jobs for feature engineering (10M+ rows/day)
- **SageMaker Training**: Automated XGBoost model training with hyperparameter tuning
- **SageMaker Endpoints**: Real-time inference infrastructure with auto-scaling
- **Step Functions**: Orchestrated ML pipeline (Extract → Transform → Train → Deploy)

#### 3. Decision & Delivery Layer
- **Decision Service** (Java 21 Lambda): ML-powered send-time optimization engine
- **EventBridge Scheduler**: Precise notification scheduling (second-level accuracy)
- **Sender Service** (Java 21 Lambda): Template rendering and multi-channel delivery
- **Amazon Pinpoint**: Transactional messaging API for email/SMS delivery

#### 4. Storage & State
- **S3 Data Lake**: Time-partitioned raw events, curated features, trained models
- **DynamoDB**: User profiles, preferences, engagement counters (sub-10ms reads)
- **Model Registry**: Versioned model artifacts with performance metrics

#### 5. Security & Observability
- **Amazon Cognito**: JWT-based authentication with OAuth 2.0 flows
- **AWS KMS**: Customer-managed encryption keys (CMKs) for all data at rest
- **VPC with Private Subnets**: Network isolation with interface endpoints
- **CloudWatch**: Centralized logging, metrics, and distributed tracing

---

## Getting Started

### Quick Start (Automated Setup)

```bash
# Clone repository
git clone https://github.com/Yadab-Sd/smart-notification-routing-engine.git
cd smart-notification-routing-engine

# Run one-click setup (installs all dependencies)
./scripts/setup.sh
```

This script automatically installs:
- AWS CLI v2
- Node.js 18+ and pnpm
- Java 21 (OpenJDK)
- Maven 3.9+
- AWS CDK 2.x

Then configures AWS credentials, bootstraps CDK, and builds all Lambda services.

### Configure and Deploy

```bash
cd infra/cdk

# Set up environment configuration
cp .env.example .env
nano .env  # Set SENDER_EMAIL to your verified email

# Install CDK dependencies
pnpm install

# Deploy all infrastructure
pnpm exec cdk deploy --all
```

Deployment takes 10-15 minutes. The system will create 8 CloudFormation stacks.

### Manual Setup (If Preferred)

<details>
<summary>Click to expand detailed manual setup instructions</summary>

#### Prerequisites

**System Requirements**:
- AWS account with programmatic access
- Node.js 18+ and pnpm
- Java 21 (OpenJDK)
- Maven 3.9+
- AWS CLI v2
- AWS CDK 2.x

#### Install Tools

**macOS**:
```bash
brew install awscli node@18 openjdk@21 maven
npm install -g pnpm aws-cdk
```

**Linux**:
```bash
# AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Node.js via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
npm install -g pnpm aws-cdk

# Java and Maven
sudo apt-get update
sudo apt-get install -y openjdk-21-jdk maven
```

#### Configure AWS

```bash
# Set up credentials
aws configure
# Enter: Access Key, Secret Key, Region (e.g., us-west-2)

# Bootstrap CDK
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
cdk bootstrap aws://${ACCOUNT_ID}/us-west-2
```

#### Build and Deploy

```bash
# Build Lambda services
./scripts/build-services.sh

# Install CDK dependencies
cd infra/cdk
pnpm install

# Configure sender email
cp .env.example .env
nano .env  # Set SENDER_EMAIL

# Deploy infrastructure
pnpm exec cdk deploy --all
```

</details>

### What Gets Deployed

The CDK creates 8 modular stacks:

| Stack | Purpose | Key Resources |
|-------|---------|---------------|
| **SR-Network** | VPC & Connectivity | VPC (2 AZs), NAT Gateway, VPC Endpoints |
| **SR-Security** | Encryption | KMS CMK with auto-rotation |
| **SR-Identity** | Authentication | Cognito User Pool, JWT Authorizer |
| **SR-Data** | Storage Layer | S3 (5 buckets), DynamoDB, Kinesis Stream |
| **SR-Compute** | Application Logic | 4 Lambda functions, API Gateway V2 |
| **SR-ML** | Training Pipeline | Glue Job, Step Functions, SageMaker Training |
| **SR-Messaging** | Delivery Layer | Pinpoint App (transactional only) |
| **SR-SageMaker** | Inference | SageMaker Endpoint (deployed after first training) |

### Post-Deployment Setup

#### 1. Verify Email in Amazon SES

```bash
SENDER_EMAIL=$(grep SENDER_EMAIL infra/cdk/.env | cut -d'=' -f2)

# Verify email identity
aws sesv2 create-email-identity \
    --email-identity ${SENDER_EMAIL} \
    --region us-west-2

# Check verification status (should show VERIFIED after clicking email link)
aws sesv2 get-email-identity \
    --email-identity ${SENDER_EMAIL} \
    --region us-west-2 \
    --query 'VerifiedForSendingStatus'
```

#### 2. Create Test User

```bash
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name SR-Identity --region us-west-2 \
    --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)

CLIENT_ID=$(aws cloudformation describe-stacks --stack-name SR-Identity --region us-west-2 \
    --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" --output text)

# Create user
aws cognito-idp admin-create-user \
    --user-pool-id ${USER_POOL_ID} \
    --username testuser@example.com \
    --user-attributes Name=email,Value=testuser@example.com Name=email_verified,Value=true \
    --temporary-password TempPass123! \
    --region us-west-2

# Set permanent password
aws cognito-idp admin-set-user-password \
    --user-pool-id ${USER_POOL_ID} \
    --username testuser@example.com \
    --password SecurePass123! \
    --permanent \
    --region us-west-2
```

#### 3. Get Authentication Token

```bash
JWT_TOKEN=$(aws cognito-idp initiate-auth \
    --auth-flow USER_PASSWORD_AUTH \
    --client-id ${CLIENT_ID} \
    --auth-parameters USERNAME=testuser@example.com,PASSWORD=SecurePass123! \
    --region us-west-2 \
    --query 'AuthenticationResult.IdToken' \
    --output text)

echo "Token: ${JWT_TOKEN:0:20}..."
```

#### 4. Test the API

```bash
API_URL=$(aws cloudformation describe-stacks --stack-name SR-Compute --region us-west-2 \
    --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)

# Health check
curl $API_URL/v1/health

# Ingest sample events
curl -X POST ${API_URL}/v1/events \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_001",
    "type": "PLAY_MOVIE",
    "ts": "2026-06-12T10:30:00Z",
    "attrs": {"device": "mobile"}
  }'
```

#### 5. Run ML Pipeline

```bash
# Get models bucket
MODELS_BUCKET=$(aws cloudformation describe-stacks --stack-name SR-Data --region us-west-2 \
    --query "Stacks[0].Outputs[?OutputKey=='ModelsBucketName'].OutputValue" --output text)

# Upload Glue script
aws s3 cp glue-jobs/build_hourly_features.py s3://${MODELS_BUCKET}/scripts/

# Trigger pipeline
EXECUTION_ARN=$(aws stepfunctions start-execution \
    --state-machine-arn arn:aws:states:us-west-2:${ACCOUNT_ID}:stateMachine:SR-ML-Pipeline \
    --region us-west-2 \
    --input '{}' \
    --query 'executionArn' --output text)

echo "Pipeline started: $EXECUTION_ARN"

# Monitor execution
aws stepfunctions describe-execution \
    --execution-arn $EXECUTION_ARN \
    --query '{Status:status,StartDate:startDate}'
```

The ML pipeline takes 20-45 minutes:
- Glue job: 5-15 minutes (feature engineering)
- SageMaker training: 10-20 minutes (XGBoost)
- Endpoint deployment: 5-10 minutes (automatic)

---

## Technical Deep Dive

### Machine Learning Formulation

#### Problem Statement
Given a user profile and notification payload, predict the optimal send time (hour 0-23) with maximum engagement probability.

#### Model Architecture

**Send-Time Prediction Model**:
```
Algorithm: XGBoost Binary Classifier
Objective: Predict P(click | send at hour H)
Features: [hour, click_rate_7d, sends_count_hour]
Label: Binary (clicked within 24 hours)
Training: Nightly on historical data
Validation: AUC-PR > 0.75 threshold
```

**Current Feature Set**:
- `hour`: Hour of day (0-23)
- `click_rate_7d`: User's 7-day click rate
- `sends_count_hour`: Historical send volume for that hour

**Planned Enhancements**:
- Timezone normalization
- Day of week patterns
- Device type (mobile/desktop)
- Content category
- Channel preference
- Contextual signals

#### Training Pipeline

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│ Raw Events  │────▶│ Glue ETL Job │────▶│  SageMaker  │────▶│   Model      │
│ (S3 JSONL)  │     │ (Spark)      │     │  Training   │     │  Registry    │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
                           │                      │                   │
                           ▼                      ▼                   ▼
                    Features CSV            model.tar.gz        Versioned
                    (XGBoost format)        (joblib)            Endpoint
```

**Orchestration**: EventBridge triggers Step Functions at 02:00 UTC daily

**Feature Engineering** (Glue/Spark):
- Window-based aggregations (7-day rolling click rate)
- Time-based features (hour extraction from timestamps)
- User-hour level aggregations (send count per hour)
- Label creation (click within 24h = 1, else 0)

**Model Evaluation**:
- **Offline**: Holdout validation (80/20 split), AUC-PR, calibration curves
- **Online**: A/B testing with uplift measurement (planned)

### Infrastructure Architecture

#### Data Flow

**Ingestion Path**:
```
User Event → API Gateway → Control Plane Lambda → Kinesis Stream
                                                        ↓
                                            Events Consumer Lambda
                                                    ↓       ↓
                                              S3 (raw/)  DynamoDB (profiles)
```

**ML Inference Path**:
```
Schedule Request → Decision Service Lambda → SageMaker Endpoint
                                                    ↓
                                        EventBridge Scheduler
                                                    ↓
                                        Sender Service Lambda → Pinpoint
```

**Feature Engineering Path**:
```
EventBridge (02:00 UTC) → Step Functions → Glue Job (Spark)
                                              ↓
                                        S3 (features-csv/)
                                              ↓
                                        SageMaker Training
                                              ↓
                                        S3 (models/send_time/v1/)
                                              ↓
                                        Endpoint Deployer Lambda
```

#### Code Architecture

**Microservices Design**:

1. **Control Plane Service** (`/services/control-plane`)
   - Language: Java 21 (GraalVM-optimized)
   - Framework: AWS SDK v2 (async)
   - Responsibilities: Event ingestion, user CRUD, health checks

2. **Events Consumer** (`/services/events-consumer`)
   - Pattern: Lambda + Kinesis Event Source Mapping
   - Batch: Up to 100 records/batch
   - Operations: S3 writes (time-partitioned), DynamoDB updates

3. **Decision Service** (`/services/decision-service`)
   - Core Algorithm:
   ```java
   for (int hour = 0; hour < 48; hour++) {
       InvokeEndpointResponse response = sagemakerClient.invokeEndpoint(
           builder -> builder.endpointName("send-time-v1")
               .body(SdkBytes.fromUtf8String(buildFeatures(user, hour)))
       );
       double probability = parseScore(response);
       if (probability > bestScore) {
           bestHour = hour;
           bestScore = probability;
       }
   }
   ```
   - Integration: Creates EventBridge schedules for future execution

4. **Sender Service** (`/services/sender-service`)
   - Template Engine: Handlebars for dynamic content
   - Channel Abstraction: Unified Pinpoint API
   - Features: Variable substitution, delivery tracking

---

## Development Workflow

### Making Code Changes

#### Lambda Function Changes

```bash
# Edit code in services/control-plane/src/main/java/...

# Rebuild
./scripts/build-services.sh

# Redeploy
cd infra/cdk
pnpm exec cdk deploy SR-Compute
```

#### Infrastructure Changes

```bash
# Edit infra/cdk/lib/compute-stack.ts

cd infra/cdk
pnpm exec cdk synth  # Validate
pnpm exec cdk diff SR-Compute  # Preview changes
pnpm exec cdk deploy SR-Compute
```

#### Glue Script Updates

```bash
# Edit glue-jobs/build_hourly_features.py

MODELS_BUCKET=$(aws cloudformation describe-stacks --stack-name SR-Data --region us-west-2 \
    --query "Stacks[0].Outputs[?OutputKey=='ModelsBucketName'].OutputValue" --output text)

aws s3 cp glue-jobs/build_hourly_features.py s3://${MODELS_BUCKET}/scripts/

# Trigger pipeline to test
aws stepfunctions start-execution \
    --state-machine-arn arn:aws:states:us-west-2:${ACCOUNT_ID}:stateMachine:SR-ML-Pipeline \
    --region us-west-2 \
    --input '{}'
```

### Testing Locally

```bash
# Run Java unit tests
cd services/control-plane
mvn test

# Test CDK synthesis
cd infra/cdk
pnpm exec cdk synth

# Check differences without deploying
pnpm exec cdk diff SR-Compute
```

### Rollback Strategy

```bash
# Option 1: AWS Console
# CloudFormation → Select Stack → Actions → Roll back

# Option 2: Git revert
git checkout <previous-commit>
./scripts/build-services.sh
cd infra/cdk && pnpm exec cdk deploy SR-Compute
```

### Cleaning Up

```bash
cd infra/cdk

# Destroy stacks in reverse order
pnpm exec cdk destroy SR-SageMaker
pnpm exec cdk destroy SR-Messaging
pnpm exec cdk destroy SR-ML
pnpm exec cdk destroy SR-Compute
pnpm exec cdk destroy SR-Data
pnpm exec cdk destroy SR-Identity
pnpm exec cdk destroy SR-Security
pnpm exec cdk destroy SR-Network
```

---

## Configuration

### Environment Variables

Primary config file: `infra/cdk/.env`

```bash
SENDER_EMAIL=notifications@yourdomain.com
```

Lambda environment variables (auto-configured by CDK):
- `EVENTS_STREAM_NAME`: Kinesis stream
- `USER_PROFILES_TABLE`: DynamoDB table
- `SAGEMAKER_ENDPOINT`: ML endpoint
- `PINPOINT_APP_ID`: Messaging application
- `CURATED_BUCKET`: S3 bucket for templates
- `DEFAULT_FROM_ADDRESS`: Sender email

### Model Hyperparameters

Edit `infra/cdk/lib/ml-stack.ts`:

```typescript
hyperparameters: {
  num_round: '200',              // Boosting rounds
  max_depth: '6',                // Tree depth
  eta: '0.05',                   // Learning rate
  objective: 'binary:logistic',  // Loss function
  eval_metric: 'auc',            // Validation metric
  subsample: '0.8',              // Row sampling
  colsample_bytree: '0.8'        // Feature sampling
}
```

---

## Monitoring & Operations

### Key Metrics

**Application Metrics** (CloudWatch):
- `IngestedEvents`: Events received (events/sec)
- `InferenceLatency`: SageMaker p50/p99 latency
- `ScheduledNotifications`: EventBridge schedules created
- `DeliveryRate`: Pinpoint successful deliveries

**ML Metrics** (SageMaker):
- `train:auc`: Training AUC-ROC
- `validation:auc`: Validation AUC-ROC
- `validation:ap`: Average Precision

### Logging

View logs:
```bash
# Control Plane
aws logs tail /aws/lambda/SR-Compute-ControlPlaneFn --follow --region us-west-2

# Decision Service
aws logs tail /aws/lambda/SR-Compute-DecisionFn --follow --region us-west-2

# Sender Service
aws logs tail /aws/lambda/SR-Compute-SenderFn --follow --region us-west-2

# Glue Job
aws logs tail /aws-glue/jobs/output --follow --region us-west-2
```

Structured logging format:
```json
{
  "timestamp": "2026-06-12T10:30:45Z",
  "level": "INFO",
  "requestId": "abc-123-def-456",
  "userId": "user_001",
  "operation": "PREDICT_SEND_TIME",
  "latency_ms": 87,
  "prediction": {"hour": 14, "confidence": 0.83}
}
```

---

## Security

### Authentication & Authorization

- **Cognito User Pools**: JWT tokens with 1-hour expiry
- **API Gateway Authorizer**: Validates JWT signature and claims
- **IAM Policies**: Least-privilege service roles

### Encryption

- **At Rest**: KMS CMK with automatic 1-year rotation
  - S3: SSE-KMS
  - DynamoDB: KMS encryption
  - Kinesis: Server-side encryption
- **In Transit**: TLS 1.3 for all HTTPS endpoints
- **Secrets**: AWS Secrets Manager for API keys

### Network Security

- **VPC Isolation**: Lambda functions in private subnets
- **No Internet Egress**: AWS service access via VPC endpoints
- **Security Groups**: Deny-by-default with explicit allow rules

---

## Performance Benchmarks

### Target Performance

| Metric | Target | Implementation |
|--------|--------|----------------|
| **Event Ingestion** | 10,000 req/sec | Kinesis auto-sharding |
| **API Throughput** | 5,000 req/sec | Lambda reserved concurrency |
| **ML Inference** | <100ms p99 | SageMaker endpoint warm pools |
| **Feature Processing** | 50M rows/hour | Glue configurable workers |
| **Daily Events** | 10M+ | S3 data lake |

### Cost Optimization

- **Lambda SnapStart**: 80% cold start reduction
- **VPC Endpoints**: Eliminate NAT Gateway data transfer costs
- **S3 Intelligent-Tiering**: Automatic archival (50% cost reduction)
- **SageMaker Serverless**: Pay-per-invocation for low traffic
- **Spot Instances**: 70% savings for training jobs

---

## Contributing

Pull requests welcome. Areas needing work:
- Enhanced ML features (timezone, day of week, device type)
- Multi-channel optimization
- Cold-start handling improvements
- Documentation
- Client libraries (Node.js, Python, Go)

Please follow existing code style. Run tests before submitting PR.

---

## License

MIT License

```
Copyright (c) 2025 Yadab Sutradhar

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Contact & Support

**Yadab Sutradhar**
- Email: yadab.sd2013@gmail.com
- LinkedIn: [linkedin.com/in/yadab-sutradhar](https://www.linkedin.com/in/yadab-sutradhar)
- GitHub: [@Yadab-Sd](https://github.com/Yadab-Sd)

**Support Channels**:
- Issues: [GitHub Issues](https://github.com/Yadab-Sd/smart-notification-routing-engine/issues)
- Discussions: [GitHub Discussions](https://github.com/Yadab-Sd/smart-notification-routing-engine/discussions)

---

## Citation

```bibtex
@software{sutradhar2025notification,
  author = {Sutradhar, Yadab},
  title = {Smart Notification Routing Engine: ML-Powered Delivery Optimization},
  year = {2025},
  url = {https://github.com/Yadab-Sd/smart-notification-routing-engine}
}
```

---

**Built by [Yadab Sutradhar](https://www.linkedin.com/in/yadab-sutradhar)**

*Last updated: June 2026*
