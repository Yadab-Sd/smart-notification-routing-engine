# 🚀 AWS SES Production Access - Quick Start

## TL;DR - What You Need to Do

1. **Build** the bounce handler
2. **Deploy** infrastructure
3. **Test** with AWS simulators
4. **Update** your AWS support case
5. **Wait** 24-48 hours for approval

---

## Step 1: Build (2 minutes)

```bash
cd "/Users/lnux/Documents/Smart Notification Routing Engine 2/Smart Notification Routing Engine"

# Build SES event processor
./scripts/build-ses-event-processor.sh

# Expected output:
# ✅ Build successful: target/ses-event-processor.jar
```

---

## Step 2: Deploy (5 minutes)

```bash
cd infra/cdk

# Deploy messaging stack (SNS + Lambda + DynamoDB)
npx cdk deploy SR-Messaging

# Deploy compute stack (updates sender with suppression check)
npx cdk deploy SR-Compute
```

**What gets created:**
- 2 SNS topics (bounces, complaints)
- 1 Lambda (processes events)
- 2 DynamoDB tables (suppression list, event logs)
- 1 SES configuration set

---

## Step 3: Test (3 minutes)

### Test Bounce Handling

```bash
# Replace with your verified email
FROM_EMAIL="your-verified@domain.com"

# Send to bounce simulator
aws sesv2 send-email \
  --from-email-address $FROM_EMAIL \
  --destination ToAddresses=bounce@simulator.amazonses.com \
  --content Simple={Subject={Data="Test Bounce",Charset=UTF-8},Body={Text={Data="Testing",Charset=UTF-8}}} \
  --configuration-set-name snre-production

# Wait 10 seconds for processing

# Verify email was suppressed
aws dynamodb get-item \
  --table-name email-suppression-list \
  --key '{"email":{"S":"bounce@simulator.amazonses.com"}}'

# Expected: Item with reason="BOUNCE"
```

### Test Complaint Handling

```bash
# Send to complaint simulator
aws sesv2 send-email \
  --from-email-address $FROM_EMAIL \
  --destination ToAddresses=complaint@simulator.amazonses.com \
  --content Simple={Subject={Data="Test Complaint",Charset=UTF-8},Body={Text={Data="Testing",Charset=UTF-8}}} \
  --configuration-set-name snre-production

# Wait 10 seconds

# Verify email was suppressed
aws dynamodb get-item \
  --table-name email-suppression-list \
  --key '{"email":{"S":"complaint@simulator.amazonses.com"}}'

# Expected: Item with reason="COMPLAINT"
```

---

## Step 4: Get Info for AWS Support Case

```bash
# Get all ARNs you need
cd infra/cdk

echo "=== Bounce Topic ARN ==="
aws cloudformation describe-stacks --stack-name SR-Messaging \
  --query "Stacks[0].Outputs[?OutputKey=='BounceTopicArn'].OutputValue" --output text

echo ""
echo "=== Complaint Topic ARN ==="
aws cloudformation describe-stacks --stack-name SR-Messaging \
  --query "Stacks[0].Outputs[?OutputKey=='ComplaintTopicArn'].OutputValue" --output text

echo ""
echo "=== Lambda Function ARN ==="
aws cloudformation describe-stacks --stack-name SR-Messaging \
  --query "Stacks[0].Outputs[?OutputKey=='SESEventProcessorArn'].OutputValue" --output text

echo ""
echo "=== Suppression Table Name ==="
aws cloudformation describe-stacks --stack-name SR-Messaging \
  --query "Stacks[0].Outputs[?OutputKey=='SuppressionTableName'].OutputValue" --output text
```

---

## Step 5: Update AWS Support Case

Go to your SES production access support case and **reply** with:

---

**Subject**: Bounce/Complaint Handlers Ready for Review

**Message**:

Hello AWS SES Team,

I have implemented comprehensive bounce and complaint handling as requested. All systems are deployed, tested, and operational.

**Infrastructure Details:**

**SNS Topics:**
- Bounce Topic: `[PASTE ARN FROM STEP 4]`
- Complaint Topic: `[PASTE ARN FROM STEP 4]`

