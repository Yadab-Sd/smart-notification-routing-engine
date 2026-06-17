# SES Bounce & Complaint Handling Architecture

## Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         NORMAL EMAIL SEND                                │
└─────────────────────────────────────────────────────────────────────────┘

   User Event               Control Plane            Sender Lambda
   ┌────────┐              ┌──────────┐             ┌─────────────┐
   │        │              │          │             │             │
   │  POST  │─────────────▶│  Ingest  │────────────▶│ 1. Check   │
   │ /events│              │  Event   │             │  Suppression│
   │        │              │          │             │  List       │
   └────────┘              └──────────┘             │             │
                                                     │ 2. If OK    │
                                ┌────────────────────│  Send Email │
                                │                    │  via SES    │
                                │                    └─────────────┘
                                │                           │
                                │                           │
                                │                           ▼
                                │                    ┌─────────────┐
                                │                    │   AWS SES   │
                                │                    │ (with config│
                                │                    │     set)    │
                                │                    └─────────────┘
                                │                           │
                                │                           │
                                │                           ▼
                                │                    ┌─────────────┐
                                │                    │ Recipient's │
                                │                    │  Mailbox    │
                                │                    └─────────────┘
                                │
                                │
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│                     BOUNCE/COMPLAINT HANDLING                            │
└──────────────────────────────────────────────────────────────────────────┘

                        ┌─────────────────────────────┐
                        │  Bounce or Complaint Event   │
                        │  (email doesn't exist OR     │
                        │   user clicked "Report Spam")│
                        └─────────────────────────────┘
                                      │
                                      ▼
                        ┌─────────────────────────────┐
                        │    AWS SES detects event     │
                        │  (configuration set active)  │
                        └─────────────────────────────┘
                                      │
                                      ▼
                  ┌─────────────────────────────────────────┐
                  │  Publish to SNS Topic                   │
                  │  • ses-bounces (for bounces)           │
                  │  • ses-complaints (for complaints)     │
                  └─────────────────────────────────────────┘
                                      │
                                      ▼
                        ┌─────────────────────────────┐
                        │   SNS triggers Lambda        │
                        │   (SESEventProcessor)        │
                        └─────────────────────────────┘
                                      │
                                      ▼
            ┌─────────────────────────────────────────────────────┐
            │         Lambda Processing Logic                      │
            │                                                       │
            │  1. Parse bounce/complaint event                     │
            │  2. Determine severity:                              │
            │     - Hard bounce → suppress immediately             │
            │     - Soft bounce → count (suppress after 3)         │
            │     - Complaint → suppress immediately (CAN-SPAM)   │
            │  3. Add email to suppression list                    │
            │  4. Update user profile with reason                  │
            │  5. Log event for compliance                         │
            └─────────────────────────────────────────────────────┘
                        │              │               │
                        │              │               │
       ┌────────────────┘              │               └──────────────────┐
       │                               │                                  │
       ▼                               ▼                                  ▼
┌─────────────┐            ┌─────────────────────┐          ┌──────────────────┐
│  DynamoDB   │            │    DynamoDB         │          │    DynamoDB      │
│ Suppression │            │  User Profiles      │          │   Event Logs     │
│    List     │            │                     │          │  (compliance)    │
│             │            │ emailStatus=BOUNCED │          │                  │
│ email       │            │ emailStatusReason   │          │ 90 days (bounce) │
│ reason      │            │ emailStatusUpdated  │          │ 1 year (complaint)│
│ suppressedAt│            │                     │          │                  │
│ ttl (1 year)│            └─────────────────────┘          └──────────────────┘
└─────────────┘
       │
       │
       │
┌──────▼────────────────────────────────────────────────────────────────┐
│                    FUTURE SEND ATTEMPTS                                │
└────────────────────────────────────────────────────────────────────────┘

   Sender Lambda
   ┌─────────────────────────────────────────────────┐
   │                                                   │
   │  1. Query Suppression List                       │
   │     GET /email-suppression-list/{email}          │
   │                                                   │
   │  2. If email exists:                             │
   │     ✗ Block send                                 │
   │     ✗ Log blocked attempt                        │
   │     ✗ Return error to caller                     │
   │     "Email is in suppression list (bounced)"     │
   │                                                   │
   │  3. If email NOT in list:                        │
   │     ✓ Proceed with send                          │
   │                                                   │
   └─────────────────────────────────────────────────┘
