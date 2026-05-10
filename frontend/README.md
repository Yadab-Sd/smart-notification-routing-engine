# Smart Notification Routing Engine - Frontend

## Overview

This is the web-based dashboard for the **Smart Notification Routing Engine**, a machine learning-powered system that optimizes notification delivery times to maximize user engagement. This frontend provides:

- **User Dashboard**: Customer-facing interface for scheduling notifications with ML-predicted optimal send times
- **Analytics Dashboard**: Visualizations showing ML model performance, engagement metrics, and business impact
- **Authentication**: Secure login via AWS Cognito

**Purpose**: This frontend is being developed to demonstrate the technical innovation and national interest value of the ML notification optimization system.

---

## Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite (fast development and optimized production builds)
- **Styling**: Tailwind CSS (utility-first CSS framework)
- **Routing**: React Router v6
- **State Management**:
  - TanStack Query (React Query) for server state
  - Zustand for client state (auth, UI preferences)
- **Authentication**: AWS Cognito (amazon-cognito-identity-js)
- **HTTP Client**: Axios with auth interceptors
- **Charts**: Recharts (for analytics visualizations)
- **Icons**: Lucide React
- **Deployment**: AWS S3 + CloudFront (via CDK)

---

## Prerequisites

Before starting, ensure you have:

1. **Node.js 18+** (check with `node --version`)
2. **npm 9+** (check with `npm --version`)
3. **AWS CLI** configured with credentials
4. **Backend infrastructure deployed** (CDK stacks: SR-Identity, SR-Compute, SR-Data)
5. **Git** for version control

---

## Project Structure

```
frontend/
├── public/                  # Static assets
├── src/
│   ├── api/                 # API client functions
│   │   ├── client.ts        # Axios instance with auth interceptor
│   │   ├── auth.ts          # Cognito authentication
│   │   ├── users.ts         # User profile APIs
│   │   ├── events.ts        # Event ingestion
│   │   └── decisions.ts     # ML prediction APIs
│   ├── components/
│   │   ├── auth/            # Login, signup, protected routes
│   │   ├── common/          # Layout, header, shared components
│   │   ├── user-dashboard/  # User-facing components
│   │   └── analytics-dashboard/  # Analytics visualizations
│   ├── pages/               # Top-level page components
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Analytics.tsx
│   │   └── NotFound.tsx
│   ├── contexts/            # React contexts
│   │   └── AuthContext.tsx  # Global auth state
│   ├── hooks/               # Custom React hooks
│   ├── types/               # TypeScript type definitions
│   ├── utils/               # Utility functions
│   ├── styles/              # Global styles (Tailwind)
│   ├── config/              # Environment configuration
│   ├── App.tsx              # Root component with routing
│   └── main.tsx             # Application entry point
├── .env.example             # Environment variables template
├── .env.local               # Local environment variables (gitignored)
├── package.json             # Dependencies and scripts
├── vite.config.ts           # Vite configuration
├── tailwind.config.js       # Tailwind CSS configuration
├── tsconfig.json            # TypeScript configuration
└── README.md                # This file
```

---

## Setup Instructions (From Scratch)

### Step 1: Install Dependencies

```bash
cd frontend
npm install
```

This installs all required packages:
- React, React DOM, React Router
- TanStack Query, Zustand, Axios
- Cognito identity SDK
- Recharts, Lucide React
- Tailwind CSS, PostCSS, Autoprefixer
- TypeScript, Vite, ESLint

### Step 2: Deploy Backend Infrastructure

If you haven't already deployed the backend:

```bash
cd ../infra/cdk
npm install
npm run build

# Deploy required stacks
cdk deploy SR-Network SR-Security SR-Identity SR-Data SR-Messaging SR-Compute
```

**Important**: Wait for deployment to complete and note the outputs.

### Step 3: Get AWS Configuration Values

After deploying the backend, retrieve these values from CDK outputs:

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

Or check the AWS CloudFormation console:
- Navigate to CloudFormation → Stacks → SR-Compute → Outputs
- Navigate to CloudFormation → Stacks → SR-Identity → Outputs

### Step 4: Configure Environment Variables

Create `.env.local` file in the `frontend/` directory:

```bash
cd frontend
cp .env.example .env.local
```

Edit `.env.local` with your AWS values:

```env
# API Configuration
VITE_API_URL=https://your-api-id.execute-api.us-west-2.amazonaws.com

# Cognito Configuration
VITE_COGNITO_USER_POOL_ID=us-west-2_XXXXXXXXX
VITE_COGNITO_CLIENT_ID=1a2b3c4d5e6f7g8h9i0j1k2l3m
VITE_REGION=us-west-2

# Demo Mode (set to 'true' to use demo data for any presentation)
VITE_DEMO_MODE=false
```

