# Migration Guide

This guide helps you upgrade Smart Notification Routing Engine between versions.

---

## Upgrading from v2.0.0 to v2.1.0

### Overview

- **Backward Compatible**: Yes for existing `/v1/events` clients using legacy `notificationType`
- **Downtime Required**: No planned downtime, but deploy during a low-traffic window
- **Infrastructure Changes**: Yes, CDK deploy required
- **Database Changes**: Adds `AttentionLedger` DynamoDB table
- **Estimated Time**: 30-60 minutes

### What This Release Adds

- Attention Escrow MVP for trust-aware notification routing
- Attention decision and delivery audit records in DynamoDB
- Attention dashboard and business summary metrics
- Enhanced optimized event payload with `notification.deliveryMode`
- SES bounce/complaint processing and suppression list improvements
- Local deployment helpers for infrastructure, frontend deployment, and CloudFront invalidation
- Optional manual GitHub Actions frontend deployment with AWS OIDC

### Step 1: Backup Current Deployment

```bash
aws cloudformation describe-stacks --stack-name SR-Compute > backup-sr-compute.json
aws cloudformation describe-stacks --stack-name SR-Data > backup-sr-data.json
aws dynamodb list-tables > backup-dynamodb-tables.json
```

If you have production user profile data, export the relevant DynamoDB table before deploying.

### Step 2: Pull Release Code

```bash
git fetch --all --tags
git checkout v2.1.0
```

### Step 3: Deploy Infrastructure

Recommended:

```bash
./scripts/deploy-infra.sh
```

If your CDK environment is already bootstrapped:

```bash
SKIP_BOOTSTRAP=true ./scripts/deploy-infra.sh
```

Manual equivalent:

```bash
./scripts/build-services.sh
cd infra/cdk
pnpm install --frozen-lockfile
pnpm exec cdk diff --all
pnpm exec cdk deploy --all --require-approval never
```

### Step 4: Deploy Frontend

```bash
./scripts/deploy-frontend.sh
```

This reads CloudFormation outputs from `SR-Compute`, `SR-Identity`, and `SR-Frontend`, builds the frontend, uploads to S3, and invalidates CloudFront.

### Step 5: Verify Attention Escrow

Send an optimized event:

```bash
curl -X POST "$API_URL/v1/events" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "pilot_user_1",
    "type": "ABANDONED_CART",
    "ts": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "notification": {
      "deliveryMode": "OPTIMIZED",
      "channel": "EMAIL",
      "message": "You left something in your cart.",
      "sourceId": "campaign:abandoned_cart",
      "campaignId": "abandoned_cart",
      "templateId": "cart_reminder_v1",
      "messageCategory": "MARKETING",
      "priorityClass": "LOW",
      "businessValue": 6.0,
      "urgency": 0.3,
      "metadata": {
        "subject": "Complete your order"
      }
    }
  }'
```

Confirm the ledger:

```bash
ATTENTION_LEDGER=$(aws cloudformation describe-stacks --stack-name SR-Data \
  --query "Stacks[0].Outputs[?OutputKey=='AttentionLedgerTableName'].OutputValue" \
  --output text)

aws dynamodb scan --table-name "$ATTENTION_LEDGER" --max-items 5
```

### Step 6: Verify SES Suppression

Use AWS SES simulator addresses in a non-production test flow:

```text
bounce@simulator.amazonses.com
complaint@simulator.amazonses.com
```

Confirm bounced or complained addresses are written to the suppression list and future sends are blocked.

### Step 7: Smoke-Test Checklist

- Login to frontend dashboard
- Send an `IMMEDIATE` event
- Send an `OPTIMIZED` event
- Confirm `ATTENTION_DECISION` ledger record
- Confirm `ATTENTION_DELIVERY` ledger record for sent messages
- Confirm deferred messages do not create EventBridge schedules
- Confirm scheduled messages create EventBridge schedules
- Confirm `/v1/attention/summary` returns dashboard metrics
- Confirm SES bounce/complaint suppression path
- Confirm `./scripts/deploy-frontend.sh` deploys and invalidates CloudFront

### Rollback Notes

Existing event clients can continue using legacy `notificationType`, so rollback is usually only needed if infrastructure deployment fails.

If rollback is required:

```bash
git checkout v2.0.0
./scripts/build-services.sh
cd infra/cdk
pnpm exec cdk deploy --all --require-approval never
```

The new `AttentionLedger` table may remain unless explicitly removed by CloudFormation rollback/delete behavior.

---

## Upgrading from v1.0.0 to v2.0.0

### Overview

- **Backward Compatible**: ✅ Yes - No breaking changes
- **Downtime Required**: No
- **Database Changes**: No schema changes required
- **Estimated Time**: 30-45 minutes

### Prerequisites

- AWS CLI configured
- CDK v2.x installed
- Maven 3.8+ and Java 21
- Node.js 20+

---

### Step 1: Backup Current Deployment (Recommended)