```

---

## Component Details

### 1. SNS Topics

**Topic: `ses-bounces`**
- Receives bounce notifications from SES
- Triggers Lambda on every message
- Retention: 14 days (default)

**Topic: `ses-complaints`**
- Receives complaint (spam) notifications from SES
- Triggers Lambda on every message
- Retention: 14 days (default)

### 2. Lambda: SESEventProcessor

**Trigger**: SNS message
**Runtime**: Java 21
**Memory**: 512 MB
**Timeout**: 30 seconds

**Processing Logic**:
```java
1. Parse SNS → SES event JSON
2. Extract email address(es) from bouncedRecipients/complainedRecipients
3. Determine action:
   - Hard bounce → Add to suppression list immediately
   - Soft bounce → Increment counter, suppress after 3
   - Complaint → Add to suppression list immediately (legal requirement)
4. Write to DynamoDB:
   - email-suppression-list (for sender to check)
   - ses-event-logs (audit trail)
   - user-profiles (update emailStatus)
5. Return success/failure count
```

### 3. DynamoDB: email-suppression-list

**Schema**:
```
Partition Key: email (String)
Attributes:
  - reason: "BOUNCE" | "COMPLAINT"
  - details: Human-readable reason
  - suppressedAt: ISO timestamp
  - softBounceCount: Number (for soft bounces)
  - ttl: Unix timestamp (auto-delete after 1 year)
```

**Indexes**:
- reason-index (GSI): Query all bounces or all complaints
- suppressedAt in sort key: Order by time

### 4. DynamoDB: ses-event-logs

**Schema**:
```
Partition Key: email (String)
Sort Key: timestamp (String)
Attributes:
  - eventType: "BOUNCE" | "COMPLAINT"
  - bounceType: "Permanent" | "Transient" | "Undetermined"
  - bounceSubType: "General" | "NoEmail" | "Suppressed" | etc.
  - diagnosticCode: SMTP error details
  - ttl: Unix timestamp (auto-delete after 90 days for bounces, 1 year for complaints)
```

**Purpose**: Compliance audit trail (CAN-SPAM Act requirement)

### 5. SES Configuration Set: snre-production

**Event Destinations**:
1. **Bounce → SNS**
   - EventTypes: ["bounce"]
   - TopicArn: ses-bounces

2. **Complaint → SNS**
   - EventTypes: ["complaint"]
   - TopicArn: ses-complaints

3. **Delivery → CloudWatch** (optional, for analytics)
   - EventTypes: ["send", "delivery", "reject"]
   - Logs: /aws/ses/events

---

## Suppression Decision Tree

```
Email Bounce/Complaint Event Received
  │
  ├── Is it a COMPLAINT (spam report)?
  │   │
  │   └── YES → Suppress IMMEDIATELY
  │             (CAN-SPAM Act requirement)
  │             Add to suppression list with reason="COMPLAINT"
  │
  └── Is it a BOUNCE?
      │
      ├── Bounce Type: PERMANENT (Hard Bounce)
      │   │
      │   └── Suppress IMMEDIATELY
      │       Reasons: Email doesn't exist, domain invalid, blocked
      │       Add to suppression list with reason="BOUNCE"
      │
      └── Bounce Type: TRANSIENT (Soft Bounce)
          │
          └── Check bounce count for this email
              │
              ├── Count < 3
              │   │
              │   └── DO NOT suppress yet
              │       Increment softBounceCount
              │       Log event
              │       Reasons: Mailbox full, server temporary issue
              │
              └── Count >= 3
                  │
                  └── Suppress NOW
                      Add to suppression list
                      Reason: "Repeated soft bounces (3+ times)"
