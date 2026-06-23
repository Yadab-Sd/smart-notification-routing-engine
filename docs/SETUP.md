# Complete Setup Guide

This guide walks through setting up the Smart Notification Routing Engine for development and production.

---

## Prerequisites

Before starting, ensure you have:

1. **AWS Account**
   - Active AWS account with admin permissions
   - AWS CLI configured (`aws configure`)
   - Minimum $50 credit available (initial deployment costs)

2. **Domain & Email**
   - Verified email address in Amazon SES
   - Domain (optional, for custom sender addresses)

3. **Development Tools**
   - Git
   - Bash/Zsh shell
   - Internet connection

---

## One-Click Setup (Recommended)

The fastest way to get started:

```bash
git clone https://github.com/Yadab-Sd/smart-notification-routing-engine.git
cd smart-notification-routing-engine
./scripts/setup.sh
```

This script automatically:
- Detects your OS (macOS/Linux)
- Installs AWS CLI, Node.js 18+, Java 21, Maven, AWS CDK
- Configures AWS credentials
- Bootstraps CDK in your AWS account
- Builds all 6 Java Lambda services
- Creates `.env` configuration file
- Validates CDK can synthesize stacks

**Time**: 5-8 minutes

**What it installs**:
- AWS CLI v2 (if not present)
- Node.js 18+ (via nvm)
- Java 21 (Amazon Corretto)
- Apache Maven 3.9+
- AWS CDK CLI 2.x
- pnpm (fast Node package manager)

---

## Manual Setup

If you prefer manual installation or the script fails:

### Step 1: Install AWS CLI

**macOS** (Homebrew):
```bash
brew install awscli
```

**Linux**:
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

**Verify**:
```bash
aws --version  # Should show 2.x
```

---

### Step 2: Configure AWS Credentials

```bash
aws configure
```

Enter:
- **Access Key ID**: Your IAM user access key
- **Secret Access Key**: Your IAM secret key
- **Default region**: `us-west-2` (recommended) or your preferred region
- **Output format**: `json`

**Verify**:
```bash
aws sts get-caller-identity
```

Should display your AWS account ID and user ARN.

---

### Step 3: Install Node.js 18+

**macOS/Linux** (nvm recommended):
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
source ~/.bashrc  # or ~/.zshrc
nvm install 18
nvm use 18
```

**Verify**:
```bash
node --version  # Should be v18.x or v20.x
npm --version
```

---

### Step 4: Install Java 21

**macOS** (Homebrew):
```bash
brew install openjdk@21
sudo ln -sfn $(brew --prefix)/opt/openjdk@21/libexec/openjdk.jdk \
    /Library/Java/JavaVirtualMachines/openjdk-21.jdk
```

**Linux** (Amazon Corretto):
```bash
wget https://corretto.aws/downloads/latest/amazon-corretto-21-x64-linux-jdk.tar.gz
tar -xzf amazon-corretto-21-x64-linux-jdk.tar.gz
sudo mv amazon-corretto-21.* /opt/jdk-21
echo 'export JAVA_HOME=/opt/jdk-21' >> ~/.bashrc
echo 'export PATH=$JAVA_HOME/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

**Verify**:
```bash
java -version  # Should show version 21.x
```

---

### Step 5: Install Maven

**macOS** (Homebrew):
```bash
brew install maven
```

**Linux**:
```bash
wget https://dlcdn.apache.org/maven/maven-3/3.9.6/binaries/apache-maven-3.9.6-bin.tar.gz
tar -xzf apache-maven-3.9.6-bin.tar.gz
sudo mv apache-maven-3.9.6 /opt/maven
echo 'export PATH=/opt/maven/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

**Verify**:
```bash
mvn --version  # Should show 3.9.x
```

---

### Step 6: Install AWS CDK

```bash
npm install -g aws-cdk
```

**Verify**:
```bash
cdk --version  # Should be 2.x
```

---

### Step 7: Bootstrap CDK

This creates necessary resources in your AWS account (S3 bucket, IAM roles):

```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

Replace:
- `ACCOUNT-ID`: Your 12-digit AWS account ID
- `REGION`: `us-west-2` or your chosen region

**Example**:
```bash
cdk bootstrap aws://123456789012/us-west-2
```

**Note**: Only needed once per account/region combination.

---

### Step 8: Build Lambda Functions

