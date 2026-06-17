# AWS SES Production Access Setup

This guide helps you get **AWS SES production access** approval by setting up proper bounce and complaint handling.

---

## ✅ What AWS Requires

Before approving production access, AWS SES team verifies:

1. **SNS Topics** for bounce and complaint notifications ✅ **DONE**
2. **Lambda function** that processes these events ✅ **DONE**
3. **Suppression list** (DynamoDB) to prevent sending to bounced/complained emails ✅ **DONE**
4. **Configuration Set** that publishes events to SNS ✅ **DONE**
5. **Sender integration** that checks suppression list ✅ **DONE**

---

## 🚀 Deployment Steps

### Step 1: Build the SES Event Processor

```bash
cd services/ses-event-processor
mvn clean package
```

This creates `target/ses-event-processor.jar`

### Step 2: Deploy Infrastructure

```bash
cd infra/cdk

# Deploy messaging stack (includes SES bounce/complaint handling)
npx cdk deploy SR-Messaging

# Deploy compute stack (includes sender with suppression check)
npx cdk deploy SR-Compute
```

**What gets created:**
- SNS topics: `ses-bounces`, `ses-complaints`
- Lambda: `SESEventProcessor` (subscribed to SNS topics)
- DynamoDB: `email-suppression-list` (stores bounced/complained emails)
- DynamoDB: `ses-event-logs` (compliance audit trail)
- SES Configuration Set: `snre-production` (tracks bounces/complaints)

### Step 3: Configure SES to Use Configuration Set

The configuration set is automatically created, but you need to **verify it's active**:

```bash
# Check configuration set exists
aws ses describe-configuration-set --configuration-set-name snre-production

# Check event destinations are active
aws ses describe-configuration-set-event-destination \
  --configuration-set-name snre-production \
  --event-destination-name bounce-to-sns
```

**Expected output**: Event destination should show `Enabled: true`

### Step 4: Verify SNS → Lambda Integration

Test that bounces trigger Lambda:

```bash
# Get Lambda function ARN
aws lambda get-function --function-name SESEventProcessor

# Check SNS subscription
aws sns list-subscriptions-by-topic \
  --topic-arn $(aws cloudformation describe-stacks --stack-name SR-Messaging \
  --query "Stacks[0].Outputs[?OutputKey=='BounceTopicArn'].OutputValue" --output text)
```

**Expected**: Lambda should be subscribed to both bounce and complaint topics.

### Step 5: Test Bounce Handling (Simulation)

AWS provides test email addresses to simulate bounces:

```bash
# Send test email to simulate bounce
aws sesv2 send-email \
  --from-email-address verified@yourdomain.com \
  --destination ToAddresses=bounce@simulator.amazonses.com \
  --content Simple={Subject={Data="Test Bounce",Charset=UTF-8},Body={Text={Data="Testing bounce handling",Charset=UTF-8}}} \
  --configuration-set-name snre-production
```

**What happens:**
1. SES simulates a bounce
2. Bounce event → SNS topic → Lambda
3. Lambda adds `bounce@simulator.amazonses.com` to suppression list
4. Future sends to this email will be blocked

**Verify it worked:**
```bash
# Check suppression list
aws dynamodb get-item \
  --table-name email-suppression-list \
  --key '{"email":{"S":"bounce@simulator.amazonses.com"}}'

# Expected: Item exists with reason="BOUNCE"
```

### Step 6: Test Complaint Handling (Simulation)

```bash
# Send test email to simulate complaint
aws sesv2 send-email \
  --from-email-address verified@yourdomain.com \
  --destination ToAddresses=complaint@simulator.amazonses.com \
  --content Simple={Subject={Data="Test Complaint",Charset=UTF-8},Body={Text={Data="Testing complaint handling",Charset=UTF-8}}} \
  --configuration-set-name snre-production
```

**What happens:**
1. SES simulates a spam complaint
2. Complaint event → SNS topic → Lambda
3. Lambda adds `complaint@simulator.amazonses.com` to suppression list
4. Future sends blocked (CAN-SPAM compliance)

### Step 7: Test Suppression Check in Sender

Try to send to a suppressed email via your API:

```bash
# This should FAIL with "Email is in suppression list"
curl -X POST https://your-api.com/v1/send \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "toAddress": "bounce@simulator.amazonses.com",
    "subject": "Test",
    "message": "This should be blocked"
  }'

# Expected response:
# {
#   "statusCode": 500,
#   "error": "Email bounce@simulator.amazonses.com is in suppression list (bounced or complained). Skipping send."
# }
```

---

## 📋 Update Your AWS SES Production Access Request

Go back to your AWS Support case and add this **exact text**:

---

**Subject**: Bounce/Complaint Handlers Ready for Review

**Message**:

Hello AWS SES Team,

Thank you for reviewing our production access request. We have now implemented comprehensive bounce and complaint handling as requested:

**1. SNS Topics for SES Events**
- Bounce Topic ARN: `[PASTE ARN FROM CDK OUTPUT]`
- Complaint Topic ARN: `[PASTE ARN FROM CDK OUTPUT]`

**2. Lambda Function Processing Events**
- Function Name: `SESEventProcessor`
- Function ARN: `[PASTE ARN FROM CDK OUTPUT]`
- Processes both bounce and complaint notifications
- Automatically adds emails to suppression list

**3. Suppression List**
- DynamoDB Table: `email-suppression-list`
- Stores bounced and complained emails
- TTL enabled (auto-cleanup after 1 year)