```

---

## Sender Integration Flow

```
User calls: POST /v1/send
  │
  ▼
┌─────────────────────────────────────────────────┐
│  Sender Lambda: Handler.handleRequest()          │
└─────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────┐
│  ChannelSelector.selectChannel()                 │
│  → Determines EMAIL is best channel              │
└─────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────┐
│  EmailChannel.send(recipient, subject, body)     │
└─────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────┐
│  isEmailSuppressed(recipient) ◀── CRITICAL CHECK │
│                                                   │
│  Query: DynamoDB.getItem(                        │
│    table: "email-suppression-list",              │
│    key: { email: recipient }                     │
│  )                                                │
└─────────────────────────────────────────────────┘
  │
  ├── Item EXISTS (email is suppressed)
  │   │
  │   └─▶ BLOCK SEND
  │       throw Exception("Email is in suppression list")
  │       Log blocked attempt
  │       Return error to caller
  │
  └── Item NOT FOUND (email is OK)
      │
      └─▶ PROCEED WITH SEND
          │
          ▼
     ┌─────────────────────────────────────────┐
     │  SesV2Client.sendEmail()                 │
     │  .configurationSetName("snre-production") │
     │  ← This enables bounce/complaint tracking │
     └─────────────────────────────────────────┘
          │
          ▼
     ┌─────────────────────────────────────────┐
     │  Email delivered to recipient            │
     └─────────────────────────────────────────┘
```

---

## AWS SES Production Approval Checklist

When AWS reviews your account, they verify:

✅ **1. SNS Topics Exist and Are Active**
```bash
aws sns list-topics | grep ses-bounces
aws sns list-topics | grep ses-complaints
```

✅ **2. Lambda Subscribed to Topics**
```bash
aws sns list-subscriptions-by-topic --topic-arn <BOUNCE_TOPIC_ARN>
# Should show Lambda ARN
```

✅ **3. Configuration Set Has Event Destinations**
```bash
aws ses describe-configuration-set --configuration-set-name snre-production
# Should show event destinations for bounce and complaint
```

✅ **4. Lambda Processes Events Successfully**
```bash
aws logs tail /aws/lambda/SESEventProcessor --follow
# Should show successful processing logs
```

✅ **5. Suppression List Is Populated**
```bash
aws dynamodb scan --table-name email-suppression-list --max-items 5
# Should show entries from test bounces
```

✅ **6. Sender Checks Suppression List**
- Code review: `isEmailSuppressed()` called before `ses.sendEmail()`
- Test: Try sending to suppressed email → blocked

✅ **7. Configuration Set Used in All Sends**
- Code review: `.configurationSetName("snre-production")` in all send calls

---

## Monitoring Dashboard

**Key Metrics**:
- Total emails sent
- Bounce rate (< 5% required)
- Complaint rate (< 0.1% required)
- Suppression list size
- Lambda errors (should be 0)

**CloudWatch Alarms**:
```bash
# Alert if bounce rate > 5%
# Alert if complaint rate > 0.1%
# Alert if Lambda errors > 0
# Alert if suppression list growth > 2x normal
```

---

## Cost Analysis

**Per 1,000 emails sent**:
- SES sending: $0.10
- SNS notifications (bounces ~2%): $0.0001
- Lambda invocations (bounces ~2%): $0.0004
- DynamoDB writes (bounces ~2%): $0.0025
- **Total**: ~$0.103 per 1,000 emails

**Bounce handling adds**: ~3% cost overhead (worth it for compliance!)

---

## Compliance & Legal

### CAN-SPAM Act (USA)
✅ Immediate suppression on complaints
✅ 1-year retention of complaint records
✅ Audit trail of all suppressions

### GDPR (EU)
✅ Right to be forgotten (TTL auto-deletion)
✅ Data minimization (only email + reason stored)
✅ Encryption at rest (DynamoDB encryption)

### Email Best Practices
✅ Bounce suppression (prevent reputation damage)
✅ Soft bounce retry limit (3 attempts)
✅ Configuration set tracking

---

**System Status**: ✅ Production Ready for AWS SES Approval