```bash
cd smart-notification-routing-engine
./scripts/build-services.sh
```

This compiles all 6 Java Lambda services:
- Control Plane (API Gateway handler)
- Events Consumer (Kinesis processor)
- Decision Service (ML inference)
- Sender Service (notification delivery)
- Endpoint Deployer (SageMaker endpoint manager)
- Glue Feature Engineering (ETL job)

**Time**: 2-3 minutes

---

### Step 9: Verify SES Email

The user emails which we will target to send email, must be verified in Amazon SES. In real life, what we do after user sign-up, we send an confirmation email with a link to the email/phone and upon click we confirm registration.

```bash
aws sesv2 create-email-identity --email-identity notifications@yourdomain.com
```

Then:
1. Check your email inbox
2. Click the verification link from AWS
3. Wait 2-5 minutes for verification

**Verify status**:
```bash
aws sesv2 get-email-identity --email-identity notifications@yourdomain.com
```

Look for `"VerificationStatus": "SUCCESS"`

---

### Step 10: Configure Environment

```bash
cd infra/cdk
cp .env.example .env
nano .env  # or use your preferred editor
```

Set:
```env
SENDER_EMAIL=notifications@yourdomain.com
```

**Important**: Use the same email you verified in Step 9.

---

### Step 11: Install CDK Dependencies

```bash
cd infra/cdk
npm install -g pnpm  # if not already installed
pnpm install
```

**Time**: 1-2 minutes

---

### Step 12: Synthesize CDK Stacks

This validates your infrastructure code without deploying:

```bash
pnpm exec cdk synth
```

You should see CloudFormation templates for 8 stacks printed to terminal.

---

## Deployment

### Recommended: Deploy With Helper Script

```bash
# Builds Lambda artifacts, deploys data prerequisites, uploads the Glue script,
# and deploys all CDK stacks.
./scripts/deploy-infra.sh
```

**Time**: 10-15 minutes

The script automatically uploads `glue-jobs/build_hourly_features.py` to the models bucket before deploying `SR-ML`.

---

### Manual: Upload Glue Script And Deploy All Stacks

If you prefer manual commands, upload the feature engineering script to S3 before deploying all stacks:

```bash
cd infra/cdk

pnpm exec cdk deploy SR-Security SR-Data --require-approval never

MODELS_BUCKET=$(aws cloudformation describe-stacks --stack-name SR-Data \
    --query "Stacks[0].Outputs[?OutputKey=='ModelsBucketName'].OutputValue" --output text)

aws s3 cp ../../glue-jobs/build_hourly_features.py s3://$MODELS_BUCKET/scripts/build_hourly_features.py

pnpm exec cdk deploy --all --require-approval never
```

**What gets created**:
- VPC with public/private subnets across 2 AZs
- KMS encryption key
- Cognito User Pool
- S3 buckets (5 total: events, curated, models, logs, artifacts)
- DynamoDB table
- Kinesis stream
- 4 Lambda functions
- API Gateway REST API
- Glue ETL job
- SageMaker training job definition
- Step Functions state machine
- EventBridge schedules
- Pinpoint project

**Cost**: ~$0.50/hour (~$15/day) with no traffic

---

### Deploy Single Stack

To deploy just one stack (faster iteration during development):

```bash
./scripts/deploy-infra.sh SR-Compute

# Or from infra/cdk:
pnpm exec cdk deploy SR-Compute --require-approval never
```

Available stacks:
- `SR-Network`: VPC, subnets, NAT gateway
- `SR-Security`: KMS key
- `SR-Identity`: Cognito User Pool
- `SR-Data`: S3, DynamoDB, Kinesis
- `SR-Compute`: Lambdas, API Gateway
- `SR-ML`: Glue, Step Functions, SageMaker
- `SR-Messaging`: Pinpoint

---

## Verify Deployment

### 1. Check Stack Status

```bash
aws cloudformation list-stacks \
    --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE
```

All 8 stacks should show `CREATE_COMPLETE`.

---

### 2. Get API URL

```bash
API_URL=$(aws cloudformation describe-stacks --stack-name SR-Compute \
    --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)
echo $API_URL
```

Save this URL - you'll need it for testing.

---

### 3. Health Check

```bash
curl $API_URL/v1/health
```

**Expected response**:
```json
{
  "status": "ok",
  "timestamp": "2026-06-12T10:30:00Z",
  "version": "1.0.0"
}
```

