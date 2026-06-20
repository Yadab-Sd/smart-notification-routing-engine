# Deployment Guide

This guide helps external collaborators deploy the Intelligent Routing Engine to their own AWS account.

---

## Prerequisites

1. **AWS Account** with administrator access
2. **AWS CLI** configured with credentials (`aws configure`)
3. **Node.js 18+** and **pnpm** (`npm install -g pnpm`)
4. **Java 21** and **Maven** (`mvn --version`)
5. **Docker** (for SageMaker container builds)

---

## Deployment Options

SNRE supports two deployment styles:

1. **Local scripts**: recommended default for contributors, adopters, and maintainers. You run deploy commands from your machine with your own AWS profile.
2. **GitHub Actions deploy**: optional maintainer path. It uses GitHub OIDC and manual `workflow_dispatch`, so frontend deployment only happens when someone intentionally runs the workflow.

Use local scripts first. Add GitHub deployment after your AWS account and environments are stable.

---

## Step 1: Clone Repository

```bash
git clone https://github.com/Yadab-Sd/smart-notification-routing-engine.git
cd smart-notification-routing-engine
```

---

## Step 2: Configure Environment

### AWS Credentials

CDK automatically uses your AWS CLI credentials:

```bash
# Verify credentials
aws sts get-caller-identity

# Output shows your account ID and region
```

### Create `.env` file for CDK

```bash
cd infra/cdk

# Copy template
cp .env.example .env

# Edit with your values
nano .env  # or use your preferred editor
```

This `.env` file persists your configuration across terminal sessions. You only need to set it up once!

### Custom Domain (Optional)

**Default:** CloudFront generates a URL like `https://d1234567890abc.cloudfront.net`

**Custom domain:** Use your own domain like `https://yourdomain.com`

#### Steps:

1. **Register domain** in Route 53 or use existing domain

2. **Request SSL certificate** in ACM (must be us-east-1):
   ```bash
   aws acm request-certificate \
     --domain-name yourdomain.com \
     --validation-method DNS \
     --region us-east-1
   ```

3. **Wait for validation** (5-10 minutes, auto-validates for Route 53 domains):
   ```bash
   # Get certificate ARN
   aws acm list-certificates --region us-east-1
   
   # Check status (wait for ISSUED)
   aws acm describe-certificate \
     --certificate-arn arn:aws:acm:us-east-1:ACCOUNT:certificate/CERT_ID \
     --region us-east-1 \
     --query 'Certificate.Status'
   ```

4. **Add to your `.env` file** in `infra/cdk/.env`:
   ```bash
   CERTIFICATE_ARN=arn:aws:acm:us-east-1:ACCOUNT:certificate/CERT_ID
   CUSTOM_DOMAIN=yourdomain.com
   ```
   
   **This persists across terminal sessions!** No need to re-export every time.

5. **Deploy frontend** (will use custom domain):
   ```bash
   cd infra/cdk
   pnpm exec cdk deploy SR-Frontend --require-approval never
   ```

6. **Update DNS** (see "Custom Domain Setup" section below)

### Email Sender (Required for SES)

Verify your email in SES for sending notifications:

```bash
# Verify your email in SES
aws ses verify-email-identity --email-address your-email@example.com --region us-west-2

# Check verification status (wait for Success)
aws ses get-identity-verification-attributes \
  --identities your-email@example.com \
  --region us-west-2
```

**Add to `.env` file** in `infra/cdk/.env`:
```bash
SENDER_EMAIL=your-email@example.com
```

No need to `export` every time - it's stored in `.env`!

---

## Step 3: Build Backend Services

```bash
# Build all Java Lambda functions
./scripts/build-services.sh

# Or build individually:
cd services/control-plane && mvn clean package
cd services/events-consumer && mvn clean package
cd services/sender-service && mvn clean package
cd services/decision-service && mvn clean package
cd services/analytics-service && mvn clean package
cd services/endpoint-deployer && mvn clean package
```

---

## Step 4: Deploy Infrastructure

Recommended:

```bash
# Deploy all stacks
./scripts/deploy-infra.sh

# Or deploy selected stacks
./scripts/deploy-infra.sh SR-Compute
./scripts/deploy-infra.sh SR-Messaging SR-Frontend

# Skip CDK bootstrap when already bootstrapped
SKIP_BOOTSTRAP=true ./scripts/deploy-infra.sh
```

Manual equivalent:

