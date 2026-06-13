# Deploy Event-Driven Notification Fix

## Changes Summary

**Problem**: Sender Lambda couldn't handle event-driven notifications from Events Consumer

**Fixes**:
1. Added `message` and `metadata` fields to SendRequest class
2. Fixed event routing logic to properly detect EventBridge/Events Consumer calls

## Deploy on Personal PC

```bash
# 1. Pull latest code
cd smart-notification-routing-engine
git pull origin main

# 2. Review changes
git log --oneline -3
git diff HEAD~1

# 3. Commit (if not already committed)
git add .
git commit -m "Fix Sender Lambda event routing for event-driven notifications

- Add message and metadata fields to SendRequest class
- Update routing logic to check for templateBucket instead of event size
- Fixes S3 bucket null error when Events Consumer invokes Sender
- Enables immediate and optimized notification flows"

# 4. Rebuild Sender service
cd services/sender-service
mvn clean package

# 5. Verify JAR was built
ls -lh target/sender-service.jar

# 6. Redeploy
cd ../../infra/cdk
pnpm exec cdk deploy SR-Compute --require-approval never

# Wait for deployment (3-5 minutes)
```

## Test After Deployment

### Test 1: Immediate SMS Notification

```bash
API_URL="your-api-url"
TOKEN="your-jwt-token"

curl -X POST $API_URL/v1/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "pilot_user_1",
    "type": "ORDER_PLACED",
    "notificationType": "immediate",
    "message": "Your order #12345 has been confirmed!",
    "channel": "SMS",
    "metadata": {
      "orderId": "12345",
      "total": "$49.99"
    }
  }'
```

**Expected**: SMS arrives at your phone within 2 seconds

---

### Test 2: Check Logs

```bash
# Events Consumer (should show trigger)
aws logs tail /aws/lambda/SR-Compute-EventsConsumerFn --since 2m

# Look for:
# "Triggering immediate notification for user: pilot_user_1"
# "Sender invoked. Status: 200"

# Sender Lambda (should show successful send)
aws logs tail /aws/lambda/SR-Compute-SenderFn --since 2m

# Look for:
# "Event received: {message=..., userId=pilot_user_1, channel=SMS}"
# "Handling scheduled send for userId: pilot_user_1"
# "Using custom message from event"
# "Using requested channel: SMS"
# "Fetched user profile: ..."
# "statusCode: 200"
```

---

### Test 3: Verify SMS Delivery

If SMS doesn't arrive, check:

**1. Phone number format**:
```bash
aws dynamodb get-item \
  --table-name $(aws cloudformation describe-stacks --stack-name SR-Data \
    --query "Stacks[0].Outputs[?OutputKey=='UserProfilesTableName'].OutputValue" --output text) \
  --key '{"pk":{"S":"USER#pilot_user_1"},"sk":{"S":"PROFILE"}}' \
  --query 'Item.phone.S'

# Should return: "+16412339549" (E.164 format with country code)
```

**2. SNS permissions**:
```bash
# Check Sender Lambda has SNS permissions
aws lambda get-policy --function-name SR-Compute-SenderFn \
  | grep -o "sns:Publish"
```

**3. SNS SMS settings**:
```bash
# Check SMS attributes
aws sns get-sms-attributes

# Should show:
# - MonthlySpendLimit > 0
# - DefaultSMSType: Transactional
```

**4. Check SNS logs in CloudWatch**:
```bash
aws logs tail /aws/sns/us-west-2/$(aws sts get-caller-identity --query Account --output text)/DirectPublishToPhoneNumber --since 5m
```

---

## Troubleshooting

### Error: "Parameter 'Bucket' must not be null"

**Cause**: Old code still deployed (routing logic not updated)

**Fix**: Rebuild and redeploy (steps 4-6 above)

---

### Error: "User profile not found"

**Cause**: User doesn't exist in DynamoDB

**Fix**: Create user first
```bash
curl -X POST $API_URL/v1/users \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "userId": "pilot_user_1",
    "email": "yadab.us2023@gmail.com",
    "phone": "+16412339549",
    "prefs": {"channel": "SMS"}
  }'
```

---

### SMS not arriving but no errors

**Possible causes**:
1. **Phone carrier blocking**: Some carriers block AWS SNS messages
2. **SNS sandbox mode**: In sandbox, only verified numbers receive SMS
3. **SMS spending limit**: Default $1/month, may be exhausted

**Check SNS delivery**:
```bash
# Get recent SMS publishes
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=Publish \
  --max-results 10
```

**Request production access** (removes sandbox restrictions):
1. AWS Console → SNS → Text messaging → Mobile text messaging (SMS)
2. Click "Request production access"
3. Fill form with use case
4. Approval: 24-48 hours

---

## Success Indicators

✅ Events Consumer logs: `"Sender invoked. Status: 200"`

✅ Sender Lambda logs: `"Notification sent successfully"`

✅ No errors in CloudWatch logs

✅ SMS arrives at your phone

---

## Rollback (if needed)

```bash
# Get previous deployment
aws cloudformation describe-stacks --stack-name SR-Compute \
  --query 'Stacks[0].LastUpdatedTime'

# Revert to previous code
git revert HEAD
./scripts/build-services.sh
cd infra/cdk
pnpm exec cdk deploy SR-Compute
```

---

**Estimated time**: 10-15 minutes (including deployment)
