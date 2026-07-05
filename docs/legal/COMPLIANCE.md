# Compliance Guide - Intelligent Routing Engine

## Overview

Intelligent Routing Engine is **infrastructure software** that deploys to your AWS account. You are the **data controller** and responsible for compliance with applicable laws.

This document provides general, non-legal guidance on common notification, privacy, and communications obligations, including GDPR, HIPAA, CAN-SPAM, and TCPA and your responsibilities when using this system.

---

## Legal Framework

### Data Controller vs Data Processor

**You (Business) = Data Controller**
- You decide WHAT notifications to send
- You collect user contact information
- You determine notification purposes
- You are liable for compliance

**This Software = Processing Tool**
- Like AWS Lambda, Microsoft Office, or Salesforce
- Executes your instructions
- Data stays in YOUR AWS account
- You control access and retention

**Maintainer = Software Provider**
- Provides open-source software
- Does NOT host your data
- Does NOT access your AWS account
- does not replace your own legal, security, or compliance review

---

## Regulatory Considerations

### 1. GDPR (EU Users)

If you send notifications to EU residents, GDPR applies.

**Your Responsibilities:**

✅ **Lawful Basis for Processing**:
- Obtain consent OR establish legitimate interest
- Document your legal basis

✅ **Data Minimization**:
- System collects only userId, email/phone (minimal data)
- Don't store unnecessary personal data in event metadata

✅ **Purpose Limitation**:
- Use data ONLY for notification delivery (explicit purpose)
- Don't repurpose data without new consent

✅ **User Rights**:
- Right to access: Provide API to retrieve user data (`GET /v1/users/{id}`)
- Right to deletion: Implement via `DELETE /v1/users/{id}`
- Right to opt-out: Honor unsubscribe requests

✅ **Privacy Policy**:
- Disclose notification delivery mechanism
- Mention AWS as sub-processor (data stored in AWS S3/DynamoDB)
- Provide contact for data subject requests

**System Features Supporting GDPR:**
- ✅ Data stays in YOUR AWS account (data sovereignty)
- ✅ Delete user API available
- ✅ No third-party data sharing (events stay in your control)
- ✅ EU region deployment option (eu-west-1, eu-central-1)

---

### 2. HIPAA (Healthcare)

If you send notifications containing Protected Health Information (PHI), HIPAA applies.

**Your Responsibilities:**

✅ **Business Associate Agreement (BAA)**:
- AWS provides BAA (you sign with AWS, not with this software)
- This software is a tool, not a business associate

✅ **Minimum Necessary Standard**:
- Don't include PHI in notification messages if not required
- Example: "Your appointment is tomorrow" (GOOD)
- Example: "Your HIV test results are ready" (BAD - too specific)

✅ **Access Controls**:
- Use AWS IAM to restrict who can access notification data
- Enable CloudTrail logging for audit trails
- Configure DynamoDB encryption at rest (enabled by default)

✅ **Audit Logging**:
- System logs all API calls to CloudWatch
- S3 event storage provides notification audit trail
- Enable AWS CloudTrail for compliance audits

✅ **Data Retention**:
- Define retention policy for notification events
- Implement S3 lifecycle rules to delete old data

**System Features Supporting HIPAA:**
- ✅ Encryption at rest (DynamoDB, S3 default encryption)
- ✅ Encryption in transit (HTTPS API, TLS for email/SMS)
- ✅ Audit trails (CloudWatch logs, CloudTrail)
- ✅ Access controls (AWS IAM integration)
- ✅ Data isolation (your AWS account = no shared tenancy)

**Auto-Creating Users from Events - HIPAA Considerations**

May be appropriate only if:
1. Patient triggered the event (appointment booking, prescription refill)
2. You obtained patient consent for notifications during registration
3. Notification is for treatment/payment/operations (TPO exception)
4. You have documented legal basis in your HIPAA policies

Example flow:
```
Patient books appointment via your portal
  → Your system sends event to Intelligent Routing Engine
  → System auto-creates user profile (userId, phone)
  → Sends appointment reminder SMS (TPO use)
  → May support a compliant workflow if your organization has the required consent,
    policies, AWS agreements, and operational controls in place
```

---

### 3. CAN-SPAM Act (Email)

Applies to commercial email messages.

**Your Responsibilities:**

✅ **Transactional vs Marketing**:
- **Transactional** (CAN-SPAM EXEMPT): Order confirmations, account alerts, appointment reminders
- **Marketing** (CAN-SPAM APPLIES): Promotional offers, newsletters, sales emails

✅ **For Marketing Emails**:
- Don't use deceptive subject lines
- Identify message as advertisement
- Include physical postal address
- Provide opt-out mechanism (unsubscribe link)
- Honor opt-outs within 10 business days

✅ **From Address**:
- Use accurate "From" header
- System uses `contact@your-domain.com` by default (configure in CDK)

**System Support:**
- ✅ System doesn't distinguish transactional vs marketing (you decide)
- ✅ You must implement unsubscribe logic in YOUR application
- ✅ System provides DELETE user API to remove unsubscribed users

**Recommendation:**
```
For marketing emails:
1. Maintain unsubscribe list in your database
2. Check before sending event to Intelligent Routing Engine
3. Include unsubscribe link in message metadata:

{
  "userId": "user123",
  "email": "user@example.com",
  "type": "MARKETING",
  "notificationType": "optimized",
  "message": "Check out our new products!",
  "metadata": {
    "unsubscribeUrl": "https://yoursite.com/unsubscribe?token=xyz"
  }
}
```

---

### 4. TCPA (Telephone Consumer Protection Act - SMS)