**Important**: Never commit `.env.local` to git (it's in .gitignore).

### Step 5: Create a Test User in Cognito

You need a user to log in. Create one via AWS Console or CLI:

**Option A: AWS Console**
1. Go to AWS Cognito → User Pools → AdminUsers
2. Click "Create user"
3. Enter email and temporary password
4. User will be prompted to change password on first login

**Option B: AWS CLI**
```bash
aws cognito-idp admin-create-user \
  --user-pool-id us-west-2_XXXXXXXXX \
  --username user@example.com \
  --user-attributes Name=email,Value=user@example.com Name=email_verified,Value=true \
  --temporary-password TempPassword123! \
  --message-action SUPPRESS
```

### Step 6: Run Development Server

```bash
npm run dev
```

The app will open at **http://localhost:5173**

You should see the login page. Try logging in with your test user credentials.

---

## Development Workflow

### Running the App

```bash
npm run dev          # Start development server (hot reload)
npm run build        # Build for production
npm run preview      # Preview production build locally
npm run lint         # Run ESLint
```

### Making Changes

1. **Component Development**: Create new components in `src/components/`
2. **API Integration**: Add API functions in `src/api/`
3. **Type Safety**: Define types in `src/types/`
4. **Styling**: Use Tailwind utility classes (see `tailwind.config.js`)

### Common Tasks

**Add a new page:**
1. Create component in `src/pages/NewPage.tsx`
2. Add route in `src/App.tsx`:
   ```tsx
   <Route path="/new-page" element={<NewPage />} />
   ```

**Add a new API endpoint:**
1. Create function in appropriate `src/api/*.ts` file
2. Use `apiClient` from `src/api/client.ts` (automatically includes auth headers)

**Add a protected route:**
Wrap route in `<ProtectedRoute>` in `src/App.tsx`:
```tsx
<Route element={<ProtectedRoute />}>
  <Route path="/protected" element={<ProtectedPage />} />
</Route>
```

---

## Deployment to AWS

### Step 1: Build Frontend

```bash
npm run build
```

This creates optimized production files in `frontend/dist/`.

### Step 2: Deploy Frontend Stack

```bash
cd ../infra/cdk
cdk deploy SR-Frontend
```

This creates:
- S3 bucket for hosting
- CloudFront distribution (CDN)
- Outputs: CloudFront URL

### Step 3: Upload Files to S3

The CDK stack uses `BucketDeployment` which automatically uploads files from `frontend/dist/`.

If you need to manually update later:

```bash
# Get bucket name from CDK output
BUCKET_NAME=$(aws cloudformation describe-stacks --stack-name SR-Frontend \
  --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" --output text)

# Sync files
aws s3 sync dist/ s3://$BUCKET_NAME/

# Get distribution ID
DIST_ID=$(aws cloudformation describe-stacks --stack-name SR-Frontend \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" --output text)

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*"
```

### Step 4: Update Cognito Callback URLs

After deployment, add CloudFront URL to Cognito:

1. Get CloudFront URL from CDK output
2. Go to AWS Cognito → User Pools → AdminUsers → App clients
3. Edit "WebClient" settings
4. Add to "Callback URLs":
   - `https://your-cloudfront-domain.cloudfront.net`
   - `https://your-cloudfront-domain.cloudfront.net/callback`
5. Add to "Sign out URLs":
   - `https://your-cloudfront-domain.cloudfront.net`
   - `https://your-cloudfront-domain.cloudfront.net/login`

### Step 5: Update API Gateway CORS

Add CloudFront URL to CORS allowed origins in `infra/cdk/lib/compute-stack.ts`:

```typescript
allowOrigins: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://your-cloudfront-domain.cloudfront.net', // Add this
],
```

Then redeploy:
```bash
cdk deploy SR-Compute
```

---

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API Gateway endpoint | `https://abc123.execute-api.us-west-2.amazonaws.com` |
| `VITE_COGNITO_USER_POOL_ID` | Cognito User Pool ID | `us-west-2_ABC123DEF` |
| `VITE_COGNITO_CLIENT_ID` | Cognito App Client ID | `1a2b3c4d5e6f7g8h9i0j1k2l3m` |
| `VITE_REGION` | AWS Region | `us-west-2` |
| `VITE_DEMO_MODE` | Use demo data (for any presentation) | `true` or `false` |

---

## Architecture Overview

### Authentication Flow

1. User enters email/password in `LoginForm.tsx`
2. `AuthContext` calls `signIn()` from `src/api/auth.ts`
3. Cognito authenticates and returns JWT token
4. Token stored in localStorage
5. `apiClient` automatically adds `Authorization: Bearer <token>` header to all API requests
6. If 401 error, user redirected to login

### API Request Flow

```
Component → React Query (useQuery/useMutation)
           ↓
API Function (src/api/*.ts)
           ↓
Axios Client (src/api/client.ts) + Auth Interceptor
           ↓
API Gateway (with CORS + JWT validation)
           ↓
Lambda Function (Java 21)
           ↓
Response → React Query Cache → Component Update
```

### Protected Routes

- All routes under `<ProtectedRoute>` require authentication
- If not authenticated → redirect to `/login`
- If authenticated → render requested page
- Implemented in `src/components/auth/ProtectedRoute.tsx`

---

## Available API Endpoints

Current backend APIs (see `src/api/` for client functions):

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/v1/health` | Health check | Public |
| POST | `/v1/events` | Ingest user event | JWT |
| GET | `/v1/users/{id}` | Get user profile | JWT |
| PUT | `/v1/users/{id}/preferences` | Update user preferences | JWT |
| POST | `/v1/decisions/preview` | Get optimal send time (no scheduling) | JWT |
| POST | `/v1/decisions/schedule` | Get optimal time + schedule notification | JWT |

---

## Troubleshooting

### Issue: "Module not found" errors

**Solution**: Ensure all dependencies are installed:
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

**Solution**:
1. Check API Gateway CORS configuration in `infra/cdk/lib/compute-stack.ts`
2. Verify `localhost:5173` is in `allowOrigins`
3. Redeploy: `cd infra/cdk && cdk deploy SR-Compute`

### Issue: 401 Unauthorized errors

**Possible causes**:
1. JWT token expired (tokens expire after 1 hour)
2. User Pool ID or Client ID incorrect in `.env.local`
3. API Gateway authorizer misconfigured

**Solution**:
1. Try logging out and back in
2. Verify environment variables match CDK outputs
3. Check CloudWatch Logs for API Gateway and Lambda

### Issue: Cognito login fails with "User does not exist"

**Solution**: Create user in Cognito User Pool:
```bash
aws cognito-idp admin-create-user \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --username user@example.com \
  --user-attributes Name=email,Value=user@example.com Name=email_verified,Value=true \
  --temporary-password TempPassword123!
```

### Issue: Environment variables not loading

**Symptoms**: Console shows "Missing required environment variables"

**Solution**:
1. Ensure `.env.local` exists in `frontend/` directory
2. All variables must start with `VITE_` prefix
3. Restart dev server after changing `.env.local`

### Issue: Hot reload not working

**Solution**:
```bash
# Kill dev server (Ctrl+C)
# Clear Vite cache
rm -rf node_modules/.vite
# Restart
npm run dev
```

---

## Demo Mode (for any Presentation)

To use demo data instead of real API calls (useful for any presentation when backend isn't fully populated):

1. Set `VITE_DEMO_MODE=true` in `.env.local`
2. Demo data generators are in `src/utils/demo-data.ts`
3. Analytics charts will show compelling 40-60% engagement improvement

**Demo Data Includes**:
- Synthetic engagement trends (baseline vs ML-optimized)
- ML model training curves
- Send-time heatmaps
- KPI metrics

---

## Next Development Phases

### Phase 2: User Dashboard (Planned)
- [ ] Schedule notification form with date/time picker
- [ ] Call ML prediction API and display optimal send time
- [ ] User preferences editor (timezone, quiet hours)
- [ ] Notification history (localStorage-based)
- [ ] Engagement stats visualization

### Phase 3: Analytics Dashboard (Planned)
- [ ] Implement demo data generators
- [ ] Engagement trends chart (Recharts LineChart)
- [ ] ML model performance visualization
- [ ] Send-time heatmap (24×7 grid)
- [ ] Impact calculator with sliders

### Phase 4: Production Enhancements (Optional)
- [ ] Real-time analytics from CloudWatch Logs Insights
- [ ] Athena queries on S3 data lake
- [ ] Notification history from EventBridge Scheduler
- [ ] Template management UI
- [ ] A/B testing dashboard

---

## Resources

- **React Documentation**: https://react.dev
- **Vite Documentation**: https://vitejs.dev
- **Tailwind CSS**: https://tailwindcss.com/docs
- **React Router**: https://reactrouter.com
- **TanStack Query**: https://tanstack.com/query/latest
- **AWS Cognito SDK**: https://www.npmjs.com/package/amazon-cognito-identity-js
- **Recharts**: https://recharts.org

---

## Support & Contact

For questions about this project:
- Check the troubleshooting section above
- Review CDK stack outputs for correct configuration
- Check CloudWatch Logs for backend errors

---

## License

This project is part of the Smart Notification Routing Engine system developed for  demonstrating technical innovation and national interest value in ML-powered notification optimization.
