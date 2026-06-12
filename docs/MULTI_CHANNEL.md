# Multi-Channel Delivery Guide

## Overview

The Smart Notification Routing Engine now supports **two delivery channels**:
1. **Email** (Amazon SES v2)
2. **SMS** (Amazon SNS)

Users can specify their preferred channel, and the system will deliver notifications accordingly.

---

## Architecture Changes

### What Changed

**Before** (Pinpoint only):
```
Sender Lambda → Pinpoint → Email/SMS
```

**After** (Multi-channel):
```
Sender Lambda → SES (Email)
                → SNS (SMS)
```

### Why These Services?

| Service | Purpose | Cost | Sandbox Mode |
|---------|---------|------|-------------|
| **Amazon SES** | Transactional email | $0.10 per 1000 emails | ✅ Yes (verify recipients) |
| **Amazon SNS** | SMS delivery | $0.00645 per SMS (US) | ❌ No (works immediately) |

**Note**: Pinpoint is being deprecated in October 2026. This implementation future-proofs the system.

---

## User Profile Schema

### DynamoDB Structure

Users now have a `prefs` attribute in DynamoDB:

```json
{
  "pk": "USER#user_123",
  "sk": "PROFILE",
  "email": "user@example.com",
  "phone": "+14155551234",
  "prefs": {
    "channel": "EMAIL"  // or "SMS"
  },
  "counters": {
    "events": 100,
    "clicks": 45,
    "sends": 50
  }
}
```

### Channel Preference

- **Default**: `EMAIL` if not specified
- **Valid values**: `EMAIL` or `SMS`
- **Required fields**:
  - Email channel requires `email` attribute
  - SMS channel requires `phone` attribute (E.164 format: `+1XXXXXXXXXX`)

---

## Deployment Steps

### Step 1: Verify Sender Email in SES

**Important**: SES starts in sandbox mode. You can only send TO verified email addresses.

```bash
# Verify your sender email
aws sesv2 create-email-identity --email-identity notifications@yourdomain.com

# Check verification status
aws sesv2 get-email-identity --email-identity notifications@yourdomain.com

# Verify pilot tester emails (one per pilot user)
aws sesv2 create-email-identity --email-identity pilot.user1@example.com
aws sesv2 create-email-identity --email-identity pilot.user2@example.com
```

**Each recipient will receive a verification email** - they must click the link to verify.

### Step 2: Update .env File

```bash
cd infra/cdk
nano .env
```

Set your verified sender email:
```
SENDER_EMAIL=notifications@yourdomain.com
```

### Step 3: Build Services

```bash
cd /path/to/smart-notification-routing-engine
./scripts/build-services.sh
```

This rebuilds all Lambda functions including the updated Sender Service.

### Step 4: Deploy

```bash
cd infra/cdk
pnpm exec cdk deploy SR-Compute
```

**Expected changes**:
- Sender Lambda updated with new code
- IAM policy updated (SES + SNS permissions added)

---

## Testing Multi-Channel Delivery

### Test 1: Send Email

```bash
API_URL="https://your-api-id.execute-api.us-west-2.amazonaws.com"

# Create user with email preference
curl -X POST $API_URL/v1/users \
  -H "Authorization: Bearer $YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "pilot_user_1",
    "email": "pilot.user1@example.com",
    "prefs": {
      "channel": "EMAIL"
    }
  }'

# Trigger notification (goes to email)
curl -X POST $API_URL/v1/decisions/schedule \
  -H "Authorization: Bearer $YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "pilot_user_1",
    "windowStart": 1718186400,
    "windowEnd": 1718272800
  }'
```

**Expected**: Email arrives in `pilot.user1@example.com` inbox.

### Test 2: Send SMS

