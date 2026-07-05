# Operations Runbook

This runbook helps adopters operate SNRE in their own AWS account. It focuses on
common checks, failure modes, and recovery steps.

## Key Runtime Paths

### Event Ingestion

```text
API Gateway -> Control Plane Lambda -> Kinesis -> Events Consumer Lambda
```

`POST /v1/events` returns after the event is queued to Kinesis. Delivery,
decisioning, S3 writes, and counter updates happen asynchronously.

### Optimized Notification

```text
Events Consumer -> Decision Service -> SageMaker or fallback -> Attention Escrow
              -> EventBridge Scheduler -> Sender Service -> SES/SNS
```

### Immediate Notification

```text
Events Consumer -> Sender Service -> SES/SNS
```

## Daily Checks

- CloudWatch Lambda errors for control plane, events consumer, decision service,
  sender service, and SES event processor
- Kinesis iterator age and throttling
- API Gateway 4xx/5xx rates
- DynamoDB throttling or hot partitions
- EventBridge schedules waiting or failed
- SES bounce and complaint trends
- SageMaker endpoint status or fallback usage
- AWS cost and service quotas

## Common Investigations

### `/v1/events` Returned 200 But No Message Arrived

Remember that `200` means the event was queued, not delivered.

Check:

```bash
aws logs tail /aws/lambda/SR-Compute-ControlPlaneFn --since 15m
aws logs tail /aws/lambda/SR-Compute-EventsConsumerFn --since 15m
aws logs tail /aws/lambda/SR-Compute-SenderFn --since 15m
```

Then verify:

- Kinesis consumer Lambda is receiving records
- event payload has `notification.deliveryMode`
- user has a valid email or phone
- SES/SNS permissions and quotas are available
- email is not on the suppression list

### Optimized Event Did Not Schedule

Check Decision Service logs:

```bash
aws logs tail /aws/lambda/SR-Compute-DecisionFn --since 15m
```

Possible causes:

- user profile missing or invalid
- window end is in the past
- Attention Escrow returned `DEFER`
- Scheduler IAM role cannot invoke Sender Service
- EventBridge Scheduler quota or validation failure

### Message Was Deferred

Use the Attention summary API or dashboard:

```text
GET /v1/attention/summary?userId=<userId>
GET /v1/attention/summary?sourceId=<sourceId>
```

Look at:

- `attentionCost`
- `attentionValue`
- `fatigueScore`
- `sourceTrustScore`
- `reason`
- `priorityClass`
- `messageCategory`

### SageMaker Endpoint Is Unavailable

Decision Service should continue with:

```text
modelSource = FALLBACK_HEURISTIC
modelConfidence = LOW_STARTUP_ESTIMATE
```

Check endpoint:

```bash
aws sagemaker describe-endpoint --endpoint-name send-time-v1
```

If no endpoint exists, the system can still operate in fallback mode until the
ML pipeline creates one.

### SES Bounce Or Complaint Handling

Check suppression list:

```bash
aws dynamodb scan --table-name email-suppression-list
```

Check SES event processor:

```bash
aws logs tail /aws/lambda/SESEventProcessor --since 30m
```

Use [SES production access guide](ses/SES_PRODUCTION_ACCESS.md) for simulator
validation.

### EventBridge Schedule Did Not Fire

Check schedule:

```bash
aws scheduler get-schedule --name <schedule-id>
```

Check:

- schedule expression timestamp
- timezone is UTC unless explicitly configured otherwise
- target Lambda ARN
- scheduler role permissions
- Sender Service logs around the scheduled time

## Rollback

For application code changes:

```bash
git checkout <previous-tag>
./scripts/build-services.sh
cd infra/cdk
pnpm exec cdk deploy --all
```

For frontend-only rollback, redeploy a previous frontend build to the S3 web
bucket and invalidate CloudFront.

## Data Retention

Adopters should define retention policies for:

- raw event S3 objects
- Attention Ledger records
- SES event logs
- suppression list TTL
- CloudWatch log groups

Retention requirements depend on the adopter's legal, security, and operational
environment.

