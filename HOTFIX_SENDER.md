# HOTFIX: Sender Lambda Event Routing Issues

## Problem 1: Parsing Error

Sender Lambda fails with:
```
Unrecognized field "metadata" (class SendRequest)
Unrecognized field "message" (class SendRequest)
```

**Root Cause**: Events Consumer sends `message` and `metadata` fields, but Sender's `SendRequest` class doesn't have these fields.

**Fix**: Added `message` and `metadata` fields to `SendRequest` class

---

## Problem 2: Wrong Route (S3 Template Error)

After fix #1, Lambda fails with:
```
Parameter 'Bucket' must not be null
```

**Root Cause**: Event routing logic uses `event.size() <= 3` to detect scheduled sends, but events with `message`/`metadata`/`channel` have 4+ fields, so they route to `handleDirectSend()` which expects S3 template.

**Fix**: Changed routing logic to check for `templateBucket`/`templateKey` fields instead of event size.

---

## Fixes Applied

1. Added `message` and `metadata` fields to `SendRequest` class
2. Updated event routing in `handleRequest()` method:
   - `templateBucket` + `templateKey` → API Gateway call (S3 template)
   - `userId` only → EventBridge/Events Consumer call (inline message)

Both fixes in: `services/sender-service/src/main/java/com/yadab/sr/sender/Handler.java`

## Deploy on Personal PC

```bash
# 1. Pull latest code
git pull origin main

# 2. Rebuild Sender service only
cd services/sender-service
mvn clean package
cd ../..

# 3. Redeploy SR-Compute stack
cd infra/cdk
pnpm exec cdk deploy SR-Compute --require-approval never

# Wait for deployment (~3-5 minutes)
```

## Test Again

After deployment, retry sending immediate notification:

```bash
API_URL="your-api-url"
TOKEN="your-token"

curl -X POST $API_URL/v1/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "pilot_user_1",
    "type": "ORDER_PLACED",
    "notificationType": "immediate",
    "message": "Your order #12345 has been confirmed!",
    "channel": "SMS",
    "ts": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "metadata": {
      "orderId": "12345",
      "total": "$49.99"
    }
  }'
```

## Verify

```bash
# Check Sender Lambda logs (should show successful send)
aws logs tail /aws/lambda/SR-Compute-SenderFn --since 5m

# Should see:
# "Event received: {metadata=..., message=..., userId=pilot_user_1, channel=SMS}"
# "Handling scheduled send for userId: pilot_user_1"
# "Using custom message from event"
# "Notification sent successfully"
```

## Check SMS Delivery

After successful Lambda execution, check:

1. **SNS Delivery Status**:
```bash
# Get SNS message ID from Sender logs
aws sns get-sms-attributes
```

2. **Phone Number Format**: Must be E.164 (+14155551234)
```bash
# Check user's phone in DynamoDB
aws dynamodb get-item \
  --table-name SR-Data-UserProfiles... \
  --key '{"pk":{"S":"USER#pilot_user_1"},"sk":{"S":"PROFILE"}}'
```

3. **SNS SMS Settings**:
```bash
# Check if SMS is enabled
aws sns get-sms-attributes --query 'attributes'
```

## Common SMS Issues

1. **Phone not E.164**: Update user phone
```bash
curl -X PUT $API_URL/v1/users/pilot_user_1 \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"phone": "+14155551234"}'
```

2. **SNS SMS not enabled in region**: Use us-east-1 or us-west-2

3. **SMS spending limit reached**: Check AWS SNS console → Text messaging → Spending limits