Applies to SMS/text messages.

**Your Responsibilities:**

✅ **Express Written Consent Required**:
- For marketing/promotional SMS, obtain written consent
- Consent must clearly state user agrees to receive SMS
- Disclosure required: "Message and data rates may apply"

✅ **Transactional SMS** (Less Strict):
- Informational messages with prior business relationship (customer made purchase)
- Examples: Order status, appointment reminders, security alerts
- Still need implicit consent (user provided phone number for this purpose)

✅ **Opt-Out**:
- Honor "STOP" keyword immediately
- Confirm opt-out with final message: "You have been unsubscribed"

**System Support:**
- ✅ System sends SMS via AWS SNS (you're liable, not AWS/this software)
- ✅ Implement STOP keyword handling in YOUR application
- ✅ Use DELETE user API or update phone to null when user opts out

**Auto-Creating Users from Events - TCPA Compliant?**

✅ **YES** - if:
1. User provided phone number to YOUR business directly
2. Notification is transactional (related to transaction they initiated)
3. You have documented consent (e.g., checkbox during checkout)

Example workflow to review with your compliance team:
```
Customer places order, provides phone: +14155551234
  → Your system sends event with phone number
  → System auto-creates user profile
  → Sends order confirmation SMS (transactional)
  → Review TCPA applicability, consent records, and opt-out handling
```

❌ **NOT COMPLIANT** - if:
- You bought phone number list from third party
- You're sending marketing SMS without written consent
- User never provided phone to YOUR business

---

## Auto-User Creation - Compliance Analysis

### Is Auto-Creating Users from Events Compliant?

✅ **YES** - under these conditions:

**1. Legitimate Interest (GDPR)**
- User triggered the event (purchase, booking, action in YOUR system)
- They provided contact info to YOUR business
- Notification serves legitimate purpose (order status, appointment reminder)

**2. Prior Consent Obtained (HIPAA/TCPA)**
- During registration/checkout, you asked: "Send notifications to this email/phone?"
- User checked box or clicked "Yes"
- You document consent in YOUR database

**3. Data Sovereignty**
- Data stays in YOUR AWS account (you're data controller)
- Software is just processing tool
- You can delete data anytime via API

**4. Minimal Data Collection**
- System only stores: userId, email/phone
- No unnecessary PII collected
- Purpose-limited to notification delivery

### Legal Reasoning

**Why It's Compliant:**

This is operationally equivalent to:
```
User places order
  ↓
Your system creates order record in YOUR database
  ↓
Your system creates user notification profile
  ↓
Your system sends notification
```

The fact that notification profile is created "automatically" vs "manually" is a technical implementation detail, NOT a legal distinction.

**Key Legal Principle**: You (business) are performing data processing for legitimate business purpose using software tool deployed in YOUR infrastructure.

---

## Compliance Checklist

Before deploying Intelligent Routing Engine:

### Pre-Deployment

- [ ] Review applicable laws (GDPR, HIPAA, CAN-SPAM, TCPA)
- [ ] Update privacy policy disclosing notification delivery
- [ ] Implement consent collection in YOUR application
- [ ] Define data retention policy (how long to keep events)
- [ ] Configure AWS region (US/EU based on user location)

### Post-Deployment

- [ ] Enable CloudTrail logging for audit trails
- [ ] Set up S3 lifecycle rules for data retention
- [ ] Configure IAM roles for least-privilege access
- [ ] Test DELETE user API (right to be forgotten)
- [ ] Implement unsubscribe mechanism in YOUR application

### Ongoing Compliance

- [ ] Monitor for user opt-out requests
- [ ] Respond to data subject access requests (GDPR)
- [ ] Maintain consent records
- [ ] Review logs for unauthorized access
- [ ] Update compliance documentation annually

---

## Disclaimers

### Software License

Intelligent Routing Engine is provided under MIT License "AS IS" without warranties.

### Your Responsibility

You are solely responsible for:
- Complying with applicable laws
- Obtaining user consent
- Implementing opt-out mechanisms
- Data security in your AWS account
- Legal liability for notifications sent

### Creator's Liability

The software maintainer is not responsible for:
- Your use of the software
- Your compliance violations
- Data breaches in your AWS account
- Damages from notifications you send

### Not Legal Advice

This document is informational guidance, NOT legal advice. Consult qualified attorney for legal compliance questions specific to your business.

---

## Resources

### Regulations

- **GDPR**: https://gdpr.eu/
- **HIPAA**: https://www.hhs.gov/hipaa/
- **CAN-SPAM**: https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business
- **TCPA**: https://www.fcc.gov/consumers/guides/telecommunications-consumer-protections

### AWS Compliance

- **AWS HIPAA Compliance**: https://aws.amazon.com/compliance/hipaa-compliance/
- **AWS GDPR Center**: https://aws.amazon.com/compliance/gdpr-center/
- **AWS BAA**: https://aws.amazon.com/compliance/hipaa-eligible-services-reference/

### Implementation Guides

- **Consent Management**: Design forms to collect explicit consent
- **Opt-Out Implementation**: Honor unsubscribe requests within required timeframes
- **Data Deletion**: Use `DELETE /v1/users/{id}` API endpoint
- **Audit Logging**: Enable CloudTrail and review logs regularly

---

## Contact

For software-related questions (not legal advice):

- GitHub Issues: https://github.com/Yadab-Sd/smart-notification-routing-engine/issues
- Email: contact@intelligent-routing.com
- Documentation: https://intelligent-routing.com/docs

For legal compliance questions, consult qualified counsel in your jurisdiction.

---

*Last Updated: June 14, 2026*  
*Document Version: 1.0*