---

### 4. Create Test Admin User

```bash
# Get User Pool ID
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name SR-Identity \
    --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)
ADMIN_USERNAME=test@example.com
ADMIN_PASSWORD=TempPass123!
# Create user
aws cognito-idp admin-create-user \
    --user-pool-id $USER_POOL_ID \
    --username $ADMIN_USERNAME \
    --user-attributes Name=email,Value=$ADMIN_USERNAME \
    --temporary-password $ADMIN_PASSWORD
```

---

### 5. Test Event Ingestion

```bash
# Get Client Id - a specific user property in the users pool
APP_CLIENT_ID=$(aws cognito-idp list-user-pool-clients --user-pool-id $USER_POOL_ID --query "UserPoolClients[0].ClientId" --output text)

# Set permanent password-
SESSION_STRING=$(aws cognito-idp initiate-auth \
    --auth-flow USER_PASSWORD_AUTH \
    --client-id $APP_CLIENT_ID \
    --auth-parameters USERNAME=$ADMIN_USERNAME,PASSWORD=$ADMIN_PASSWORD \
    --query 'Session' --output text)
ADMIN_NEW_PASSWORD=NewPass123!

# [First time] Get auth token (replace with your created user credentials)
TOKEN=$(aws cognito-idp respond-to-auth-challenge \
    --client-id $APP_CLIENT_ID \
    --challenge-name NEW_PASSWORD_REQUIRED \
    --session $SESSION_STRING \
    --challenge-responses USERNAME=$ADMIN_USERNAME,NEW_PASSWORD=$ADMIN_NEW_PASSWORD \
    --query 'AuthenticationResult.IdToken' --output text)

# Verify token
echo "${TOKEN: -4}"

ADMIN_PASSWORD=$ADMIN_NEW_PASSWORD

# [Next Time if token expires] Get auth token
TOKEN=$(aws cognito-idp initiate-auth \
    --auth-flow USER_PASSWORD_AUTH \
    --client-id $APP_CLIENT_ID \
    --auth-parameters USERNAME=$ADMIN_USERNAME,PASSWORD=$ADMIN_PASSWORD \
    --query 'AuthenticationResult.IdToken' --output text)

# Send test event
curl -X POST $API_URL/v1/events \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "userId": "user_123",
      "type": "CLICK",
      "ts": "2026-06-12T10:30:00Z"
    }'
```

**Expected response**:
```json
{
  "userId": "user_123",
  "status": "queued"
}
```

---

## First ML Training Run

The ML model trains nightly at 02:00 UTC, but you can trigger it manually:

```bash
# Get state machine ARN
STATE_MACHINE_ARN=$(aws cloudformation describe-stacks --stack-name SR-ML \
    --query "Stacks[0].Outputs[?OutputKey=='TrainingPipelineArn'].OutputValue" --output text)

# Start execution
aws stepfunctions start-execution \
    --state-machine-arn $STATE_MACHINE_ARN \
    --name "manual-$(date +%s)"
```

**Monitor progress**:
```bash
aws stepfunctions list-executions \
    --state-machine-arn $STATE_MACHINE_ARN \
    --max-results 1
```

**Time**: 15-20 minutes

**Cost**: ~$2-3 per run

---

## View Logs

### Lambda Logs

```bash
# Control Plane (API)
aws logs tail /aws/lambda/SR-Compute-ControlPlaneFn --follow

# Events Consumer (Kinesis)
aws logs tail /aws/lambda/SR-Compute-EventsConsumerFn --follow

# Decision Service (ML inference)
aws logs tail /aws/lambda/SR-Compute-DecisionFn --follow

# Sender Service (notifications)
aws logs tail /aws/lambda/SR-Compute-SenderFn --follow
```

### Glue Job Logs

```bash
aws logs tail /aws-glue/jobs/output --follow
```

---

## Update Deployment

After making code changes:

```bash
# Rebuild services
./scripts/build-services.sh

# Deploy updated stack
cd infra/cdk
pnpm exec cdk deploy SR-Compute
```

---

## Destroy Everything

**Warning**: This deletes all data and resources.

```bash
cd infra/cdk
pnpm exec cdk destroy --all
```

Confirm each stack deletion when prompted.

**Time**: 5-10 minutes