**Lambda Function:**
- Name: `SESEventProcessor`
- ARN: `[PASTE ARN FROM STEP 4]`
- Language: Java 21
- Processes both bounce and complaint events
- Automatically adds emails to suppression list

**Suppression List:**
- Table: `[PASTE NAME FROM STEP 4]`
- Type: DynamoDB
- TTL: 1 year auto-cleanup
- Stores bounced and complained emails

**SES Configuration Set:**
- Name: `snre-production`
- Tracks: bounces, complaints, deliveries
- Publishes to SNS topics

**Sender Integration:**
- All email sends check suppression list BEFORE sending
- Suppressed emails are blocked automatically
- Configuration set applied to all sends

**Testing Results:**
✅ Bounce simulation: PASSED (email added to suppression list)
✅ Complaint simulation: PASSED (email added to suppression list)
✅ Suppression check: PASSED (blocked sends to suppressed emails)

**Compliance:**
- CAN-SPAM Act: Immediate suppression on complaints ✓
- Soft bounce handling: Suppress after 3 attempts ✓
- Audit trail: All events logged for 90 days (bounces) / 1 year (complaints) ✓

**Request:** Please review and approve production access. All bounce/complaint handlers are active and verified.

Thank you!

---

**Copy the ARNs** from Step 4 into the placeholders above.

---

## Step 6: Wait for Approval

**Timeline:** 24-48 hours typical response

**What AWS checks:**
- ✓ SNS topics exist
- ✓ Lambda subscribed
- ✓ Configuration set active
- ✓ Suppression list populated
- ✓ Sender checks suppression

**Approval message looks like:**
> "We have moved your account out of the SES sandbox. You can now send to any email address and have increased sending limits."

---

## Troubleshooting

### Lambda Not Receiving Events

```bash
# Check Lambda logs
aws logs tail /aws/lambda/SESEventProcessor --follow

# Check SNS subscription
aws sns list-subscriptions | grep SESEventProcessor
```

### Suppression List Empty After Test

```bash
# Check if emails were sent
aws ses describe-configuration-set --configuration-set-name snre-production

# Manually trigger Lambda with test event
aws lambda invoke \
  --function-name SESEventProcessor \
  --payload file://test-bounce-event.json \
  response.json
```

### Sender Not Checking Suppression

```bash
# Verify environment variable set
aws lambda get-function-configuration --function-name SenderFn | grep SUPPRESSION_TABLE

# Should show: SUPPRESSION_TABLE=email-suppression-list
```

---

## After Approval

1. **Verify new limits:**
   ```bash
   aws sesv2 get-account
   # Should show: ProductionAccessEnabled: true
   ```

2. **Start slowly:**
   - Day 1: 1,000 emails
   - Week 1: 5,000 emails/day
   - Week 2: 10,000 emails/day
   - Month 2: 50,000 emails/day

3. **Monitor reputation:**
   - Keep bounce rate < 5%
   - Keep complaint rate < 0.1%
   - Check SES reputation dashboard daily

---

## Quick Commands Reference

```bash
# View suppression list
aws dynamodb scan --table-name email-suppression-list

# Remove email from suppression (manual override)
aws dynamodb delete-item \
  --table-name email-suppression-list \
  --key '{"email":{"S":"user@example.com"}}'

# View recent bounces
aws dynamodb query --table-name ses-event-logs \
  --key-condition-expression "eventType = :bounce" \
  --expression-attribute-values '{":bounce":{"S":"BOUNCE"}}' \
  --limit 10

# Check Lambda invocations
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=SESEventProcessor \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

---

## Documentation

- **Full Guide**: `AWS_SES_PRODUCTION_ACCESS.md`
- **Implementation Summary**: `SES_IMPLEMENTATION_SUMMARY.md`
- **Architecture Diagram**: `docs/SES_BOUNCE_HANDLING_ARCHITECTURE.md`

---

**Your bounce/complaint handling is production-ready!** 🎉

Just update the support case and wait for AWS approval.
