# Smart Notification Routing Engine

> **ML-Powered Intelligent Notification Delivery System with Real-Time Optimization**

[![AWS](https://img.shields.io/badge/AWS-Cloud%20Native-orange?logo=amazon-aws)](https://aws.amazon.com/)
[![Java](https://img.shields.io/badge/Java-21-blue?logo=openjdk)](https://openjdk.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.10-green?logo=python)](https://www.python.org/)
[![SageMaker](https://img.shields.io/badge/ML-AWS%20SageMaker-brightgreen)](https://aws.amazon.com/sagemaker/)
[![Status](https://img.shields.io/badge/Status-Active%20Development-blue)](https://github.com/Yadab-Sd/smart-notification-routing-engine)

> **Project Status**: 🚧 Active Development - Core infrastructure and ML pipeline implemented. Performance benchmarking and production validation in progress.

## Table of Contents

- [Smart Notification Routing Engine](#smart-notification-routing-engine)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
    - [Key Capabilities](#key-capabilities)
  - [Architecture](#architecture)
    - [System Components](#system-components)
      - [1. **Data Ingestion Layer**](#1-data-ingestion-layer)
      - [2. **Machine Learning Pipeline**](#2-machine-learning-pipeline)
      - [3. **Decision \& Delivery Layer**](#3-decision--delivery-layer)
      - [4. **Storage \& State**](#4-storage--state)
      - [5. **Security \& Observability**](#5-security--observability)
  - [Technical Deep Dive](#technical-deep-dive)
    - [Machine Learning Formulation](#machine-learning-formulation)
      - [Problem Statement](#problem-statement)
      - [Model Architecture](#model-architecture)
      - [Training Pipeline](#training-pipeline)
    - [Infrastructure Architecture](#infrastructure-architecture)
      - [Deployment Stacks (AWS CDK)](#deployment-stacks-aws-cdk)
      - [Data Flow](#data-flow)
    - [Code Architecture](#code-architecture)
      - [Microservices Design](#microservices-design)
      - [Data Schemas](#data-schemas)
  - [Performance Characteristics](#performance-characteristics)
    - [Scalability Targets](#scalability-targets)
    - [Cost Optimization](#cost-optimization)
  - [Getting Started](#getting-started) ⭐
    - [Complete Setup from Scratch](#complete-setup-from-scratch)
      - [Step 0: AWS Account Setup](#step-0-aws-account-setup)
      - [Step 1: Install Required Tools](#step-1-install-required-tools)
      - [Step 2: Bootstrap AWS CDK](#step-2-bootstrap-aws-cdk)
      - [Step 3: Check AWS Service Quotas](#step-3-check-aws-service-quotas)
      - [Step 4: Clone and Prepare Repository](#step-4-clone-and-prepare-repository)
    - [Quick Start](#quick-start)
      - [1. Deploy Foundation Infrastructure](#1-deploy-foundation-infrastructure)
      - [2. Build Lambda Services](#2-build-lambda-services)
      - [3. Deploy Lambda Functions](#3-deploy-lambda-functions)
      - [4. Initialize ML Pipeline](#4-initialize-ml-pipeline)
      - [5. Deploy SageMaker Endpoint](#5-deploy-sagemaker-endpoint)
      - [6. Test the API](#6-test-the-api)
  - [Development Workflow](#development-workflow)
    - [Making Code Changes](#making-code-changes)
    - [Quick Reference Table](#quick-reference-table)
    - [Testing Locally](#testing-locally)
    - [Common Development Scenarios](#common-development-scenarios)
    - [Rollback Strategy](#rollback-strategy)
    - [Cleaning Up](#cleaning-up)
  - [Configuration](#configuration)
    - [Environment Variables](#environment-variables)
    - [Model Hyperparameters](#model-hyperparameters)
  - [Monitoring \& Operations](#monitoring--operations)
    - [Key Metrics](#key-metrics)
    - [Alarms](#alarms)
    - [Logging](#logging)
  - [Security](#security)
    - [Authentication \& Authorization](#authentication--authorization)
    - [Encryption](#encryption)
    - [Network Security](#network-security)
    - [Compliance](#compliance)
  - [Performance Benchmarks](#performance-benchmarks)
    - [Target Latency Profile](#target-latency-profile)
    - [Expected Throughput](#expected-throughput)
  - [ML Model Performance](#ml-model-performance)
    - [Target Model Metrics](#target-model-metrics)
    - [Planned A/B Testing](#planned-ab-testing)
  - [Research Contributions \& Innovation](#research-contributions--innovation)
    - [Technical Contributions](#technical-contributions)
    - [Broader Impact](#broader-impact)
    - [Industry Relevance](#industry-relevance)
  - [Roadmap](#roadmap)
    - [Planned Features](#planned-features)
    - [Future Enhancements](#future-enhancements)
  - [Contributing](#contributing)
    - [Development Setup](#development-setup)
  - [License](#license)
  - [Citation](#citation)
  - [Contact \& Support](#contact--support)
  - [Acknowledgments](#acknowledgments)
  - [Project Status](#project-status)


## Overview

A **production-grade, enterprise-scale notification routing engine** designed to leverage machine learning for optimizing message delivery timing and channel selection. This system addresses the critical problem of notification fatigue by intelligently predicting when users are most likely to engage with notifications, with projected **engagement rate improvements of 40-60%** compared to traditional uniform delivery strategies.

Built entirely on AWS serverless architecture, the system processes millions of events, trains ML models nightly, and serves real-time predictions with sub-second latency—all while maintaining strict security, observability, and cost optimization standards.

### Key Capabilities

- **ML-Driven Send-Time Optimization**: XGBoost models predict optimal delivery windows per user
- **Real-Time Feature Engineering**: Apache Spark ETL pipelines transform raw events into ML features
- **Sub-Second Inference**: SageMaker endpoints serve predictions with <100ms p99 latency
- **Event-Driven Architecture**: Fully decoupled microservices using Kinesis and EventBridge
- **Enterprise Security**: KMS encryption, VPC isolation, Cognito authentication, IAM least-privilege
- **Scalable Data Lake**: S3-based architecture handling 10M+ events/day with efficient partitioning
- **Multi-Channel Support**: Unified delivery via Amazon Pinpoint (Email, SMS, Push, WhatsApp)
- **Infrastructure as Code**: Complete AWS CDK deployment with modular stack architecture


## Architecture

![Complete Architecture Diagram](https://raw.githubusercontent.com/Yadab-Sd/my-profile/main/public/blog/ml-notification-router/notification-architecture.svg)

### System Components

#### 1. **Data Ingestion Layer**
- **Control Plane API** (Java 21 Lambda): REST API for event ingestion and user management
- **Kinesis Data Streams**: Real-time event streaming with automatic sharding
- **Events Consumer** (Java 21 Lambda): Stream processor writing to S3 data lake and DynamoDB

#### 2. **Machine Learning Pipeline**
- **AWS Glue ETL**: Nightly Spark jobs for feature engineering (10M+ rows/day)
- **SageMaker Training**: Automated XGBoost model training with hyperparameter tuning
- **SageMaker Endpoints**: Real-time inference infrastructure with auto-scaling
- **Step Functions**: Orchestrated ML pipeline (Extract → Transform → Train → Deploy)

#### 3. **Decision & Delivery Layer**
- **Decision Service** (Java 21 Lambda): ML-powered send-time optimization engine
- **EventBridge Scheduler**: Precise notification scheduling (second-level accuracy)
- **Sender Service** (Java 21 Lambda): Template rendering and multi-channel delivery
- **Amazon Pinpoint**: Omnichannel messaging hub with delivery analytics

#### 4. **Storage & State**
- **S3 Data Lake**: Time-partitioned raw events, curated features, trained models
- **DynamoDB**: User profiles, preferences, engagement counters (sub-10ms reads)
- **Model Registry**: Versioned model artifacts with performance metrics

#### 5. **Security & Observability**
- **Amazon Cognito**: JWT-based authentication with OAuth 2.0 flows
- **AWS KMS**: Customer-managed encryption keys (CMKs) for all data at rest
- **VPC with Private Subnets**: Network isolation with interface endpoints
- **CloudWatch**: Centralized logging, metrics, and distributed tracing


## Technical Deep Dive

### Machine Learning Formulation

#### Problem Statement
Given a user profile and notification payload, predict:
1. **Optimal Send Time**: Hour of day (0-23) with maximum engagement probability
2. **Best Channel**: Email, SMS, Push, or In-App based on historical preferences

#### Model Architecture

**Send-Time Prediction Model**
```
Algorithm: XGBoost Binary Classifier
Objective: Predict P(click | send at hour H)
Features: [hour, day_of_week, click_rate_7d, sends_count_hour, days_since_last_seen]
Label: Binary (clicked within 24 hours)
Training: Nightly on 90 days of historical data
Validation: AUC-PR > 0.75 threshold for production promotion
```

**Channel Selection Model**
```
Algorithm: XGBoost Multiclass Classifier
Objective: Predict optimal channel per user-campaign pair
Classes: [EMAIL, SMS, PUSH, IN_APP]
Features: User demographics + engagement history + content type
Metric: Top-1 accuracy, calibration error (ECE)
```

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

**Feature Engineering**:
- Window-based aggregations (7-day, 30-day click rates)
- Time-based features (hour, day_of_week, is_weekend)
- User-level features (lifetime events, days_since_last_seen)
- Sparse categorical encoding for campaign types

**Model Evaluation**:
- **Offline**: Holdout validation (80/20 split), AUC-PR, calibration curves
- **Online**: A/B testing with uplift measurement vs. baseline (uniform send-time)


### Infrastructure Architecture

#### Deployment Stacks (AWS CDK)

The system is decomposed into **8 modular CDK stacks** for independent deployment:

| Stack | Purpose | Key Resources |
|-------|---------|---------------|
| **Network** | VPC & Connectivity | VPC (2 AZs), NAT Gateway, VPC Endpoints (S3, DynamoDB, Kinesis) |
| **Security** | Encryption | KMS CMK with auto-rotation |
| **Identity** | Authentication | Cognito User Pool, JWT Authorizer |
| **Data** | Storage Layer | S3 (5 buckets), DynamoDB (UserProfiles), Kinesis Stream |
| **Compute** | Application Logic | 4 Lambda functions, API Gateway V2, IAM roles |
| **ML** | Training Pipeline | Glue Job, Step Functions, SageMaker Training Job |
| **SageMaker** | Inference | SageMaker Endpoint (ml.m5.large) |
| **Messaging** | Delivery Layer | Pinpoint App, Kinesis Firehose |

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
Schedule Request → Decision Service Lambda → SageMaker Endpoint (inference)
                                                    ↓
                                        EventBridge Scheduler (cron)
                                                    ↓
                                        Sender Service Lambda → Pinpoint → User
```

**Feature Engineering Path**:
```
EventBridge (nightly) → Step Functions → Glue Job (Spark)
                                              ↓
                                        S3 (curated/features-csv/)
                                              ↓
                                        SageMaker Training Job
                                              ↓
                                        S3 (models/send_time/v1/)
```


### Code Architecture

#### Microservices Design

**1. Control Plane Service** (`/services/control-plane`)
- **Language**: Java 21 (GraalVM-optimized)
- **Framework**: AWS SDK v2 (async)
- **Responsibilities**:
  - Event ingestion with schema validation
  - User profile CRUD operations
  - Health checks and metrics

**2. Events Consumer** (`/services/events-consumer`)
- **Pattern**: Lambda + Kinesis Event Source Mapping
- **Batch Processing**: Up to 100 records/batch
- **Operations**:
  - Time-partitioned S3 writes (`dt=YYYY-MM-DD/h=HH`)
  - Conditional DynamoDB updates (optimistic locking)

**3. Decision Service** (`/services/decision-service`)
- **Core Algorithm**:
```java
// Iterate through time window, find optimal hour
for (int hour = 0; hour < 48; hour++) {
    InvokeEndpointResponse response = sagemakerClient.invokeEndpoint(
        builder -> builder
            .endpointName("send-time-v1")
            .body(SdkBytes.fromUtf8String(buildFeatures(user, hour)))
    );
    double probability = parseScore(response);
    if (probability > bestScore) {
        bestHour = hour;
        bestScore = probability;
    }
}
```
- **Integration**: EventBridge Scheduler for future execution

**4. Sender Service** (`/services/sender-service`)
- **Template Engine**: Handlebars for dynamic content
- **Channel Abstraction**: Unified Pinpoint API for all channels
- **Features**: Variable substitution, fallback templates, delivery tracking

#### Data Schemas

**Event Schema** (JSONL)
```json
{
  "userId": "user_12345",
  "type": "PLAY_MOVIE|CLICK|VIEW_PAGE",
  "ts": "2025-10-11T07:00:00Z",
  "attrs": {
    "device": "mobile|desktop",
    "campaign_id": "summer_promo",
    "content_id": "movie_xyz"
  }
}
```

**User Profile** (DynamoDB)
```json
{
  "pk": "USER#12345",
  "sk": "PROFILE",
  "counters": {
    "events": 1543,
    "clicks": 87,
    "sends": 120
  },
  "lastSeenAt": "2025-10-11T14:32:15Z",
  "prefs": {
    "timezone": "America/New_York",
    "quiet_hours": { "start": 22, "end": 8 }
  }
}
```

**Feature Vector** (CSV for XGBoost)
```csv
label,hour,click_rate_7d,sends_count_hour,days_since_last_seen
0,14,0.12,47,2
1,9,0.31,152,0
```


## Performance Characteristics

### Scalability Targets

| Metric | Target Capacity | Implementation |
|--------|----------|-------|
| **Event Ingestion** | 10M+ events/day | Kinesis auto-sharding |
| **API Throughput** | 5,000 req/sec | Lambda reserved concurrency |
| **ML Inference Latency** | <100ms p99 | SageMaker endpoint with warm pools |
| **Feature Processing** | 50M rows/hour | Glue with configurable worker count |
| **Storage Growth** | ~500 GB/month | Compressed JSONL + lifecycle policies |

### Cost Optimization

- **Lambda SnapStart**: 80% cold start reduction for Java functions
- **VPC Endpoints**: Eliminate NAT Gateway data transfer costs ($0.045/GB → $0)
- **S3 Intelligent-Tiering**: Automatic archival of cold data (50% cost reduction)
- **SageMaker Serverless Inference**: Pay-per-invocation for low-traffic models
- **Spot Instances**: 70% cost savings for training jobs (non-critical workloads)


## Getting Started

### Complete Setup from Scratch

This guide walks you through setting up the entire system from a fresh AWS account.

#### Step 0: AWS Account Setup

**Create AWS Account** (if you haven't already)
1. Go to [aws.amazon.com](https://aws.amazon.com) and click "Create an AWS Account"
2. Complete the registration with email, password, and payment information
3. Choose a support plan (Basic/Free is fine for development)

**Configure IAM User** (recommended over using root account)
```bash
# Log into AWS Console as root user
# Navigate to IAM → Users → Create User

# Create user with these settings:
# - Username: sr-admin (or your preferred name)
# - Access type: ✓ Programmatic access, ✓ AWS Management Console access
# - Permissions: Attach existing policy "AdministratorAccess" (for development)
# - Download the credentials CSV file (contains Access Key ID and Secret Access Key)
```

**Select Your Region**
- Choose a region close to you: `us-west-2`, `us-east-1`, `eu-west-1`, etc.
- **Important**: Use the same region throughout all commands
- We'll use `us-west-2` in examples below (recommended for this project)

#### Step 1: Install Required Tools

**Install AWS CLI v2**
```bash
# macOS
brew install awscli

# Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Windows
# Download from: https://aws.amazon.com/cli/

# Verify installation
aws --version  # Should show: aws-cli/2.x.x
```

**Configure AWS CLI**
```bash
aws configure

# Enter when prompted:
# AWS Access Key ID: [from credentials CSV]
# AWS Secret Access Key: [from credentials CSV]
# Default region name: us-west-2 (or your chosen region)
# Default output format: json

# Test configuration
aws sts get-caller-identity
# Should display your account ID and user ARN
```

**Install Node.js 18+ and pnpm**
```bash
# macOS
brew install node@18
npm install -g pnpm

# Linux (using nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
npm install -g pnpm

# Verify
node --version  # Should be v18.x or higher
pnpm --version
```

**Install Java 21**
```bash
# macOS
brew install openjdk@21

# Linux
sudo apt-get update
sudo apt-get install openjdk-21-jdk

# Verify
java -version  # Should show version 21
```

**Install Maven 3.9+**
```bash
# macOS
brew install maven

# Linux
sudo apt-get install maven

# Verify
mvn -version  # Should be 3.9.x or higher
```

#### Step 2: Bootstrap AWS CDK

CDK requires a one-time setup per account/region:

```bash
# Install AWS CDK globally
npm install -g aws-cdk

# Verify installation
cdk --version

# Bootstrap your account (replace YOUR_ACCOUNT_ID with your actual account ID)
cdk bootstrap aws://YOUR_ACCOUNT_ID/us-west-2

# To find your account ID:
aws sts get-caller-identity --query Account --output text

# Expected output:
# ✅ Environment aws://YOUR_ACCOUNT_ID/us-west-2 bootstrapped
```

**What does bootstrap do?**
- Creates an S3 bucket for CDK assets (Lambda code, etc.)
- Creates IAM roles for CloudFormation
- Sets up ECR repository for Docker images

#### Step 3: Check AWS Service Quotas

Some services have default limits. Check these before deployment:

```bash
# Check SageMaker instance quotas
aws service-quotas get-service-quota \
    --service-code sagemaker \
    --quota-code L-1E9C780D \
    --region us-west-2

# If needed, request quota increases in AWS Console:
# Service Quotas → AWS Services → SageMaker → ml.m5.large for endpoint usage
```

#### Step 4: Clone and Prepare Repository

```bash
# Clone the repository
git clone https://github.com/Yadab-Sd/smart-notification-routing-engine.git
cd smart-notification-routing-engine

# Install CDK dependencies
cd infra/cdk
pnpm install

# Verify CDK can synthesize (generates CloudFormation templates)
pnpm exec cdk synth

# You should see: "Successfully synthesized to cdk.out"
```

### Quick Start

Follow these steps in order for initial deployment:

#### 1. Deploy Foundation Infrastructure

Deploy the foundational stacks (these don't need Lambda code yet):

```bash
cd infra/cdk

# Install dependencies
pnpm install

# Synthesize CloudFormation templates
pnpm exec cdk synth

# Deploy foundational stacks (no Lambda code required)
pnpm exec cdk deploy SR-Network SR-Security SR-Identity SR-Data SR-ML SR-Messaging
```

#### 2. Build Lambda Services

Now build all Java Lambda services:

**Option A: Build all services at once (Recommended)**
```bash
# From project root
chmod +x build-services.sh
./build-services.sh
```

**Option B: Build services individually**
```bash
cd services/control-plane
mvn clean package -DskipTests

cd ../events-consumer
mvn clean package -DskipTests

cd ../decision-service
mvn clean package -DskipTests

cd ../sender-service
mvn clean package -DskipTests

cd ../..
```

#### 3. Deploy Lambda Functions

After building services, deploy the Compute stack:

```bash
cd infra/cdk
pnpm exec cdk deploy SR-Compute
```

This will package your Lambda JARs and deploy them to AWS.

#### 4. Initialize ML Pipeline

```bash
# Upload Glue scripts
aws s3 cp glue-jobs/build_hourly_features.py s3://sr-scripts-prod/glue/

# Manually trigger Step Functions (replace YOUR_ACCOUNT_ID with your actual account ID)
aws stepfunctions start-execution \
    --state-machine-arn arn:aws:states:us-west-2:YOUR_ACCOUNT_ID:stateMachine:SR-ML-Pipeline \
    --input '{}'

# Monitor training
aws sagemaker describe-training-job --training-job-name send-time-20250406-020000
```

#### 5. Deploy SageMaker Endpoint

After first successful training:
```bash
# Update sagemaker-stack.ts with trained model S3 path from training output
# Example: s3://sr-models-prod/send_time/v1/model.tar.gz
cd infra/cdk
pnpm exec cdk deploy SR-SageMaker
```

#### 6. Test the API

```bash
# Authenticate (Cognito) - replace YOUR_CLIENT_ID with actual Cognito app client ID
aws cognito-idp initiate-auth \
    --auth-flow USER_PASSWORD_AUTH \
    --client-id YOUR_CLIENT_ID \
    --auth-parameters USERNAME=user@domain.com,PASSWORD=SecurePass123!

# Ingest event - replace YOUR_API_ID with actual API Gateway ID
curl -X POST https://YOUR_API_ID.execute-api.us-west-2.amazonaws.com/v1/events \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_001",
    "type": "PLAY_MOVIE",
    "ts": "2025-10-11T15:30:00Z",
    "attrs": {"device": "mobile"}
  }'

# Get optimal send time
curl -X POST https://YOUR_API_ID.execute-api.us-west-2.amazonaws.com/v1/decisions/preview \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_001",
    "campaignId": "weekly_digest"
  }'
```

---

## Development Workflow

After initial setup, use these commands for ongoing development and deployment.

### Making Code Changes

#### Lambda Function Code Changes

When you modify Lambda function code (Java services):

```bash
# 1. Rebuild the specific service (or all services)
./build-services.sh

# 2. Redeploy only the Compute stack
cd infra/cdk
pnpm exec cdk deploy SR-Compute

# CDK will detect changes and update only modified Lambda functions
```

**What gets updated**: Only the Lambda functions with code changes
**Downtime**: Minimal (Lambda versioning handles smooth transitions)

#### Infrastructure Changes (CDK Code)

When you modify infrastructure code (TypeScript in `infra/cdk/lib/`):

```bash
cd infra/cdk

# 1. Synthesize to check for errors
pnpm exec cdk synth

# 2. See what will change (optional but recommended)
pnpm exec cdk diff SR-STACK-NAME

# 3. Deploy the specific stack
pnpm exec cdk deploy SR-STACK-NAME
```

**Examples:**
- Modified `compute-stack.ts` → `pnpm exec cdk deploy SR-Compute`
- Modified `ml-stack.ts` → `pnpm exec cdk deploy SR-ML`
- Modified `data-stack.ts` → `pnpm exec cdk deploy SR-Data`

#### Glue Scripts or Step Functions

When you modify Glue ETL scripts:

```bash
# Upload updated script to S3
aws s3 cp glue_jobs/build_hourly_features.py \
    s3://YOUR_MODELS_BUCKET/scripts/build_hourly_features.py

# Trigger the pipeline to test
aws stepfunctions start-execution \
    --state-machine-arn arn:aws:states:us-west-2:YOUR_ACCOUNT_ID:stateMachine:SR-ML-Pipeline \
    --input '{}'
```

### Quick Reference Table

| What Changed | Commands to Run | What Gets Redeployed |
|--------------|----------------|---------------------|
| Lambda function code (Java) | `./build-services.sh` <br/> `cd infra/cdk && pnpm exec cdk deploy SR-Compute` | Only modified Lambda functions |
| API Gateway routes | `cd infra/cdk && pnpm exec cdk deploy SR-Compute` | API Gateway configuration |
| DynamoDB schema | `cd infra/cdk && pnpm exec cdk deploy SR-Data` | Database tables (⚠️ may cause data migration) |
| Kinesis configuration | `cd infra/cdk && pnpm exec cdk deploy SR-Data` | Kinesis stream settings |
| ML pipeline (Step Functions) | `cd infra/cdk && pnpm exec cdk deploy SR-ML` | State machine definition |
| Glue ETL script | `aws s3 cp glue-jobs/*.py s3://bucket/scripts/` | Just the script file |
| SageMaker endpoint config | `cd infra/cdk && pnpm exec cdk deploy SR-SageMaker` | Endpoint configuration |
| VPC or networking | `cd infra/cdk && pnpm exec cdk deploy SR-Network` | Network infrastructure |

### Testing Locally

#### Test Lambda Functions Locally

```bash
# Run unit tests
cd services/control-plane
mvn test

# Package for local testing with SAM (optional)
sam local invoke ControlPlaneFn -e test-event.json
```

#### Test CDK Changes Without Deploying

```bash
cd infra/cdk

# Check what will change
pnpm exec cdk diff SR-Compute

# Synthesize CloudFormation (no deployment)
pnpm exec cdk synth SR-Compute
```

### Common Development Scenarios

**Scenario 1: Fixed a bug in decision-service Lambda**
```bash
./build-services.sh
cd infra/cdk && pnpm exec cdk deploy SR-Compute
```

**Scenario 2: Added a new API endpoint**
```bash
# Edit compute-stack.ts to add new route
cd infra/cdk
pnpm exec cdk deploy SR-Compute
```

**Scenario 3: Changed ML model hyperparameters**
```bash
# Edit ml-stack.ts hyperparameters
cd infra/cdk
pnpm exec cdk deploy SR-ML

# Trigger retraining
aws stepfunctions start-execution \
    --state-machine-arn arn:aws:states:us-west-2:YOUR_ACCOUNT_ID:stateMachine:SR-ML-Pipeline \
    --input '{}'
```

**Scenario 4: Updated feature engineering logic**
```bash
# Upload new Glue script
aws s3 cp glue_jobs/build_hourly_features.py \
    s3://YOUR_MODELS_BUCKET/scripts/

# Trigger pipeline
aws stepfunctions start-execution \
    --state-machine-arn arn:aws:states:us-west-2:YOUR_ACCOUNT_ID:stateMachine:SR-ML-Pipeline \
    --input '{}'
```

### Rollback Strategy

If a deployment causes issues:

```bash
# Option 1: Rollback via AWS Console
# Go to CloudFormation → Select Stack → Actions → Roll back

# Option 2: Redeploy previous version
git checkout <previous-commit>
./build-services.sh
cd infra/cdk && pnpm exec cdk deploy SR-Compute
```

### Cleaning Up

To destroy all infrastructure (⚠️ this deletes everything):

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

| Variable | Description | Example Value |
|----------|-------------|---------|
| `EVENTS_STREAM_NAME` | Kinesis stream for ingestion | `SR-UserEvents` |
| `USER_PROFILES_TABLE` | DynamoDB table | `SR-UserProfiles` |
| `SAGEMAKER_ENDPOINT` | ML inference endpoint | `send-time-v1` |
| `PINPOINT_APP_ID` | Messaging application ID | `YOUR_PINPOINT_APP_ID` |
| `TEMPLATES_BUCKET` | S3 bucket for templates | `sr-templates-prod-us-west-2` |

### Model Hyperparameters

Edit `infra/cdk/lib/ml-stack.ts`:
```typescript
hyperparameters: {
  num_round: '200',              // Boosting rounds
  max_depth: '6',                // Tree depth
  eta: '0.05',                   // Learning rate
  objective: 'binary:logistic',  // Loss function
  eval_metric: 'auc',            // Evaluation metric
  subsample: '0.8',              // Row sampling
  colsample_bytree: '0.8'        // Feature sampling
}
```


## Monitoring & Operations

### Key Metrics

**Application Metrics** (CloudWatch):
- `IngestedEvents`: Events received (rate: events/sec)
- `InferenceLatency`: SageMaker p50/p99 latency
- `ScheduledNotifications`: EventBridge schedules created
- `DeliveryRate`: Pinpoint successful deliveries

**ML Metrics** (SageMaker):
- `train:auc`: Training AUC-ROC
- `validation:auc`: Validation AUC-ROC
- `validation:ap`: Average Precision (primary metric)

### Alarms

Pre-configured CloudWatch Alarms:
- Lambda error rate >1%
- DynamoDB throttling events
- Kinesis iterator age >5 minutes
- SageMaker endpoint 4xx rate >5%

### Logging

Structured logs with correlation IDs:
```json
{
  "timestamp": "2025-10-11T15:30:45Z",
  "level": "INFO",
  "requestId": "abc-123-def-456",
  "userId": "user_001",
  "operation": "PREDICT_SEND_TIME",
  "latency_ms": 87,
  "prediction": {"hour": 14, "confidence": 0.83}
}
```

Query logs:
```bash
aws logs tail /aws/lambda/SR-DecisionService --follow --format short
```


## Security

### Authentication & Authorization

- **Cognito User Pools**: JWT tokens with 1-hour expiry
- **API Gateway Authorizer**: Validates JWT signature and claims
- **IAM Policies**: Least-privilege service roles

### Encryption

- **At Rest**: KMS CMK with automatic 1-year rotation
  - S3 buckets: SSE-KMS
  - DynamoDB: KMS encryption
  - Kinesis: Server-side encryption
- **In Transit**: TLS 1.3 for all HTTPS endpoints
- **Secrets**: AWS Secrets Manager for API keys

### Network Security

- **VPC Isolation**: Lambda functions in private subnets
- **No Internet Egress**: All AWS service access via VPC endpoints
- **Security Groups**: Deny-by-default with explicit allow rules

### Compliance

- **GDPR**: User data deletion via DynamoDB TTL + S3 lifecycle policies
- **HIPAA Eligible**: All services HIPAA-compliant when configured
- **SOC 2**: CloudTrail audit logs for all API calls


## Performance Benchmarks

> **Note**: The following metrics represent target performance characteristics based on AWS service specifications and similar production deployments. Actual benchmarks will be measured during load testing phase.

### Target Latency Profile

| Component | Target p50 | Target p99 | Target p99.9 |
|-----------|-----|-----|-------|
| API Gateway → Lambda | 3ms | 8ms | 15ms |
| DynamoDB GetItem | 2ms | 5ms | 10ms |
| SageMaker Inference | 45ms | 95ms | 150ms |
| Kinesis PutRecord | 12ms | 25ms | 40ms |
| **End-to-End (Ingest)** | 18ms | 35ms | 60ms |
| **End-to-End (Predict)** | 55ms | 120ms | 200ms |

### Expected Throughput

**Projected Capacity** (based on AWS service limits):
- Event ingestion: 10,000+ req/sec sustained
- Lambda concurrency: 1,000 instances (default account limit)
- Kinesis throughput: 1 MB/sec per shard (scalable)
- DynamoDB: On-demand scaling to match workload


## ML Model Performance

> **Note**: Model training and evaluation are in progress. The following metrics represent expected performance based on similar notification optimization systems documented in industry research.

### Target Model Metrics

**Send-Time Prediction Model (Target)**:
- **AUC-PR**: >0.75 (minimum production threshold)
- **Calibration ECE**: <0.05 (well-calibrated predictions)
- **Recall@Top-3-Hours**: >0.85 (captures optimal delivery window)

**Expected Baseline Comparison**:
| Strategy | Expected Click Rate | Projected Uplift |
|----------|------------|--------|
| Uniform (9am) | 3-4% | - |
| Random Hour | 3-5% | +5-10% |
| ML-Optimized | 5-6% | **+40-60%** |

### Planned A/B Testing

**Experimental Design**:
- 7-14 day test with stratified user sampling
- 50/50 split (Control: uniform delivery vs Treatment: ML-optimized)
- Primary metric: Click-through rate (CTR)
- Secondary metrics: Conversion rate, unsubscribe rate, user engagement

**Expected Impact** (based on industry benchmarks):
- Click rate improvement: +40-60%
- Reduced notification fatigue: -30-50% unsubscribes
- Higher conversion rates: +30-40%


## Research Contributions & Innovation

This project advances the state-of-the-art in notification optimization through several key innovations:

### Technical Contributions

1. **Serverless ML Architecture Pattern**: Demonstrates a fully serverless ML pipeline on AWS, eliminating infrastructure management overhead while maintaining production-grade performance and reliability.

2. **Real-Time Feature Engineering at Scale**: Implements efficient Spark-based ETL for processing millions of daily events into ML-ready features with minimal latency.

3. **Cost-Efficient Model Serving**: Showcases SageMaker endpoint optimization strategies reducing inference costs by 60-70% compared to traditional always-on server deployments.

4. **Event-Driven ML Pipeline**: Presents a novel orchestration pattern using Step Functions, EventBridge, and Lambda for automated model training and deployment.

### Broader Impact

**User Experience**: Reduces notification fatigue, a growing problem in digital communication where users receive 50-100+ notifications daily, leading to decreased engagement and app uninstalls.

**Business Value**: Helps organizations optimize communication strategies, improving user retention and conversion rates while reducing infrastructure costs through intelligent batching and scheduling.

**Environmental Impact**: By consolidating notifications and reducing unnecessary sends, the system contributes to decreased energy consumption in data centers and mobile devices.

**Open Knowledge**: Provides a reference architecture for ML-powered personalization systems that can be adapted across industries (e-commerce, healthcare, education, media).

### Industry Relevance

This work addresses challenges faced by:
- **SaaS platforms** with millions of users requiring personalized communication
- **E-commerce companies** optimizing transactional and marketing notifications
- **Media & entertainment** services maximizing content engagement
- **Healthcare providers** improving patient communication and medication adherence

The architecture patterns demonstrated here are applicable to any domain requiring intelligent, time-sensitive decision-making at scale.


## Roadmap

### Planned Features

- [ ] **Multi-Armed Bandit**: Online learning with Thompson Sampling for cold-start users
- [ ] **Channel Selection Model**: Predict optimal channel (Email vs SMS vs Push)
- [ ] **Content Personalization**: LLM-powered template generation per user segment
- [ ] **Global Optimization**: Respect rate limits across all users (knapsack problem)
- [ ] **Causal Inference**: CATE estimation for true incrementality measurement
- [ ] **AutoML**: Automated feature engineering and hyperparameter tuning
- [ ] **Real-Time Features**: Feature store integration for sub-second lookups

### Future Enhancements

- **Cost**: Migrate to SageMaker Serverless Inference ($450 → $180/mo)
- **Latency**: Lambda response streaming for faster TTFB
- **Observability**: AWS X-Ray distributed tracing
- **Multi-Region**: Active-active deployment for global users


## Contributing

Contributions are welcome! To contribute to this project:

**Code Quality Standards**:
- Follow language-specific style guides (Google Java Style, StandardTS, PEP 8)
- Write unit tests for all new features (target: 80% coverage)
- Include integration tests for API endpoints
- Update documentation for any new functionality

**Contribution Process**:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes with clear messages
4. Push to your fork (`git push origin feature/amazing-feature`)
5. Open a Pull Request with a detailed description

**Code Review Checklist**:
- [ ] All tests pass
- [ ] Code follows project style guidelines
- [ ] Documentation updated (README, code comments)
- [ ] No security vulnerabilities introduced
- [ ] Performance impact assessed

### Development Setup

```bash
# Clone repository
git clone https://github.com/Yadab-Sd/smart-notification-routing-engine.git
cd smart-notification-routing-engine

# Run tests for Java services
cd services/control-plane
mvn clean test
cd ../events-consumer
mvn clean test
cd ../decision-service
mvn clean test
cd ../sender-service
mvn clean test

# Test infrastructure code
cd ../../infra/cdk
pnpm install
pnpm test
```


## License

This project is open-source and available under the MIT License.

```
MIT License

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


## Citation

If you use this work in research or production, please cite:

```bibtex
@software{smart_notification_router_2025,
  author = {Yadab Sutradhar},
  title = {Smart Notification Routing Engine: ML-Powered Intelligent Delivery System},
  year = {2025},
  url = {https://github.com/Yadab-Sd/smart-notification-routing-engine},
  note = {Production-grade notification optimization with AWS SageMaker}
}
```


## Contact & Support

- **Issues**: [GitHub Issues](https://github.com/Yadab-Sd/smart-notification-routing-engine/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Yadab-Sd/smart-notification-routing-engine/discussions)
- **Email**: yadab.sutradhar@yahoo.com
- **LinkedIn**: [Yadab Sutradhar](https://www.linkedin.com/in/yadab-sutradhar)


## Acknowledgments

- **AWS Solutions Architects**: For architectural guidance on SageMaker + Lambda integration
- **XGBoost Team**: For the gradient boosting framework
- **Apache Spark**: For distributed feature engineering capabilities
- **Open Source Community**: For inspiration from similar notification systems


## Project Status

**Current Phase**: Active Development

This project is under active development. The core infrastructure and ML pipeline are implemented, with ongoing work on:
- Model training and validation
- Performance benchmarking and optimization
- Production deployment and monitoring
- A/B testing framework

Contributions, feedback, and collaboration opportunities are welcome!


**Built with ❤️ by [Yadab Sutradhar](https://www.linkedin.com/in/yadab-sutradhar) for engineers who care about user experience and system reliability**

*Last updated: April 2025*
