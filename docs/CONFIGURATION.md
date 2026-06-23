# Configuration Guide

## Environment Variables

### Required Configuration

**Location**: `infra/cdk/.env`

```bash
# Sender email address (must be verified in Amazon SES)
SENDER_EMAIL=notifications@yourdomain.com
```

---

## SES Email Verification

### Sandbox Mode (Pilot)

All new AWS accounts start in SES sandbox mode.

**Verify sender email**:
```bash
aws sesv2 create-email-identity --email-identity notifications@yourdomain.com
```

**Verify recipient emails** (for pilot testing):
```bash
aws sesv2 create-email-identity --email-identity pilot.user1@example.com
aws sesv2 create-email-identity --email-identity pilot.user2@example.com
```

Each recipient receives verification email with link to click.

**Check verification status**:
```bash
aws sesv2 get-email-identity --email-identity notifications@yourdomain.com
```

Look for `"VerificationStatus": "SUCCESS"`.

### Production Access

**Request production access** after pilot:
1. Go to AWS Console → SES → Account Dashboard
2. Click "Request production access"
3. Provide use case and metrics
4. Approval time: 24-48 hours

---

## AWS Region Configuration

**Default region**: `us-west-2`

To change region:

1. Update `infra/cdk/.env`:
```bash
AWS_REGION=us-east-1
```

2. Bootstrap CDK in new region:
```bash
cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/us-east-1
```

3. Deploy:
```bash
cd infra/cdk
pnpm exec cdk deploy --all
```

---

## CloudFormation Outputs

After deployment, get important values:

**API URL**:
```bash
aws cloudformation describe-stacks --stack-name SR-Compute \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text
```

**User Profiles Table**:
```bash
aws cloudformation describe-stacks --stack-name SR-Data \
  --query "Stacks[0].Outputs[?OutputKey=='UserProfilesTableName'].OutputValue" --output text
```

**Events Bucket**:
```bash
aws cloudformation describe-stacks --stack-name SR-Data \
  --query "Stacks[0].Outputs[?OutputKey=='EventsBucketName'].OutputValue" --output text
```

---

## Lambda Configuration

### Memory & Timeout

Default settings:
- Control Plane: 1024MB, 15s timeout
- Events Consumer: 512MB, 30s timeout
- Decision Service: 1024MB, 20s timeout
- Sender Service: 1024MB, 20s timeout

To adjust (in `infra/cdk/lib/compute-stack.ts`):
```typescript
const controlPlane = new lambda.Function(this, 'ControlPlaneFn', {
    memorySize: 2048,  // Increase memory
    timeout: cdk.Duration.seconds(30),  // Increase timeout
    // ...
});
```

### SnapStart

Java Lambda functions use SnapStart for faster cold starts (80% reduction).

**Already enabled**:
```typescript
snapStart: lambda.SnapStartConf.ON_PUBLISHED_VERSIONS
```

---

## DynamoDB Configuration

**Billing mode**: On-demand (pay per request)

To switch to provisioned capacity (for predictable traffic):

```typescript
// infra/cdk/lib/data-stack.ts
this.profilesTable = new ddb.Table(this, 'UserProfiles', {
    billingMode: ddb.BillingMode.PROVISIONED,
    readCapacity: 100,  // RCU
    writeCapacity: 50,  // WCU
    // ...
});
```

**Point-in-time recovery**: Enabled by default

---

## Kinesis Configuration

**Default sharding**: 1 shard

**Capacity per shard**:
- Write: 1MB/sec or 1,000 records/sec
- Read: 2MB/sec

To increase shards (for higher traffic):

```typescript
// infra/cdk/lib/data-stack.ts
this.userEvents = new kinesis.Stream(this, 'UserEvents', {
    shardCount: 5,  // Scale to 5 shards
    // ...
});
```

---

## SageMaker Configuration

**ML endpoint**: ml.m5.large (2 vCPU, 8GB RAM)

**Auto-scaling**:
- Min instances: 1
- Max instances: 3
- Target metric: 1000 invocations/instance

To adjust instance type:

```typescript
// infra/cdk/lib/ml-stack.ts
endpointConfig = {
    instanceType: 'ml.m5.xlarge',  // Larger instance
    initialInstanceCount: 2,  // Start with 2
    // ...
}
```

---

## Glue ETL Configuration

**Worker type**: G.1X (4 vCPU, 16GB RAM)

**Default workers**: 2

To increase for larger datasets:

```typescript
// infra/cdk/lib/ml-stack.ts
const glueJob = new glue.CfnJob(this, 'FeatureEngineeringJob', {
    maxCapacity: 10,  // 10 DPU (5 workers)
    // ...
});
```

---

## VPC Configuration

**CIDR**: 10.0.0.0/16

**Subnets**:
- Public: 10.0.1.0/24, 10.0.2.0/24 (2 AZs)
- Private: 10.0.11.0/24, 10.0.12.0/24 (2 AZs)

**NAT Gateway**: Enabled ($32/month)