```bash
# Create user with SMS preference
curl -X POST $API_URL/v1/users \
  -H "Authorization: Bearer $YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "pilot_user_2",
    "email": "pilot.user2@example.com",
    "phone": "+14155551234",
    "prefs": {
      "channel": "SMS"
    }
  }'

# Trigger notification (goes to SMS)
curl -X POST $API_URL/v1/decisions/schedule \
  -H "Authorization: Bearer $YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "pilot_user_2",
    "windowStart": 1718186400,
    "windowEnd": 1718272800
  }'
```

**Expected**: SMS arrives at `+14155551234`.

### Test 3: Direct Send (API Gateway)

**Send email directly** (bypassing scheduling):
```bash
curl -X POST $API_URL/v1/send \
  -H "Authorization: Bearer $YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "EMAIL",
    "toAddress": "pilot.user1@example.com",
    "fromAddress": "notifications@yourdomain.com",
    "subject": "Test Notification",
    "templateBucket": "sr-data-curated-xxxxx",
    "templateKey": "templates/default-notification.html",
    "variables": {
      "userId": "pilot_user_1",
      "email": "pilot.user1@example.com"
    }
  }'
```

**Send SMS directly**:
```bash
curl -X POST $API_URL/v1/send \
  -H "Authorization: Bearer $YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "SMS",
    "toAddress": "+14155551234",
    "templateBucket": "sr-data-curated-xxxxx",
    "templateKey": "templates/default-notification.html",
    "variables": {
      "userId": "pilot_user_2",
      "phone": "+14155551234"
    }
  }'
```

---

## Monitoring

### CloudWatch Logs

**Sender Lambda logs**:
```bash
aws logs tail /aws/lambda/SR-Compute-SenderFn --follow
```

**Look for**:
- `Sending email to: xxx via SES` (email delivery)
- `Sending SMS to: xxx via SNS` (SMS delivery)
- `Email sent successfully` or `SMS sent successfully. MessageId: xxx`

### Check Delivery Status

**SES Email Tracking**:
```bash
# SES doesn't provide delivery tracking by default in sandbox
# For production: Enable Configuration Sets for bounce/complaint tracking
```

**SNS SMS Tracking**:
```bash
# Check CloudWatch Metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/SNS \
  --metric-name NumberOfMessagesPublished \
  --dimensions Name=TopicName,Value=SMS \
  --start-time 2026-06-12T00:00:00Z \
  --end-time 2026-06-12T23:59:59Z \
  --period 3600 \
  --statistics Sum
```

---

## Cost Analysis

### Email (SES)

| Volume | Cost/Month | Notes |
|--------|-----------|-------|
| 1,000 emails | $0.10 | First 62,000 free via AWS Free Tier |
| 10,000 emails | $1.00 | |
| 100,000 emails | $10.00 | |

**Calculation**: $0.10 per 1,000 emails

### SMS (SNS)

| Volume | Cost/Month (US) | Cost/Month (International) |
|--------|----------------|---------------------------|
| 100 SMS | $0.65 | $3-8 (varies by country) |
| 1,000 SMS | $6.45 | $30-80 |
| 10,000 SMS | $64.50 | $300-800 |

**Calculation**: $0.00645 per SMS (US domestic)

**Note**: SMS is **64x more expensive** than email. Use sparingly or charge customers accordingly.

---

## SES Sandbox Limitations

### What is Sandbox Mode?

All new SES accounts start in **sandbox mode**:
- ✅ Unlimited emails per day
- ❌ Can only send TO verified email addresses
- ❌ Can only send FROM verified domains/emails

### How to Verify Recipients

```bash
# Verify each pilot tester
aws sesv2 create-email-identity --email-identity pilot.user@example.com
```

Recipient receives email:
```
Subject: Amazon SES Email Address Verification Request

Please click the following link to verify your email address:
https://email-verification.us-west-2.amazonaws.com/...
```

They click → verified within 2-5 minutes.

### Requesting Production Access

**When**: After pilot with metrics showing real usage.