```bash
cd infra/cdk

# Install CDK dependencies
pnpm install

# Bootstrap CDK (first time only)
npx cdk bootstrap

# Deploy all stacks
npx cdk deploy --all --require-approval never

# Or deploy individually:
npx cdk deploy SR-Network SR-Security SR-Data SR-Identity
npx cdk deploy SR-Messaging
npx cdk deploy SR-Compute
npx cdk deploy SR-ML
npx cdk deploy SR-Frontend
```

**Deployment time:** 15-20 minutes

---

## Step 5: Configure Frontend

### Get Deployment Outputs

```bash
# API URL
API_URL=$(aws cloudformation describe-stacks --stack-name SR-Compute \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)

# Cognito User Pool ID
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name SR-Identity \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)

# Cognito Client ID
CLIENT_ID=$(aws cloudformation describe-stacks --stack-name SR-Identity \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" --output text)

# CloudFront URL
CLOUDFRONT_URL=$(aws cloudformation describe-stacks --stack-name SR-Frontend \
  --query "Stacks[0].Outputs[?OutputKey=='WebsiteURL'].OutputValue" --output text)

echo "API_URL: $API_URL"
echo "USER_POOL_ID: $USER_POOL_ID"
echo "CLIENT_ID: $CLIENT_ID"
echo "CLOUDFRONT_URL: $CLOUDFRONT_URL"
```

### Create `.env.local`

```bash
cd ../../frontend
cp .env.example .env.local
```

Edit `.env.local` with your values:

```bash
VITE_API_URL=https://YOUR_API_ID.execute-api.us-west-2.amazonaws.com
VITE_COGNITO_USER_POOL_ID=us-west-2_XXXXX
VITE_COGNITO_CLIENT_ID=XXXXXX
VITE_REGION=us-west-2
VITE_DEMO_MODE=false
```

### Build and Upload

Recommended:

```bash
# Builds frontend with CloudFormation outputs, uploads to S3, and invalidates CloudFront
./scripts/deploy-frontend.sh

# Optional: invalidate only
./scripts/invalidate-frontend.sh

# Optional: invalidate selected path
./scripts/invalidate-frontend.sh "/index.html"
```

The script reads these stack outputs automatically:

- `SR-Compute`: `ApiUrl`
- `SR-Identity`: `UserPoolId`, `UserPoolClientId`
- `SR-Frontend`: `BucketName`, `DistributionId`, `WebsiteURL`

Manual equivalent:

```bash
# Build frontend
npm install
npm run build

# Upload to S3
BUCKET_NAME=$(aws cloudformation describe-stacks --stack-name SR-Frontend \
  --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" --output text)

aws s3 sync dist/ s3://$BUCKET_NAME/ --delete

# Invalidate CloudFront cache
DIST_ID=$(aws cloudformation describe-stacks --stack-name SR-Frontend \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" --output text)

aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*"
```

---

## Optional: GitHub Actions Frontend Deploy

The repository includes a manual frontend deployment workflow:

```text
.github/workflows/frontend-deploy.yml
```

It is intentionally **manual**, not automatic on every push to `main`.

### 1. Create AWS OIDC Role

In AWS IAM:

1. Add an OpenID Connect provider:
   - Provider URL: `https://token.actions.githubusercontent.com`
   - Audience: `sts.amazonaws.com`
2. Create an IAM role trusted by that provider.
3. Restrict the trust policy to your repository and branch, for example:

```json
"token.actions.githubusercontent.com:sub": "repo:Yadab-Sd/smart-notification-routing-engine:ref:refs/heads/main"
```

### 2. Attach Minimal Permissions

For frontend deployment, the role needs:

```text
cloudformation:DescribeStacks
s3:ListBucket
s3:PutObject
s3:DeleteObject
cloudfront:CreateInvalidation
```

Scope S3 permissions to the `SR-Frontend` bucket and CloudFront permissions to your distribution where possible.

### 3. Add GitHub Secret

GitHub repository:

```text
Settings -> Secrets and variables -> Actions -> New repository secret
```

Create:

```text
AWS_GITHUB_ACTIONS_ROLE_ARN=arn:aws:iam::<account-id>:role/<role-name>
```

### 4. Run the Workflow

GitHub:

```text
Actions -> Frontend Deploy -> Run workflow
```

Choose:

- `environment`: `development`, `staging`, or `production`
- `aws-region`: usually `us-west-2`
- `demo-mode`: `false` for real backend, `true` for demos

For production, consider enabling GitHub Environment approval rules.

---

## Step 6: Create Test User

```bash
# Create Cognito user
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username testuser@example.com \
  --user-attributes Name=email,Value=testuser@example.com Name=phone_number,Value=+15555555555 \
  --temporary-password TempPass123! \
  --message-action SUPPRESS

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username testuser@example.com \
  --password MySecurePass123! \
  --permanent
```