To disable NAT (cost savings):
- Remove NAT Gateway
- Add VPC endpoints for S3, DynamoDB, Kinesis
- Lambda functions will use endpoints instead

---

## Cognito Configuration

**User Pool**: Email/password authentication

**Token expiry**:
- Access token: 1 hour
- Refresh token: 30 days

To adjust:

```typescript
// infra/cdk/lib/identity-stack.ts
const userPool = new cognito.UserPool(this, 'UserPool', {
    accessTokenValidity: cdk.Duration.hours(2),  // Longer validity
    refreshTokenValidity: cdk.Duration.days(60),
    // ...
});
```

---

## ML Training Schedule

**Default**: Daily at 02:00 UTC

```env
ENABLE_ML_SCHEDULE=true
ML_PIPELINE_CRON=cron(0 2 * * ? *)
```

Set `ENABLE_ML_SCHEDULE=false` to deploy the system without automatic Glue/SageMaker training cost. Decision Service still works through `modelSource: "FALLBACK_HEURISTIC"` until the SageMaker endpoint is available.

To change schedule:

```env
ML_PIPELINE_CRON=cron(0 4 * * ? *)
```

---

## S3 Lifecycle Policies

**Default retention**:
- Raw events: 365 days
- Archive to Glacier: 90 days
- Models: No expiration

To adjust:

```typescript
// infra/cdk/lib/data-stack.ts
this.eventsBucket.addLifecycleRule({
    transitions: [{
        storageClass: s3.StorageClass.GLACIER,
        transitionAfter: cdk.Duration.days(180),  // Longer retention
    }],
    expiration: cdk.Duration.days(730),  // 2 years
});
```

---

## CloudWatch Log Retention

**Default**: 7 days

To increase:

```typescript
// infra/cdk/lib/compute-stack.ts
const controlPlane = new lambda.Function(this, 'ControlPlaneFn', {
    logRetention: logs.RetentionDays.ONE_MONTH,  // 30 days
    // ...
});
```

---

## API Gateway Configuration

**Rate limiting**:
- Burst: 5000 requests/second
- Steady: 10000 requests/second

**CORS**:
- Local origins are included automatically: localhost:3000, localhost:5173
- Allowed methods: GET, POST, PUT, DELETE, OPTIONS
- Allowed headers: Content-Type, Authorization, X-Organization-Id

To add production origins, configure `infra/cdk/.env`:

```bash
# Automatically adds https://yourdomain.com
CUSTOM_DOMAIN=yourdomain.com
```

Then redeploy Compute:

```bash
./scripts/deploy-infra.sh SR-Compute
```

---

## Cost Optimization Settings

### 1. Remove NAT Gateway ($32/month savings)

Use VPC endpoints instead:

```typescript
// Add VPC endpoints
vpc.addInterfaceEndpoint('KinesisEndpoint', {
    service: ec2.InterfaceVpcEndpointAwsService.KINESIS_STREAMS,
});

vpc.addGatewayEndpoint('S3Endpoint', {
    service: ec2.GatewayVpcEndpointAwsService.S3,
});

vpc.addGatewayEndpoint('DynamoDBEndpoint', {
    service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
});
```

### 2. SageMaker Serverless Inference

For low-traffic systems:

```typescript
const endpoint = new sagemaker.CfnEndpoint(this, 'Endpoint', {
    endpointConfigName: {
        serverlessConfig: {
            memorySizeInMB: 2048,
            maxConcurrency: 5,
        },
    },
});
```

---

## Monitoring Configuration

### CloudWatch Alarms

**Lambda errors**:
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name SR-Lambda-Errors \
  --alarm-description "Alert on Lambda errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold
```

**Kinesis iterator age**:
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name SR-Kinesis-Lag \
  --metric-name GetRecords.IteratorAgeMilliseconds \
  --namespace AWS/Kinesis \
  --statistic Maximum \
  --period 60 \
  --threshold 60000 \
  --comparison-operator GreaterThanThreshold
```

---

## Secrets Management

For sensitive configuration (API keys, tokens):

**Store in AWS Secrets Manager**:
```bash
aws secretsmanager create-secret \
  --name SR/TwilioApiKey \
  --secret-string "your-api-key"
```

**Access from Lambda**:
```typescript
const secret = secretsmanager.Secret.fromSecretNameV2(this, 'TwilioKey', 'SR/TwilioApiKey');
secret.grantRead(lambda);

// In Lambda code:
const secretValue = await client.getSecretValue({ SecretId: 'SR/TwilioApiKey' }).promise();
```

---

## Feature Flags

For gradual rollout of new features:

**Use AWS AppConfig**:
```bash
aws appconfig create-application --name SmartRouter
aws appconfig create-environment --application-id xxx --name production
```

**In Lambda code**:
```java
boolean useNewChannel = appConfig.getBoolean("enable-push-notifications");
if (useNewChannel) {
    // New feature code
}
```

---

**Last Updated**: June 2026
