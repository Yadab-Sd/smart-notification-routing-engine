# Terms of Service - Intelligent Routing Engine

**Last Updated**: June 14, 2026  
**Effective Date**: June 14, 2026

---

## 1. Acceptance of Terms

By using Intelligent Routing Engine ("the System"), you ("Business", "You") agree to these Terms of Service. If you do not agree, do not use the System.

---

## 2. Service Description

Intelligent Routing Engine is a **technical infrastructure tool** that optimizes notification delivery timing using machine learning. It is deployed to **your AWS account** and processes data you provide.

**We provide**: Technical software  
**You control**: All data, users, and notification decisions

---

## 3. Your Responsibilities

### 3.1 User Consent (CRITICAL)

**You certify that for EVERY user you add to the System**:

✅ **Consent Obtained**: You have obtained valid, lawful consent to send notifications to that user's email address and/or phone number.

✅ **Lawful Collection**: User contact information was collected legally with proper disclosure.

✅ **Documentation**: You maintain records proving consent was obtained (signup forms, checkboxes, timestamps, IP addresses, etc.).

✅ **Appropriate Relationship**: You have a legitimate business relationship or transactional basis for contacting the user.

### 3.2 Consent Requirements by Notification Type

**Transactional Notifications** (order confirmations, appointment reminders, account alerts):
- ✅ Consent: Implied through business transaction
- ✅ Basis: User provided contact info during transaction
- ✅ Example: Customer buys product → You can send order confirmation

**Marketing Notifications** (promotions, newsletters, sales):
- ✅ Consent: **Express opt-in required** (checkbox, not pre-checked)
- ✅ Disclosure: Clear statement about what they're agreeing to
- ✅ Example: User checks "Send me promotional emails" during signup

**SMS Notifications**:
- ✅ Consent: **Express written consent required** (TCPA requirement)
- ✅ Disclosure: Must include "Message and data rates may apply"
- ✅ Example: User types "JOIN" to shortcode or checks SMS opt-in box

### 3.3 Prohibited Practices

**You SHALL NOT**:

❌ Upload purchased email lists without verified consent  
❌ Send unsolicited marketing emails (spam)  
❌ Use pre-checked consent boxes (invalid under GDPR)  
❌ Send SMS without express written consent  
❌ Scrape emails from websites or public sources  
❌ Add users who never interacted with your business  
❌ Misrepresent sender identity  

### 3.4 Compliance Obligations

**You agree to comply with**:

✅ **CAN-SPAM Act** (US): Accurate headers, opt-out mechanism, honor requests within 10 days  
✅ **TCPA** (US): Express written consent for SMS, honor STOP immediately  
✅ **GDPR** (EU): Lawful basis, privacy policy, data subject rights  
✅ **CCPA** (California): Privacy disclosures, opt-out rights  
✅ **HIPAA** (Healthcare): BAA with AWS, minimum necessary, encryption  
✅ **Industry-specific regulations** applicable to your business  

### 3.5 Opt-Out & Unsubscribe

**You must provide**:

✅ Clear unsubscribe mechanism in every marketing email  
✅ Honor unsubscribe requests within 10 business days (CAN-SPAM)  
✅ Honor STOP keyword for SMS immediately  
✅ Delete user data upon request (GDPR Right to Erasure)  

**How to implement**:
- Use `DELETE /v1/users/{userId}` API when user unsubscribes
- Maintain your own unsubscribe list
- Check before sending notifications

---

## 4. Our Role & Liability

### 4.1 Data Processor Status

**We are a "Data Processor"**, NOT a "Data Controller":

✅ **You control**: What notifications to send, who to send to, when to send  
✅ **We execute**: Your instructions via the software you deployed  
✅ **Data location**: YOUR AWS account (we never see it)  

This is equivalent to using AWS Lambda, SendGrid, or Twilio - you're liable for how you use the tool.

### 4.2 No Liability for Your Misuse

**We are NOT liable for**:

❌ Spam complaints from users you contact  
❌ GDPR/TCPA fines due to your lack of consent  
❌ Data breaches in YOUR AWS account  
❌ Legal action from users you contacted without permission  
❌ Regulatory enforcement actions against you  

**You indemnify us** against any claims arising from your use of the System.

### 4.3 Abuse Monitoring

**We reserve the right to**:

⚠️ Investigate abuse reports  
⚠️ Request proof of consent  
⚠️ Suspend or terminate your access  
⚠️ Report serious violations to authorities  

**If we receive complaints**:
1. We contact you to investigate
2. You provide proof of consent within 7 days
3. If you can't prove consent → Account suspended

---

## 5. Account Termination

### 5.1 Immediate Termination

**We may terminate your access immediately if**:

