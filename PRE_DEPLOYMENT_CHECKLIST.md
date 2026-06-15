# Pre-Deployment Checklist

Complete this checklist **before** deploying Intelligent Routing Engine to production.

---

## ☑️ AWS Account Setup

### 1. AWS Account
- [ ] AWS account created (or existing account ready)
- [ ] Credit card added to AWS account
- [ ] Account verified (phone/email)
- [ ] MFA enabled on root account (security best practice)
- [ ] IAM user created with admin permissions (don't use root)

### 2. AWS Region Selection
- [ ] Choose primary region (e.g., `us-west-2`, `us-east-1`)
- [ ] Region supports all required services:
  - [ ] Lambda
  - [ ] DynamoDB
  - [ ] Kinesis
  - [ ] S3
  - [ ] SageMaker
  - [ ] SES (Email)
  - [ ] SNS (SMS)
  - [ ] CloudWatch
  - [ ] EventBridge

---

## ☑️ Email Configuration (AWS SES)

### 1. Domain Setup
- [ ] Own a domain (e.g., `yourbusiness.com`)
- [ ] Access to DNS settings (Route 53, GoDaddy, Namecheap, etc.)
- [ ] Decide sender email (e.g., `notifications@yourbusiness.com`)

### 2. AWS SES Identity Verification
- [ ] Go to AWS SES Console
- [ ] Navigate to **Configuration → Verified identities**
- [ ] Click **Create identity**
- [ ] Choose **Domain** (recommended) or **Email address**
- [ ] Add your domain
- [ ] Add DNS records provided by AWS:
  - [ ] DKIM records (3 CNAME records)
  - [ ] SPF record (TXT record: `v=spf1 include:amazonses.com ~all`)
  - [ ] DMARC record (TXT record: `v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com`)
- [ ] Wait for verification (usually 15 minutes - 24 hours)
- [ ] Status shows **Verified**

### 3. SES Production Access
**CRITICAL**: SES starts in **Sandbox mode** (limited to 200 emails/day, verified recipients only)

- [ ] Go to **Account dashboard** in SES Console
- [ ] Click **Request production access**
- [ ] Fill out form:
  - [ ] Use case description (e.g., "Transactional appointment reminders for healthcare patients")
  - [ ] Daily sending volume estimate
  - [ ] How you handle bounces/complaints
  - [ ] Confirm you only send to opted-in users
- [ ] Submit request
- [ ] Wait for approval (usually 24-48 hours)
- [ ] Receive email: "Your SES production access request has been granted"

### 4. Email Authentication
- [ ] **SPF record** added to DNS
- [ ] **DKIM signing** enabled in SES
- [ ] **DMARC policy** configured
- [ ] Test email deliverability: https://www.mail-tester.com

---

## ☑️ SMS Configuration (AWS SNS / End User Messaging)

### 1. SMS Sending Method
Choose one:
- [ ] **Option A**: AWS SNS with 10DLC registration (for marketing SMS, businesses)
- [ ] **Option B**: AWS End User Messaging with toll-free number (transactional, individual developers)

### 2. For Toll-Free Number (Recommended for Getting Started)
- [ ] Go to **AWS End User Messaging** console
- [ ] Navigate to **Phone numbers**
- [ ] Click **Request phone number**
- [ ] Choose **Toll-free** (starts with 800, 888, etc.)
- [ ] Select country: **United States**
- [ ] Cost: ~$2/month
- [ ] Fill out **registration form**:
  - [ ] Company name
  - [ ] Use case description
  - [ ] Sample messages
  - [ ] Opt-in/opt-out process description
- [ ] Submit registration
- [ ] Wait for approval (5-7 business days)
- [ ] Receive toll-free number (e.g., +1-800-555-1234)

### 3. For 10DLC (Long Code) - Business SMS
- [ ] Register your business with The Campaign Registry (TCR)
- [ ] Provide:
  - [ ] Business EIN (Tax ID)
  - [ ] Business address
  - [ ] Business website
- [ ] Register campaign use case (transactional, marketing, etc.)
- [ ] Wait for brand approval (1-2 weeks)
- [ ] Link 10DLC number to approved brand
- [ ] Cost: $4/month per number + registration fees

### 4. SMS Spending Limits
- [ ] Request spending limit increase in AWS Support
- [ ] Default limit: $1/month (very low!)
- [ ] Recommended: $50-100/month for small business
- [ ] Submit support case: "Increase SNS SMS spending limit"
- [ ] Wait for approval (24-48 hours)

---

## ☑️ AWS CDK Bootstrap

### 1. CDK Bootstrap
- [ ] AWS CLI installed (`aws --version`)
- [ ] AWS credentials configured (`aws configure`)
- [ ] Node.js 18+ installed (`node --version`)
- [ ] AWS CDK installed (`npm install -g aws-cdk`)
- [ ] Run bootstrap:
  ```bash
  cdk bootstrap aws://ACCOUNT_ID/REGION
  ```
- [ ] Verify: Check CloudFormation for "CDKToolkit" stack

---

## ☑️ Environment Configuration

### 1. Create `.env` File
- [ ] Navigate to `infra/cdk/`
- [ ] Copy `.env.example` to `.env`
- [ ] Configure variables:
  ```bash
  SENDER_EMAIL=notifications@yourbusiness.com
  AWS_REGION=us-west-2
  CERTIFICATE_ARN=arn:aws:acm:... (if using custom domain)
  CUSTOM_DOMAIN=yourdomain.com (if using custom domain)
  ```

### 2. Verify Email Address
- [ ] Sender email matches verified SES identity
- [ ] No typos in email address

---

## ☑️ Code Preparation

### 1. Clone Repository
- [ ] Repository cloned locally
- [ ] On correct branch (`main` or `develop`)
- [ ] Latest changes pulled (`git pull`)

### 2. Build Services
- [ ] Java 21 installed (`java --version`)
- [ ] Maven installed (`mvn --version`)
- [ ] Run build script:
  ```bash
  chmod +x scripts/build-services.sh
  ./scripts/build-services.sh
  ```
- [ ] Verify: All 4 services build successfully
- [ ] Check: JAR files exist in `services/*/target/`

### 3. Build Frontend
- [ ] Navigate to `frontend/`
- [ ] Install dependencies: `npm install`
- [ ] Create `.env.local`:
  ```
  VITE_API_ENDPOINT=https://your-api-endpoint.com
  ```
- [ ] Build: `npm run build`
- [ ] Verify: `dist/` directory created

---

## ☑️ Compliance & Legal

### 1. Terms of Service
- [ ] Read `TERMS_OF_SERVICE.md`
- [ ] Understand your responsibilities
- [ ] Accept terms (checkbox during signup or manual confirmation)

### 2. Privacy Policy
- [ ] Create privacy policy for YOUR business
- [ ] Disclose:
  - [ ] What data you collect (email, phone)
  - [ ] How you use it (send notifications)
  - [ ] Where it's stored (AWS region)
  - [ ] How users can opt-out
  - [ ] How to request data deletion
- [ ] Publish on your website: `yourbusiness.com/privacy`

### 3. User Consent Mechanism
- [ ] Decide how you'll obtain consent:
  - [ ] Signup form on website
  - [ ] Checkbox during checkout
  - [ ] In-person collection with form
  - [ ] SMS keyword (text JOIN to 12345)
- [ ] Implement consent collection (before deployment)
- [ ] Plan consent storage (timestamps, sources)

### 4. Opt-Out Mechanism
- [ ] Decide how users opt-out:
  - [ ] Unsubscribe link in emails
  - [ ] STOP keyword for SMS
  - [ ] Settings page on your website
  - [ ] Email/phone support
- [ ] Implement unsubscribe workflow
- [ ] Test opt-out process

---

## ☑️ Deployment

### 1. Pre-Deployment Checks
- [ ] All builds successful
- [ ] `.env` file configured
- [ ] SES production access approved
- [ ] SMS origination number acquired
- [ ] CDK bootstrapped

### 2. Deploy Infrastructure
```bash
cd infra/cdk
cdk synth  # Validate templates
cdk deploy --all  # Deploy all stacks
```

- [ ] Deployment started
- [ ] Wait for completion (15-30 minutes)
- [ ] Save outputs:
  - [ ] API Endpoint URL
  - [ ] CloudFront Distribution URL
  - [ ] User Pool ID
  - [ ] User Pool Client ID
  - [ ] DynamoDB Table Name

### 3. Verify Deployment
- [ ] Check CloudFormation stacks: All show "CREATE_COMPLETE"
- [ ] Test API health endpoint:
  ```bash
  curl https://API_ENDPOINT/v1/health
  # Should return: {"status":"ok"}
  ```
- [ ] Test frontend: Open CloudFront URL in browser
- [ ] Login to dashboard (create first user via Cognito)

---

## ☑️ Post-Deployment Configuration

### 1. Create Admin User
- [ ] Go to AWS Cognito console
- [ ] Navigate to your User Pool
- [ ] Create user manually OR sign up via frontend
- [ ] Confirm user (if email verification enabled)
- [ ] Login to dashboard

### 2. Create First Test User
- [ ] Login to dashboard
- [ ] Navigate to "Users" page
- [ ] Click "Create User"
- [ ] Add test user with YOUR email/phone
- [ ] Verify user created in DynamoDB

### 3. Send Test Event
- [ ] Navigate to "Events" page
- [ ] Fill out event form:
  - [ ] User ID: (test user)
  - [ ] Email: (your email)
  - [ ] Type: NOTIFICATION
  - [ ] Notification Type: immediate
  - [ ] Channel: email
  - [ ] Message: "This is a test notification"
- [ ] Click "Send Event"
- [ ] Check your email inbox (within 1-2 minutes)
- [ ] Verify email received

### 4. Test SMS (If Configured)
- [ ] Send test SMS event
- [ ] Phone: (your phone in E.164 format)
- [ ] Channel: sms
- [ ] Verify SMS received

---

## ☑️ Monitoring & Alerts

### 1. CloudWatch Dashboards
- [ ] Navigate to CloudWatch console
- [ ] Check metrics for:
  - [ ] Lambda invocations
  - [ ] API Gateway requests
  - [ ] DynamoDB read/write units
  - [ ] Kinesis throughput
- [ ] Create alerts for errors

### 2. Cost Monitoring
- [ ] Go to AWS Cost Explorer
- [ ] Set up budget alert:
  - [ ] Monthly budget: $100 (adjust as needed)
  - [ ] Alert threshold: 80%
  - [ ] Email notification
- [ ] Review daily costs for first week

### 3. SES Reputation
- [ ] Monitor SES sending statistics
- [ ] Check bounce rate (keep < 5%)
- [ ] Check complaint rate (keep < 0.1%)
- [ ] Review: AWS SES → Reputation metrics

---

## ☑️ Security Hardening

### 1. IAM Least Privilege
- [ ] Review Lambda execution role permissions
- [ ] Remove unnecessary permissions
- [ ] Enable CloudTrail logging

### 2. Encryption
- [ ] Verify DynamoDB encryption at rest (default: enabled)
- [ ] Verify S3 bucket encryption (default: enabled)
- [ ] Enable HTTPS only (API Gateway, CloudFront)

### 3. Secrets Management
- [ ] No secrets in code or environment variables
- [ ] Use AWS Secrets Manager for API keys (if any)
- [ ] Rotate credentials regularly

---

## ☑️ Documentation

### 1. Internal Documentation
- [ ] Document API endpoint URL
- [ ] Document admin credentials (securely)
- [ ] Create runbook for common tasks:
  - [ ] Adding users
  - [ ] Sending notifications
  - [ ] Checking logs
  - [ ] Troubleshooting errors

### 2. Team Training
- [ ] Train team on dashboard usage
- [ ] Explain consent requirements
- [ ] Share opt-out procedures
- [ ] Provide support contacts

---

## ☑️ Production Readiness

### Final Checks
- [ ] ✅ All infrastructure deployed successfully
- [ ] ✅ Test email sent and received
- [ ] ✅ Test SMS sent and received (if configured)
- [ ] ✅ Dashboard accessible
- [ ] ✅ Monitoring and alerts configured
- [ ] ✅ Compliance documentation complete
- [ ] ✅ Team trained
- [ ] ✅ Opt-out mechanism tested
- [ ] ✅ Budget alerts set up

---

## 🚀 Go Live!

**You're ready to send production notifications!**

### First Production Notification
1. Verify user has consented
2. Check user exists in system (or will auto-create with contact info)
3. Send via Events page or API
4. Monitor delivery in CloudWatch
5. Check SES metrics for bounces/complaints

### Gradual Rollout (Recommended)
- **Week 1**: Send to 10% of users (test group)
- **Week 2**: Increase to 50% of users
- **Week 3**: Increase to 100% of users
- Monitor metrics at each stage

---

## 📞 Support

**Issues during setup?**
- Check [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions
- Search [GitHub Issues](https://github.com/Yadab-Sd/smart-notification-routing-engine/issues)
- Email: contact@intelligent-routing.com

**Emergency support**:
- AWS outages: https://status.aws.amazon.com
- SES deliverability issues: AWS Support case
- Security issues: security@intelligent-routing.com

---

## 📝 Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| AWS account setup | 1 hour | Credit card, phone |
| Domain + DNS configuration | 2-4 hours | Domain ownership |
| SES production access | 24-48 hours | AWS review |
| SMS origination number | 5-7 days | Registration approval |
| Code build + deployment | 30-60 minutes | Prerequisites installed |
| Testing + verification | 1-2 hours | Access to email/phone |
| **Total (excluding approvals)** | **1-2 days** | - |
| **Total (with approvals)** | **5-10 days** | - |

---

**Last Updated**: June 14, 2026  
**Version**: 1.0