**Note**: Some resources (S3 buckets with data, CloudWatch logs) may need manual deletion if not empty.

---

## Troubleshooting

### Error: "Unable to locate credentials"

**Problem**: AWS CLI not configured.

**Fix**:
```bash
aws configure
```

---

### Error: "Node version must be >= 18"

**Problem**: Old Node.js version.

**Fix**:
```bash
nvm install 18
nvm use 18
```

---

### Error: "CDK bootstrap required"

**Problem**: CDK not bootstrapped in your account/region.

**Fix**:
```bash
cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/us-west-2
```

---

### Error: "Email not verified"

**Problem**: Sender email not verified in SES.

**Fix**:
```bash
aws sesv2 create-email-identity --email-identity notifications@yourdomain.com
```

Check email and click verification link.

---

### Error: "Java build failed"

**Problem**: Wrong Java version or Maven not installed.

**Fix**:
```bash
java -version  # Must be 21.x
mvn --version  # Must be 3.9+
```

Reinstall if versions don't match.

---

### Error: "VPC limit exceeded"

**Problem**: AWS account VPC limit reached (default: 5 per region).

**Fix**:
- Delete unused VPCs, or
- Request limit increase via AWS Support, or
- Deploy to different region

---

### Error: "SageMaker endpoint not found"

**Problem**: ML training hasn't run yet or AWS has not approved the needed SageMaker quota.

**Expected behavior**: The application still works. Decision Service falls back to a built-in heuristic scorer and returns `modelSource: "FALLBACK_HEURISTIC"` in preview/schedule responses.

**Fix**: Wait for nightly training (02:00 UTC), request SageMaker quota if needed, or trigger manually:
```bash
aws stepfunctions start-execution --state-machine-arn $STATE_MACHINE_ARN --name "manual-$(date +%s)"
```

---

### Error: "ResourceLimitExceeded: ml.m5.xlarge for training job usage"

**Problem**: AWS account has 0 quota for ml.m5.xlarge instances (common for new accounts).

**Fix**: The default configuration uses ml.m5.large which has higher quota. If you manually changed to xlarge, either:

1. **Revert to ml.m5.large** (recommended for pilot):
   - Edit `infra/cdk/lib/ml-stack.ts` line 172
   - Change `ec2.InstanceSize.XLARGE` to `ec2.InstanceSize.LARGE`
   - Redeploy: `pnpm exec cdk deploy SR-ML`

2. **Request quota increase**:
   ```bash
   aws service-quotas request-service-quota-increase \
     --service-code sagemaker \
     --quota-code L-12345678 \
     --desired-value 1
   ```
   - Approval time: 1-3 business days
   - ml.m5.large handles <10M training events efficiently

---

## Production Checklist

Before going to production:

- [ ] Enable CloudWatch alarms for Lambda errors, Kinesis iterator age, SageMaker latency
- [ ] Set up AWS Budgets with $500-1000/month alert
- [ ] Configure DynamoDB point-in-time recovery
- [ ] Enable S3 versioning on critical buckets
- [ ] Set up VPC Flow Logs (audit trail)
- [ ] Configure CloudTrail for API audit logs
- [ ] Enable AWS GuardDuty (threat detection)
- [ ] Request SES production access (remove 200 email/day sandbox limit)
- [ ] Set up SNS alerts for Step Functions failures
- [ ] Configure Lambda reserved concurrency (prevent runaway costs)
- [ ] Enable X-Ray tracing for distributed debugging
- [ ] Create backup/restore runbooks
- [ ] Document disaster recovery procedure
- [ ] Set up on-call rotation and incident response process

---

## Next Steps

Once deployed:

1. **Generate Training Data**: Send 10,000+ events with CLICK and SEND/PLAY_MOVIE types
2. **Train Model**: Run Step Functions pipeline (manual or wait for nightly)
3. **Test Prediction**: Call `/v1/decisions/preview` API and review Attention Escrow fields
4. **Schedule Notification**: Call `/v1/decisions/schedule` or send an event with `notification.deliveryMode = "OPTIMIZED"`
5. **Monitor Delivery**: Check CloudWatch logs, SES/SNS delivery, and AttentionLedger records

📖 [API Reference](API.md) • 📊 [Monitoring Guide](MONITORING.md) • 💰 [Cost Analysis](COST_ANALYSIS.md)

---

**Last Updated**: June 2026
