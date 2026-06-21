# Smart Notification Routing Engine - Frontend

## Overview

This is the web-based dashboard for **Smart Notification Routing Engine (SNRE)**, a machine learning-powered notification delivery optimization platform. The frontend provides:

- **Dashboard**: Real-time system monitoring and KPIs
- **Analytics**: ML performance metrics, engagement trends, and business impact
- **Attention Escrow**: Review attention cost/value, SEND/DEFER decisions, and run decision previews
- **Send Event**: Test analytics-only, immediate, and optimized event-triggered notification payloads
- **Campaign Management**: Multi-channel notification orchestration
- **User Management**: Audience segmentation and targeting
- **Template Library**: Reusable notification templates
- **API Key Management**: Integration with external systems

**Tech Stack**: React 18 + TypeScript + Vite + Tailwind CSS + React Query + AWS Cognito

---

## Who Is This README For?

This documentation serves **two distinct audiences**:

### 👔 Type 1: Business Adopters (Deploying to Your AWS)

You're an engineer at an organization that wants to deploy SNRE to your own AWS infrastructure. You have your own AWS account and will manage your own backend deployment.

**→ See [Section A: Business Adopter Guide](#a-business-adopter-guide)**

### 💻 Type 2: Contributors (Local Development Only)

You're contributing to the open-source codebase. You'll run the frontend on localhost and submit pull requests. You don't need AWS access or deployment permissions.

**→ See [Section B: Contributor Guide](#b-contributor-guide)**

---

# A. Business Adopter Guide

## Prerequisites

- **Node.js 18+** and **npm 9+**
- **AWS Account** with appropriate permissions
- **AWS CLI** configured with credentials
- **Backend infrastructure deployed** (see main repo's `infra/cdk/` directory)

## Step 1: Deploy Backend Infrastructure

First, deploy the backend stacks that provide API endpoints and authentication:

```bash
cd infra/cdk
npm install
npm run build

# Deploy all required stacks
cdk deploy SR-Network SR-Security SR-Identity SR-Data SR-Messaging SR-Compute
```

Wait for deployment to complete. This creates:
- API Gateway (REST API endpoints)
- Cognito User Pool (authentication)
- Lambda functions (business logic)
- DynamoDB tables (data storage)
- SageMaker endpoint (ML inference)

## Step 2: Retrieve AWS Configuration Values

After backend deployment, get the required values from CloudFormation outputs:

```bash
# Get API URL
aws cloudformation describe-stacks --stack-name SR-Compute \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text

# Get Cognito User Pool ID
aws cloudformation describe-stacks --stack-name SR-Identity \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text

# Get Cognito Client ID
aws cloudformation describe-stacks --stack-name SR-Identity \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" --output text
```

**Alternative**: Check the AWS CloudFormation console → Stacks → Outputs tab for each stack.

## Step 3: Configure Frontend Environment

Create `.env.local` in the `frontend/` directory:

```bash
cd frontend
cp .env.example .env.local
```

Edit `.env.local` with your AWS values:

```env
# API Configuration (from SR-Compute outputs)
VITE_API_URL=https://your-api-id.execute-api.us-west-2.amazonaws.com

# Cognito Configuration (from SR-Identity outputs)
VITE_COGNITO_USER_POOL_ID=us-west-2_XXXXXXXXX
VITE_COGNITO_CLIENT_ID=1a2b3c4d5e6f7g8h9i0j1k2l3m
VITE_REGION=us-west-2

# Demo Mode (optional, for presentations)
VITE_DEMO_MODE=false
```

**Security Note**: Never commit `.env.local` to version control. It's already in `.gitignore`.

## Step 4: Install Dependencies and Build

```bash
npm install
npm run build
```

This creates production-optimized files in `frontend/dist/`.

## Step 5: Deploy Frontend to AWS

Deploy the frontend stack (S3 + CloudFront CDN):

```bash
cd ../infra/cdk
cdk deploy SR-Frontend
```

This automatically:
- Creates S3 bucket for static hosting
- Creates CloudFront distribution (global CDN)
- Uploads built files from `frontend/dist/`
- Outputs CloudFront URL

**Optional Manual Upload** (if you rebuild frontend without redeploying CDK):

```bash
# Get bucket name
BUCKET_NAME=$(aws cloudformation describe-stacks --stack-name SR-Frontend \
  --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" --output text)

# Sync files
aws s3 sync dist/ s3://$BUCKET_NAME/

# Invalidate CloudFront cache
DIST_ID=$(aws cloudformation describe-stacks --stack-name SR-Frontend \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" --output text)
aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*"
```

## Step 6: Configure Cognito Callback URLs

Add your CloudFront URL to Cognito's allowed redirect URIs:

1. Get CloudFront URL from CDK output
2. Go to AWS Console → Cognito → User Pools → AdminUsers → App clients
3. Edit "WebClient" settings
4. Add to "Callback URLs":
   - `https://your-cloudfront-domain.cloudfront.net`
   - `https://your-cloudfront-domain.cloudfront.net/callback`
5. Add to "Sign out URLs":
   - `https://your-cloudfront-domain.cloudfront.net/login`

## Step 7: Update API Gateway CORS

For the generated CloudFront frontend, no manual CORS update is required. CDK automatically allows the frontend distribution origin. If `CUSTOM_DOMAIN` is configured in `infra/cdk/.env`, CDK also allows that domain.

Then redeploy:
```bash
./scripts/deploy-infra.sh SR-Compute
```

## Step 8: Create Admin User

Create an initial admin user in Cognito:

**Option A: AWS Console**
1. Go to AWS Cognito → User Pools → AdminUsers
2. Click "Create user"
3. Enter email and temporary password
4. User will be prompted to change password on first login

**Option B: AWS CLI**
```bash
aws cognito-idp admin-create-user \
  --user-pool-id us-west-2_XXXXXXXXX \
  --username admin@yourdomain.com \
  --user-attributes Name=email,Value=admin@yourdomain.com Name=email_verified,Value=true \
  --temporary-password TempPassword123! \
  --message-action SUPPRESS
```

## Step 9: Access Your Dashboard

Open your CloudFront URL in a browser and log in with your admin credentials.

---

## Ongoing Maintenance (Business Adopters)

### Updating Frontend After Code Changes

```bash
cd frontend
npm run build
cd ../infra/cdk
cdk deploy SR-Frontend
```

### Monitoring

- **CloudWatch Logs**: Lambda and API Gateway logs
- **CloudFront Metrics**: Cache hit rates, origin latency
- **Cognito Metrics**: Sign-in success/failure rates

### Cost Optimization

- Enable CloudFront caching headers for static assets
- Use S3 Intelligent-Tiering for static files
- Monitor Lambda cold starts and adjust memory allocation

---

# B. Contributor Guide

## Prerequisites

- **Node.js 18+** and **npm 9+**
- **Git** for version control

## Quick Start (5 Minutes)

### Step 1: Clone Repository

```bash
git clone https://github.com/Yadab-Sd/smart-notification-routing-engine.git
cd smart-notification-routing-engine/frontend
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Get API Endpoint (Request from Maintainer)

You need the backend API endpoint to connect the frontend. **Contact the project maintainer** to get:

1. **API endpoint URL** (e.g., `https://abc123.execute-api.us-west-2.amazonaws.com`)
2. **Test user credentials** (email and password for localhost testing)

Email: **contact@intelligent-routing.com**

### Step 4: Configure Environment

Create `.env.local` in `frontend/` directory:

```bash
cp .env.example .env.local
```

Edit `.env.local` and add **only the API URL** provided by the maintainer:

```env
# API Configuration (provided by maintainer)
VITE_API_URL=https://abc123.execute-api.us-west-2.amazonaws.com

# Leave these blank - they're auto-configured for localhost
VITE_COGNITO_USER_POOL_ID=
VITE_COGNITO_CLIENT_ID=
VITE_REGION=us-west-2

# Optional: Enable demo mode if API is unavailable
VITE_DEMO_MODE=false
```

**Important**: You don't need AWS credentials, Cognito pool IDs, or any AWS CLI setup. The maintainer provides a shared development API endpoint for contributors.

### Step 5: Run Development Server

```bash
npm run dev
```

The app opens at **http://localhost:5173**

Log in with the test credentials provided by the maintainer.

---

## Development Workflow (Contributors)

### Available Commands

```bash
npm run dev          # Start dev server with hot reload
npm run build        # Build for production (to test build errors)
npm run preview      # Preview production build locally
npm run lint         # Run ESLint
```

### Making Changes

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**:
   - Add/modify components in `src/components/`
   - Add API functions in `src/api/`
   - Define types in `src/types/`
   - Use Tailwind utility classes for styling

3. **Test locally**:
   - Test on `localhost:5173` with test user credentials
   - Verify API calls work correctly
   - Check for TypeScript errors: `npm run build`
   - Run linter: `npm run lint`

4. **Commit and push**:
   ```bash
   git add .
   git commit -m "feat: add new feature"
   git push origin feature/your-feature-name
   ```

5. **Open Pull Request**:
   - Go to GitHub repository
   - Click "New Pull Request"
   - Describe your changes
   - Wait for maintainer review

### Project Structure (What You'll Work With)

```
frontend/
├── src/
│   ├── api/                 # API client functions (Axios + auth interceptor)
│   ├── components/
│   │   ├── auth/            # Login, signup, protected routes
│   │   ├── common/          # Layout, header, reusable components
│   │   └── [feature]/       # Feature-specific components
│   ├── pages/               # Top-level page components
│   ├── contexts/            # React contexts (AuthContext)
│   ├── hooks/               # Custom React hooks
│   ├── types/               # TypeScript type definitions
│   ├── utils/               # Utility functions
│   ├── App.tsx              # Root component with routing
│   └── main.tsx             # Entry point
├── .env.example             # Environment variables template
├── .env.local               # Your local config (gitignored)
├── package.json             # Dependencies and scripts
├── vite.config.ts           # Vite configuration
├── tailwind.config.js       # Tailwind CSS configuration
└── tsconfig.json            # TypeScript configuration
```

### Common Development Tasks

#### Add a New Page

1. Create component in `src/pages/NewPage.tsx`:
   ```tsx
   import Layout from '@/components/common/Layout'

   export default function NewPage() {
     return (
       <Layout title="New Page">
         <div>Your content here</div>
       </Layout>
     )
   }
   ```

2. Add route in `src/App.tsx`:
   ```tsx
   import NewPage from '@/pages/NewPage'

   // Inside Routes:
   <Route path="/new-page" element={<NewPage />} />
   ```

#### Add a Protected Route

Wrap route in `<ProtectedRoute>` in `src/App.tsx`:
```tsx
<Route element={<ProtectedRoute />}>
  <Route path="/protected" element={<ProtectedPage />} />
</Route>
```

#### Add a New API Endpoint

1. Create function in `src/api/[feature].ts`:
   ```typescript
   import { apiClient } from './client'

   export const getFeatureData = async () => {
     const response = await apiClient.get('/v1/feature')
     return response.data
   }
   ```

2. Use in component with React Query:
   ```tsx
   import { useQuery } from '@tanstack/react-query'
   import { getFeatureData } from '@/api/feature'

   const { data, isLoading } = useQuery({
     queryKey: ['feature'],
     queryFn: getFeatureData
   })
   ```

#### Style with Tailwind

Use utility classes:
```tsx
<div className="bg-white rounded-lg shadow-md p-6">
  <h2 className="text-2xl font-bold text-slate-900">Title</h2>
  <p className="text-sm text-slate-600 mt-2">Description</p>
</div>
```

Refer to [Tailwind CSS docs](https://tailwindcss.com/docs) for available utilities.

---

## Deployment (Not Your Responsibility)

**Contributors**: You don't need to worry about deployment. When your PR is merged to `main`, the maintainer will trigger automated deployment via GitHub Actions.

**Behind the scenes**: The GitHub Actions workflow builds the frontend and deploys to AWS S3 + CloudFront. You don't need AWS access for this.

---

## Environment Variables Reference

### For Contributors (Localhost Only)

| Variable | Description | How to Get |
|----------|-------------|------------|
| `VITE_API_URL` | Backend API endpoint | Request from maintainer |
| Test credentials | Email + password for login | Request from maintainer |

### For Business Adopters (Full Deployment)

| Variable | Description | Source |
|----------|-------------|--------|
| `VITE_API_URL` | Backend API Gateway URL | CDK output: SR-Compute → ApiUrl |
| `VITE_COGNITO_USER_POOL_ID` | Cognito User Pool ID | CDK output: SR-Identity → UserPoolId |
| `VITE_COGNITO_CLIENT_ID` | Cognito App Client ID | CDK output: SR-Identity → UserPoolClientId |
| `VITE_REGION` | AWS Region | Your chosen region (e.g., `us-west-2`) |
| `VITE_DEMO_MODE` | Use demo data (optional) | `true` or `false` |

---

## Troubleshooting

### Issue: "Module not found" errors

**Solution**: Reinstall dependencies:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: CORS errors in browser console

**Symptoms**:
```
Access to XMLHttpRequest at 'https://...' from origin 'http://localhost:5173'
has been blocked by CORS policy
```

**Solution**: Notify the maintainer. They need to add `localhost:5173` to API Gateway CORS configuration.

### Issue: 401 Unauthorized errors

**Possible causes**:
1. JWT token expired (log out and log back in)
2. Test user credentials incorrect
3. API endpoint URL wrong in `.env.local`

**Solution**: Try logging out and back in. If still failing, contact maintainer.

### Issue: "Network Error" when calling API

**Solution**: 
1. Verify `VITE_API_URL` in `.env.local` is correct
2. Check if API endpoint is reachable: `curl <VITE_API_URL>/v1/health`
3. If unreachable, contact maintainer

### Issue: Environment variables not loading

**Symptoms**: Console shows "Missing required environment variables"

**Solution**:
1. Ensure `.env.local` exists in `frontend/` directory
2. All variables must start with `VITE_` prefix
3. Restart dev server: `Ctrl+C` then `npm run dev`

### Issue: Hot reload not working

**Solution**:
```bash
# Kill dev server (Ctrl+C)
rm -rf node_modules/.vite
npm run dev
```

---

## Demo Mode (Optional)

If you want to work on the UI without API access, enable demo mode:

1. Set `VITE_DEMO_MODE=true` in `.env.local`
2. Restart dev server
3. Demo data generators are in `src/utils/demo-data.ts`
4. All API calls will return mock data

**Use cases**:
- Working on UI components without backend
- Testing analytics visualizations
- Creating screenshots for documentation

---

## Resources

- **React Documentation**: https://react.dev
- **Vite Documentation**: https://vitejs.dev
- **Tailwind CSS**: https://tailwindcss.com/docs
- **React Router**: https://reactrouter.com
- **TanStack Query**: https://tanstack.com/query/latest
- **Recharts**: https://recharts.org

---

## Support & Contact

**Contributors**: 
- Open an issue on GitHub for bugs or feature requests
- Email: contact@intelligent-routing.com for API access or test credentials

**Business Adopters**:
- For deployment support: contact@intelligent-routing.com
- GitHub: https://github.com/Yadab-Sd/smart-notification-routing-engine

---

## License

MIT License - see main repository for details.