---

## Step 7: Test Deployment

### Test Health Endpoint

```bash
curl $API_URL/v1/health
```

Expected: `{"status":"ok"}`

### Test Frontend

Open CloudFront URL in browser:
```bash
echo $CLOUDFRONT_URL
```

Login with test user credentials.

---

## Custom Domain Setup (Optional)

If you deployed with `CERTIFICATE_ARN`:

### Update DNS

```bash
# Get CloudFront domain
CLOUDFRONT_DOMAIN=$(echo $CLOUDFRONT_URL | sed 's|https://||')

# Get hosted zone ID
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones \
  --query "HostedZones[?Name=='yourdomain.com.'].Id" --output text | cut -d'/' -f3)

# Create A record
aws route53 change-resource-record-sets --hosted-zone-id $HOSTED_ZONE_ID --change-batch "{
  \"Changes\": [{
    \"Action\": \"CREATE\",
    \"ResourceRecordSet\": {
      \"Name\": \"yourdomain.com\",
      \"Type\": \"A\",
      \"AliasTarget\": {
        \"HostedZoneId\": \"Z2FDTNDATAQYW2\",
        \"DNSName\": \"$CLOUDFRONT_DOMAIN\",
        \"EvaluateTargetHealth\": false
      }
    }
  }]
}"
```

Wait 2-5 minutes for DNS propagation, then visit `https://yourdomain.com`

---

## Stack Outputs Reference

| Stack | Output Key | Description |
|-------|-----------|-------------|
| SR-Compute | ApiUrl | REST API endpoint |
| SR-Identity | UserPoolId | Cognito User Pool ID |
| SR-Identity | UserPoolClientId | Cognito App Client ID |
| SR-Frontend | WebsiteURL | CloudFront distribution URL |
| SR-Frontend | BucketName | S3 bucket for frontend files |
| SR-Frontend | DistributionId | CloudFront distribution ID |
| SR-Data | UserProfilesTableName | DynamoDB table for user profiles |
| SR-Data | EventsBucketName | S3 bucket for raw events |

---

## Troubleshooting

### CDK Bootstrap Error

```bash
# Run bootstrap explicitly
cdk bootstrap aws://ACCOUNT_ID/REGION
```

### Lambda Build Failures

```bash
# Ensure Java 21 is active
java -version

# Clean Maven cache
mvn clean
rm -rf ~/.m2/repository
```

### CloudFront 403 Error

```bash
# Check S3 files uploaded
aws s3 ls s3://$BUCKET_NAME/

# Invalidate cache
aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*"
```

### SES Email Sending Fails

```bash
# Verify email first
aws ses verify-email-identity --email-address your-email@example.com --region us-west-2

# Check verification status
aws ses get-identity-verification-attributes \
  --identities your-email@example.com \
  --region us-west-2
```

### SMS Not Sending

SMS requires AWS End User Messaging origination identity (10DLC registration). For testing, use email notifications instead.

---

## Cost Estimate

**Monthly cost for development/pilot:**
- Lambda: ~$5-10 (1M requests)
- DynamoDB: ~$2-5 (on-demand)
- S3: ~$1-2
- CloudFront: ~$1-5
- Kinesis: ~$11 (1 shard)
- SageMaker Endpoint: ~$50-100 (ml.m5.large)

**Total: ~$70-133/month**

**To reduce costs:**
- Delete SageMaker endpoint when not in use: `aws sagemaker delete-endpoint --endpoint-name send-time-v1`
- Use smaller instance: ml.t2.medium (~$35/month)

---

## Cleanup

To delete all resources:

```bash
cd infra/cdk

# Delete all stacks (reverse order)
npx cdk destroy SR-Frontend
npx cdk destroy SR-ML
npx cdk destroy SR-Compute
npx cdk destroy SR-Messaging
npx cdk destroy SR-Identity SR-Data SR-Security SR-Network

# Verify deletion
aws cloudformation list-stacks --query 'StackSummaries[?StackName.contains(@, `SR-`)]'
```

---

## Support

- **GitHub Issues**: https://github.com/Yadab-Sd/smart-notification-routing-engine/issues
- **Documentation**: See README.md for architecture details
- **License**: MIT

---

## Next Steps

1. **Train ML model**: See `services/ml-training/README.md`
2. **Create notification templates**: Upload to S3 curated bucket
3. **Set up monitoring**: CloudWatch dashboards in AWS Console
4. **Configure alerts**: SNS topics for Lambda errors

---

**Questions?** Open an issue on GitHub or check the main README.md