**How**:
1. Go to AWS Console → SES → Account Dashboard
2. Click "Request production access"
3. Provide:
   - Use case: "Transactional notifications for Smart Routing Engine pilot"
   - Daily send volume: "10,000 emails"
   - Bounce/complaint handling: "Automated removal via Configuration Sets"
   - Pilot metrics: "500 verified users, 20% click-through rate"

**Approval time**: 24-48 hours (usually)

---

## Phone Number Format (E.164)

SMS requires **E.164 format**:
```
+[country code][phone number]
```

**Examples**:
- US: `+14155551234` (not `415-555-1234` or `4155551234`)
- UK: `+447911123456`
- India: `+919876543210`

**Validation regex**:
```regex
^\+[1-9]\d{1,14}$
```

---

## Troubleshooting

### Error: "Email address is not verified"

**Problem**: Trying to send to unverified address in SES sandbox.

**Fix**:
```bash
aws sesv2 create-email-identity --email-identity recipient@example.com
```

Ask recipient to check email and click verification link.

---

### Error: "Invalid parameter: PhoneNumber"

**Problem**: Phone number not in E.164 format.

**Fix**: Ensure `+` prefix and country code:
```json
{
  "phone": "+14155551234"  // ✅ Correct
  // NOT "4155551234" or "415-555-1234"
}
```

---

### Error: "User has no email/phone"

**Problem**: User profile missing contact info for selected channel.

**Fix**: Update user profile via API:
```bash
curl -X PUT $API_URL/v1/users/user_123 \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "email": "user@example.com",
    "phone": "+14155551234"
  }'
```

---

### SMS Not Delivered

**Check SNS spending limit**:
```bash
aws sns get-sms-attributes
```

If `MonthlySpendLimit` is low, increase it:
```bash
aws sns set-sms-attributes \
  --attributes DefaultSMSType=Transactional,MonthlySpendLimit=100
```

---

## Migration from Pinpoint

### For Existing Deployments

If you have an existing deployment using Pinpoint:

1. **Keep Pinpoint temporarily** (backwards compatibility)
2. **Deploy multi-channel code** (Pinpoint code still works)
3. **Test SES + SNS** with pilot users
4. **Migrate users** to new channels
5. **Remove Pinpoint** after full migration

### Code Compatibility

Old Pinpoint code still works - `sendEmail()` method kept for backwards compatibility but marked as deprecated.

---

## Future Enhancements

### Planned Features

1. **Push Notifications** (via SNS Mobile Push)
2. **WhatsApp** (via Twilio API)
3. **Channel Selection ML**: Auto-select channel based on user engagement
4. **Delivery Tracking**: Bounce/complaint handling for SES
5. **SMS Delivery Reports**: SNS delivery receipts
6. **Multi-channel Fallback**: Try email → SMS if email bounces

---

## API Reference

### User Profile Endpoint

**Create/Update User with Channel Preference**:
```http
POST /v1/users
Content-Type: application/json
Authorization: Bearer {token}

{
  "userId": "user_123",
  "email": "user@example.com",
  "phone": "+14155551234",
  "prefs": {
    "channel": "EMAIL"  // or "SMS"
  }
}
```

**Response**:
```json
{
  "userId": "user_123",
  "created": true
}
```

### Direct Send Endpoint

**Send via Specific Channel**:
```http
POST /v1/send
Content-Type: application/json
Authorization: Bearer {token}

{
  "channel": "EMAIL",
  "toAddress": "user@example.com",
  "fromAddress": "notifications@yourdomain.com",
  "subject": "Your Notification",
  "templateBucket": "curated-bucket-name",
  "templateKey": "templates/welcome.html",
  "variables": {
    "userName": "John",
    "action": "verify email"
  }
}
```

**Response**:
```json
{
  "statusCode": 200,
  "channel": "EMAIL",
  "message": "Message sent successfully via EMAIL"
}
```

---

**Last Updated**: June 2026