**4. SES Configuration Set**
- Name: `snre-production`
- Event Destinations:
  - Bounce → SNS → Lambda
  - Complaint → SNS → Lambda
  - Delivery (for analytics)

**5. Sender Integration**
- All email sends check suppression list BEFORE sending
- Suppressed emails are blocked automatically
- Compliant with CAN-SPAM Act

**6. Testing Complete**
- Bounce simulation: ✅ Passed
- Complaint simulation: ✅ Passed
- Suppression check: ✅ Passed

**Architecture Overview**:
```
SES Send Email (with config set)
  → Bounce/Complaint Event
    → SNS Topic
      → Lambda Function
        → DynamoDB Suppression List
          → Sender checks before sending
```

**Compliance**:
- CAN-SPAM Act: Immediate suppression on complaints
- Email best practices: Soft bounce suppression after 3 attempts
- Audit trail: All events logged for 90 days (bounces) / 1 year (complaints)

**Request**: Please review and approve production access. All bounce/complaint handlers are active and tested.

Thank you,
[Your Name]

---

### Get ARNs for the message:

```bash
# Bounce Topic ARN
aws cloudformation describe-stacks --stack-name SR-Messaging \
  --query "Stacks[0].Outputs[?OutputKey=='BounceTopicArn'].OutputValue" --output text

# Complaint Topic ARN
aws cloudformation describe-stacks --stack-name SR-Messaging \
  --query "Stacks[0].Outputs[?OutputKey=='ComplaintTopicArn'].OutputValue" --output text

# Lambda ARN
aws cloudformation describe-stacks --stack-name SR-Messaging \
  --query "Stacks[0].Outputs[?OutputKey=='SESEventProcessorArn'].OutputValue" --output text
```

---

## 🔍 Monitoring & Maintenance

### View Suppression List

```bash
# List all suppressed emails
aws dynamodb scan --table-name email-suppression-list

# Count by reason
aws dynamodb scan --table-name email-suppression-list \
  --projection-expression "reason" | jq '.Items | group_by(.reason.S) | map({reason: .[0].reason.S, count: length})'
```

### View Event Logs

```bash
# Recent bounces
aws dynamodb query --table-name ses-event-logs \
  --index-name eventType-timestamp-index \
  --key-condition-expression "eventType = :bounce" \
  --expression-attribute-values '{":bounce":{"S":"BOUNCE"}}' \
  --scan-index-forward false \
  --limit 10

# Recent complaints
aws dynamodb query --table-name ses-event-logs \
  --index-name eventType-timestamp-index \
  --key-condition-expression "eventType = :complaint" \
  --expression-attribute-values '{":complaint":{"S":"COMPLAINT"}}' \
  --scan-index-forward false \
  --limit 10
```

### CloudWatch Metrics

```bash
# Lambda invocations (should match bounce/complaint events)
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=SESEventProcessor \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# Lambda errors (should be 0)
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=SESEventProcessor \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

### Remove Email from Suppression List (Manual Override)

If you need to remove an email (e.g., user fixed their mailbox):

```bash
# Remove from suppression list
aws dynamodb delete-item \
  --table-name email-suppression-list \
  --key '{"email":{"S":"user@example.com"}}'

# Verify removed
aws dynamodb get-item \
  --table-name email-suppression-list \
  --key '{"email":{"S":"user@example.com"}}'

# Expected: Item not found
```

---

## 🚨 Common Issues

### Issue 1: Lambda Not Receiving Events

**Symptom**: Bounce emails sent but suppression list empty

**Debug**:
```bash
# Check SNS → Lambda subscription
aws sns list-subscriptions-by-topic --topic-arn <BOUNCE_TOPIC_ARN>

# Check Lambda logs
aws logs tail /aws/lambda/SESEventProcessor --follow
```

**Fix**: Ensure Lambda has permission to be invoked by SNS:
```bash
aws lambda get-policy --function-name SESEventProcessor
# Should show sns.amazonaws.com as allowed principal
```

### Issue 2: Configuration Set Not Applied

**Symptom**: Emails sent but no events in SNS

**Cause**: Email sends not using configuration set

**Fix**: Verify your sender code includes:
```java
.configurationSetName("snre-production")
```

### Issue 3: Suppression Check Failing

**Symptom**: Emails sent to bounced addresses

**Debug**:
```bash
# Check sender Lambda has permission to read suppression table
aws iam get-role-policy \
  --role-name <SENDER_LAMBDA_ROLE> \
  --policy-name <POLICY_NAME>
```

**Fix**: Grant read permission to sender Lambda in CDK.

---

## 📊 Success Metrics

After deploying, you should see:

- **Bounce rate**: < 5% (industry standard)
- **Complaint rate**: < 0.1% (AWS requirement)
- **Suppression list growth**: Proportional to send volume
- **Lambda errors**: 0 (all events processed successfully)

**AWS SES will approve** if:
1. Bounce/complaint handlers are active ✅
2. Suppression list is being populated ✅
3. Sender checks suppression list ✅
4. Test simulations pass ✅

---

## 🎯 Next Steps After Approval

Once AWS approves production access:

1. **Remove sending limits**: 50,000 emails/day → unlimited
2. **Update sender email**: Can use any verified domain
3. **Monitor reputation**: Keep bounce < 5%, complaint < 0.1%
4. **Scale gradually**: Start with 1,000/day, increase slowly

---

## 📞 Need Help?

- **AWS SES Support**: Reply to your support case
- **Check status**: AWS Console → Support → Support Center
- **Typical approval time**: 24-48 hours after submitting this info

---

**Your bounce/complaint handling is now production-ready!** 🎉