🚫 You send unsolicited spam  
🚫 You violate TCPA, CAN-SPAM, or GDPR  
🚫 You cannot provide proof of consent when requested  
🚫 You engage in fraudulent activity  
🚫 You violate these Terms in any material way  

### 5.2 Data After Termination

Since the System is deployed to **your AWS account**:
- ✅ You retain all data (it's in your account)
- ✅ You can continue using self-hosted version (open source)
- ❌ You lose access to our support/services

---

## 6. Self-Hosted Deployments

### 6.1 Open Source License

The System is licensed under **MIT License**.

**This means**:
- ✅ You can use commercially
- ✅ You can modify the code
- ✅ You can deploy to your infrastructure
- ✅ No licensing fees

**BUT** these Terms still apply when you:
- Use our documentation/guides
- Receive our support
- Access our services (API keys, etc.)

### 6.2 Liability for Self-Deployed

**If you deploy from GitHub yourself**:

✅ **You are FULLY LIABLE** for compliance  
✅ **You are responsible** for AWS costs  
✅ **You maintain** all infrastructure  
✅ **These Terms still apply** regarding consent/spam  

**We provide**: Open-source software  
**You ensure**: Compliant usage

---

## 7. Warranties & Disclaimers

### 7.1 No Warranty

THE SYSTEM IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND.

We do not warrant:
- Uptime or availability
- Accuracy of ML predictions
- Fitness for particular purpose
- Compliance with specific regulations

### 7.2 Your Warranty

**You warrant that**:
- All information you provide is accurate
- You have authority to send notifications on behalf of your business
- You have obtained all necessary consents
- You will comply with all applicable laws

---

## 8. Limitation of Liability

**Our maximum liability**: $100 USD or fees paid in last 12 months (whichever is lower).

**We are not liable for**:
- Indirect, consequential, or punitive damages
- Lost profits or business interruption
- Regulatory fines you incur
- Spam complaints or lawsuits against you

---

## 9. Indemnification

**You indemnify and hold us harmless from**:

- Claims by users you contacted without consent
- Regulatory enforcement actions
- Legal fees defending spam complaints
- Any damages resulting from your violation of these Terms

---

## 10. Certification

**By using the System, you certify**:

✅ I have read and understood these Terms  
✅ I have obtained consent from all users I will contact  
✅ I will comply with CAN-SPAM, TCPA, GDPR, and applicable laws  
✅ I will provide opt-out mechanisms  
✅ I assume full liability for notifications sent  
✅ I will maintain records of consent  
✅ I understand I am the Data Controller  

---

## 11. Modifications

We may update these Terms. Continued use after changes = acceptance.

**Notification**: We'll email you 30 days before material changes.

---

## 12. Governing Law

**United States**: Federal law and California state law  
**Dispute Resolution**: Binding arbitration in Santa Clara County, CA

---

## 13. Contact

**Questions about Terms**: legal@intelligent-routing.com  
**Abuse Reports**: abuse@intelligent-routing.com  
**Technical Support**: contact@intelligent-routing.com

---

## 14. Industry-Specific Provisions

### 14.1 Healthcare (HIPAA)

If you process Protected Health Information (PHI):

✅ **BAA with AWS**: You must sign Business Associate Agreement with AWS  
✅ **Minimum Necessary**: Only send PHI when required for treatment/payment/operations  
✅ **Encryption**: Enable encryption at rest (DynamoDB, S3) - already default  
✅ **Access Controls**: Use AWS IAM to restrict access  
✅ **Audit Logs**: Enable CloudTrail for compliance audits  

**We do NOT sign BAA with you** - the System deploys to your account (you control PHI).

### 14.2 Government/Education (FERPA)

If you handle student records:

✅ **FERPA Compliance**: Maintain student privacy  
✅ **Consent for Marketing**: Students must opt-in for non-essential notifications  
✅ **Data Retention**: Follow institutional policies  

### 14.3 E-commerce

✅ **Transactional Emails**: Order confirmations are permitted (customer relationship)  
✅ **Marketing Emails**: Require explicit opt-in with clear checkbox  
✅ **Abandoned Cart**: Check local laws (some require consent, others allow under "soft opt-in")  

---

## Summary - Your Key Obligations

1. ✅ **Obtain consent** before adding users
2. ✅ **Maintain proof** of consent (audit trail)
3. ✅ **Provide opt-out** mechanism
4. ✅ **Honor unsubscribe** requests promptly
5. ✅ **Comply with laws** (CAN-SPAM, TCPA, GDPR)
6. ✅ **Assume liability** for your notifications
7. ✅ **Report abuse** to us if you see it

---

**By clicking "I Agree" or using the System, you accept these Terms.**

---

*Intelligent Routing Engine - Open Source Notification Optimization*  
*MIT Licensed | Deploy to Your AWS | Full Data Sovereignty*
