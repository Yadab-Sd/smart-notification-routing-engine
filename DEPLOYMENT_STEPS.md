# Deployment Steps for Event-Driven Notifications

## Changes Made

### 1. Events Consumer (Auto-Trigger Orchestrator)
- **File**: `services/events-consumer/pom.xml`
  - Added AWS Lambda SDK dependency
  
- **File**: `services/events-consumer/src/main/java/com/yadab/sr/eventsconsumer/Handler.java`
  - Added auto-trigger logic for notifications
  - Supports `notificationType: "immediate"` (send now)
  - Supports `notificationType: "optimized"` (ML-scheduled)
  - Invokes Sender Lambda or Decision Lambda based on type

### 2. Sender Service (Message Support)
- **File**: `services/sender-service/src/main/java/com/yadab/sr/sender/Handler.java`
  - Now accepts `message` field from event payload
  - Falls back to template if no custom message provided

### 3. Infrastructure (CDK)
- **File**: `infra/cdk/lib/compute-stack.ts`
  - Added `SENDER_FUNCTION_ARN` to Events Consumer environment
  - Added `DECISION_FUNCTION_ARN` to Events Consumer environment
  - Granted invoke permissions for Events Consumer → Sender/Decision

### 4. Documentation
- **File**: `docs/EVENT_DRIVEN_NOTIFICATIONS.md` (NEW)
  - Complete guide to event-driven architecture
  - Examples for immediate vs optimized notifications
  - Real-world use cases

---

## Deployment on Personal PC

Run these commands on your personal PC:

```bash
# 1. Pull latest code
git pull origin main

# 2. Rebuild Lambda services (Events Consumer and Sender changed)
cd smart-notification-routing-engine
./scripts/build-services.sh

# 3. Redeploy compute stack
cd infra/cdk
pnpm exec cdk deploy SR-Compute --require-approval never

# 4. Verify deployment
aws lambda get-function-configuration \
  --function-name SR-Compute-EventsConsumerFn \
  --query 'Environment.Variables' \
  --output json

# Should show:
# {
#   "EVENTS_BUCKET": "...",
#   "USER_TABLE": "...",
#   "SENDER_FUNCTION_ARN": "arn:aws:lambda:...",
#   "DECISION_FUNCTION_ARN": "arn:aws:lambda:..."
# }
```

---

## Testing Event-Driven Notifications

### Test 1: Immediate Notification

```bash
API_URL="https://your-api-id.execute-api.us-west-2.amazonaws.com"
TOKEN="your-jwt-token"

# Send event with immediate notification
curl -X POST $API_URL/v1/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "pilot_user_1",
    "type": "ORDER_PLACED",
    "notificationType": "immediate",
    "message": "Your order #12345 has been confirmed!",
    "channel": "EMAIL",
    "ts": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'

# Check email inbox (should arrive in < 2 seconds)

# Verify in CloudWatch logs
aws logs tail /aws/lambda/SR-Compute-EventsConsumerFn --follow
aws logs tail /aws/lambda/SR-Compute-SenderFn --follow
```

---

### Test 2: ML-Optimized Notification

```bash
# Send event with optimized notification
curl -X POST $API_URL/v1/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "pilot_user_1",
    "type": "CART_ABANDONED",
    "notificationType": "optimized",
    "message": "Complete your purchase! 3 items in cart.",
    "ts": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'

# Check that schedule was created
aws scheduler list-schedules \
  --query "Schedules[?starts_with(Name, 'send-email')]" \
  --output table

# Notification will be sent at ML-predicted optimal hour
```

---

### Test 3: Analytics Only (No Notification)

```bash
# Send event without notificationType
curl -X POST $API_URL/v1/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "pilot_user_1",
    "type": "CLICK",
    "ts": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'

# No notification sent, only recorded for ML training
# Check S3 raw events
aws s3 ls s3://sr-data-events.../raw/ --recursive
```

---

## Troubleshooting

### Events Consumer can't invoke Sender

**Check permissions**:
```bash
aws lambda get-policy --function-name SR-Compute-SenderFn
```

Should show Events Consumer has `lambda:InvokeFunction` permission.

**Fix**: Redeploy SR-Compute stack

---

### Immediate notifications not sending

**Check Events Consumer logs**:
```bash
aws logs tail /aws/lambda/SR-Compute-EventsConsumerFn --follow
```

Look for:
- `"Triggering immediate notification for user: ..."`
- `"Sender invoked. Status: 200"`

**Check Sender logs**:
```bash
aws logs tail /aws/lambda/SR-Compute-SenderFn --follow
```

Look for:
- `"Handling scheduled send for userId: ..."`
- `"Notification sent successfully"`

---

### Optimized notifications not scheduling

**Check Decision Service endpoint**:
```bash
aws sagemaker describe-endpoint --endpoint-name send-time-v1
```

Status should be `"InService"`.

**Check Events Consumer logs**:
```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/SR-Compute-EventsConsumerFn \
  --filter-pattern "Decision service invoked"
```

---

## Architecture Diagram

```
┌─────────────┐
│  Your App   │
└──────┬──────┘
       │ POST /v1/events {notificationType: "immediate"}
       ↓
┌─────────────────┐
│ Control Plane   │
│    Lambda       │
└──────┬──────────┘
       │ Put to Kinesis
       ↓
┌─────────────────┐
│ Kinesis Stream  │
└──────┬──────────┘
       │ Batch trigger
       ↓
┌─────────────────────┐
│ Events Consumer     │
│ Lambda              │
├─────────────────────┤
│ 1. Write S3/DDB     │
│ 2. Check notif type │
│ 3. Invoke Sender    │ ← NEW!
└──────┬──────────────┘
       │ Invoke
       ↓
┌─────────────────┐
│  Sender Lambda  │
├─────────────────┤
│ 1. Fetch user   │
│ 2. Select chan  │
│ 3. Send SES/SNS │
└─────────────────┘
```

---

## Next Steps

1. **Deploy changes** (rebuild services + redeploy SR-Compute)
2. **Test immediate notifications** (order confirmations)
3. **Test optimized notifications** (cart abandonment)
4. **Monitor CloudWatch logs** (verify auto-triggering works)
5. **Update your application** to use `notificationType` field

---

**Estimated deployment time**: 5-10 minutes

**Breaking changes**: None (backward compatible)

**Rollback plan**: Redeploy previous CDK version