```bash
# Export current DynamoDB data
aws dynamodb scan --table-name YourUserTable > backup-users.json

# Note your current stack outputs
aws cloudformation describe-stacks --stack-name ControlPlaneStack > backup-stacks.json

---
Step 2: Pull Latest Code

cd smart-notification-routing-engine
git fetch --all --tags
git checkout v2.0.0

---
Step 3: Update Backend Services

# Rebuild all 6 services
cd services/control-plane
mvn clean package
cd ../analytics-service
mvn clean package
cd ../decision-service
mvn clean package
cd ../endpoint-deployer
mvn clean package
cd ../events-consumer
mvn clean package
cd ../sender-service
mvn clean package
cd ../..

Or use the build script:
chmod +x scripts/build-services.sh
./scripts/build-services.sh

---
Step 4: Update Frontend

cd frontend
npm install
npm run build
cd ..

---
Step 5: Deploy Infrastructure

cd infra/cdk

# Preview changes (optional)
cdk diff --all

# Deploy all stacks
cdk deploy --all

# Wait for deployment to complete (15-30 minutes)

Stacks Updated:
- ControlPlaneStack (new endpoints: /users, /users/stats)
- SenderServiceStack (metadata subject support)
- FrontendStack (new UI components)

---
Step 6: Verify Deployment

Test new endpoints:
# Get your API endpoint
API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name ControlPlaneStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text)

# Test stats endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  $API_ENDPOINT/v1/users/stats

# Test list users
curl -H "Authorization: Bearer YOUR_TOKEN" \
  $API_ENDPOINT/v1/users?limit=10

Test frontend:
1. Open CloudFront URL
2. Login to dashboard
3. Navigate to Users page (should show list)
4. Navigate to Events page (should show send form)
5. Send a test event with custom subject

---
Step 7: Test New Features

User Management:
- ✅ Create a user via dashboard
- ✅ View user statistics
- ✅ List users with pagination

Event Sending:
- ✅ Send email with custom subject
- ✅ Send SMS test
- ✅ View event log

Auto-user Creation:
# Send event for non-existent user (should auto-create)
curl -X POST $API_ENDPOINT/v1/events \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "auto-test-123",
    "email": "test@example.com",
    "type": "NOTIFICATION",
    "notificationType": "immediate",
    "channel": "email",
    "message": "Test auto-create",
    "metadata": {
      "subject": "Test Subject"
    }
  }'

# Verify user was created
curl -H "Authorization: Bearer YOUR_TOKEN" \
  $API_ENDPOINT/v1/users/auto-test-123

---
Step 8: Update Monitoring (Optional)

If you have custom CloudWatch dashboards:
- Add widgets for new /users and /users/stats endpoints
- Monitor Lambda invocation counts

---
What's New for You

Backend APIs:
- GET /v1/users - List all users (NEW)
- GET /v1/users/stats - User statistics (NEW)
- POST /v1/events - Now auto-creates users (ENHANCED)

Frontend:
- Users page with full CRUD (NEW)
- Events page for testing (NEW)
- Real-time event logs (NEW)

Data Model:
- createdBy field on new users ("API" or "AUTO_EVENT")
- createdAt timestamp on new users
- Existing users remain unchanged

---
Rollback Procedure

If you need to rollback:

# Checkout previous version
git checkout v1.0.0

# Rebuild services
./scripts/build-services.sh

# Rollback deployment
cd infra/cdk
cdk deploy --all

# Or use CloudFormation console to revert

Database: No rollback needed - v2.0.0 is backward compatible

---
Troubleshooting

Issue: "Users page shows no users"
# Check if stats endpoint works
curl -H "Authorization: Bearer YOUR_TOKEN" \
  $API_ENDPOINT/v1/users/stats

# If stats work but list doesn't, redeploy control-plane
cdk deploy ControlPlaneStack

Issue: "Email subject still hardcoded"
# Redeploy sender service
cdk deploy SenderServiceStack

# Verify Lambda updated
aws lambda get-function --function-name SenderServiceFunction \
  --query 'Configuration.LastModified'

Issue: "CI checks failing on PR"
- Check .github/workflows/ files are present
- Enable required status checks in GitHub branch protection
- See .github/BRANCH_PROTECTION.md

---
Post-Upgrade Checklist

- All Lambda functions updated (check AWS Console)
- Frontend shows new Users and Events pages
- GET /v1/users returns user list
- GET /v1/users/stats returns statistics
- Events auto-create users
- Custom email subjects work
- Existing users still work
- Monitoring dashboards updated
- Team notified of new features

---
Need Help?

- Issues: GitHub Issues
- Email: contact@intelligent-routing.com
- Documentation: See README.md and docs/

---
Future Migrations

v2.x to v3.0 (Future)

TBD - Will be added when v3.0 is released

---
Last Updated: June 15, 2026
Applies To: v1.0.0 → v2.0.0

---

## Final File Structure

Smart Notification Routing Engine/
├── CHANGELOG.md          ← What changed (concise)
├── MIGRATION.md          ← How to upgrade (detailed)
├── README.md             ← Project overview
├── DEPLOYMENT.md         ← Initial deployment
├── TERMS_OF_SERVICE.md
├── PRE_DEPLOYMENT_CHECKLIST.md
├── COMPLIANCE.md
├── BUSINESS_ADOPTION.md
└── ...

---

## Summary

| Document | Purpose | Audience | Detail Level |
|----------|---------|----------|--------------|
| **CHANGELOG.md** | What changed | Everyone | Brief list |
| **MIGRATION.md** | How to upgrade | Existing users | Detailed steps |
| **README.md** | Overview | New users | Introduction |
| **DEPLOYMENT.md** | Initial setup | First-time deployers | Complete guide |

```
