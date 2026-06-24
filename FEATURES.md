# 🎯 SNRE Features

Complete list of all features in the Smart Notification Routing Engine.

**Last Updated**: June 17, 2026  
**Version**: 1.0.0

---

## 📊 Core Features

### 1. ML-Powered Send-Time Optimization
**Status**: ✅ Production Ready

Predicts optimal notification delivery time using XGBoost machine learning model.

**How It Works**:
- Analyzes user engagement history (clicks, opens, events)
- Predicts probability of engagement for each hour in a time window
- Schedules notification at hour with highest predicted engagement

**Technical Details**:
- **Model**: XGBoost Classifier trained on user behavior data
- **Features**: 
  - Hour of day (0-23)
  - 7-day click rate
  - Send count per hour
- **Training**: Glue ETL job processes S3 events → Parquet → SageMaker
- **Inference**: SageMaker endpoint (real-time predictions)
- **Performance**: AUC-PR ~0.78

**API Endpoint**: `POST /v1/decisions/preview` or `/schedule`

**Files**:
- ML Training: `ml/train_sendtime.py`
- Decision Service: `services/decision-service/`
- SageMaker Endpoint: Deployed via `infra/cdk/lib/ml-stack.ts`

---

### 2. Multi-Channel Notification Delivery
**Status**: ✅ Production Ready

Sends notifications via multiple channels with intelligent fallback.

**Supported Channels**:
- ✅ **Email** (Amazon SES v2)
- ✅ **SMS** (Amazon SNS)
- 🔜 **Push Notifications** (planned)
- 🔜 **WhatsApp** (planned)

**Channel Selection Logic**:
1. Explicit channel from API request (highest priority)
2. User's preferred channel from profile
3. Smart fallback (EMAIL → SMS → PUSH)
4. Fail only if NO channel available

**Fallback Example**:
```
User requests SMS but has no phone number
→ Falls back to Email (if available)
→ Response includes: "channelUsed: EMAIL, fallback: true, reason: missing phone"
```

**Cost Per Message**:
- Email: $0.0001 (SES)
- SMS: $0.00645 (SNS)

**API Endpoint**: `POST /v1/send` (internal), invoked by scheduler or events

**Files**:
- Sender Service: `services/sender-service/`
- Channel Implementation: `services/sender-service/src/main/java/com/yadab/sr/sender/channels/`
- Design Pattern: Strategy Pattern + Factory Pattern

---

### 3. User Profile Management
**Status**: ✅ Production Ready

Manages user profiles with contact info, preferences, and engagement stats.

**User Profile Schema**:
```json
{
  "userId": "user123",
  "email": "user@example.com",
  "phone": "+12025551234",
  "prefs": {
    "channel": "EMAIL",
    "timezone": "America/New_York",
    "quietHours": {
      "start": 22,
      "end": 8
    }
  },
  "counters": {
    "events": 150,
    "sends": 45,
    "clicks": 23
  },
  "emailStatus": "ACTIVE",
  "createdAt": "2026-01-15T10:30:00Z",
  "createdBy": "API"
}
```

**Features**:
- ✅ Create, read, update, delete users
- ✅ Bulk import (CSV/JSON)
- ✅ Auto-creation on first event
- ✅ Email/SMS validation (E.164 format)
- ✅ User statistics tracking
- ✅ Channel preferences
- ✅ Quiet hours (planned enforcement)

**API Endpoints**:
- `POST /v1/users` - Create user
- `GET /v1/users` - List users (paginated)
- `GET /v1/users/{id}` - Get user profile
- `PUT /v1/users/{id}` - Update user
- `DELETE /v1/users/{id}` - Delete user
- `POST /v1/users/bulk` - Bulk import
- `GET /v1/users/stats` - User creation stats

**Files**:
- Control Plane: `services/control-plane/`
- User Model: `services/control-plane/src/main/java/com/yadab/sr/models/User.java`

---

### 4. Event Ingestion & Processing
**Status**: ✅ Production Ready

Real-time event ingestion with Kinesis stream processing.

**Event Types**:
- `CLICK` - User clicked notification
- `PLAY_MOVIE` - User engaged with content (treated as notification "send" in analytics)
- Custom event types

**Auto-Triggered Notifications**:
Events can include `notificationType` field to trigger automatic notifications:
- `"immediate"` - Send notification right now (transactional)
- `"optimized"` - Use ML to schedule at best time (marketing)
- `null` - Analytics only, no notification

**Data Flow**:
```
API → Kinesis Stream → Lambda Consumer → S3 (JSONL) + DynamoDB (counters)
                                       → Optional: Trigger Notification
```

**Features**:
- ✅ Auto-create user if doesn't exist
- ✅ Real-time counter updates (events, sends, clicks)
- ✅ Batch processing (up to 100 events)
- ✅ S3 partitioning by date/hour
- ✅ DynamoDB atomic counter increments
- ✅ JSONL format for data lake

**API Endpoint**: `POST /v1/events`

**Files**:
- Events Consumer: `services/events-consumer/`
- Control Plane: `services/control-plane/` (handles /events endpoint)

---

### 5. SES Bounce & Complaint Handling
**Status**: ✅ Production Ready (AWS SES Compliance)

Automatic suppression of bounced/complained emails to maintain sender reputation.

**What It Does**:
- Listens to SES bounce and complaint events via SNS
- Automatically adds problematic emails to suppression list
- Blocks future sends to suppressed emails
- Logs events for CAN-SPAM compliance

**Bounce Types**:
- **Hard Bounce** (Permanent): Suppress immediately (email doesn't exist)
- **Soft Bounce** (Transient): Suppress after 3 attempts (mailbox full, temporary issue)
- **Complaint**: Suppress immediately (user reported spam)

**Suppression Logic**:
```
Before every email send:
1. Check DynamoDB suppression list
2. If email is suppressed → Block send, return error
3. If email is clean → Proceed with send
```

**Compliance**:
- ✅ CAN-SPAM Act (immediate complaint suppression)
- ✅ AWS SES requirements (bounce handling)
- ✅ Audit trail (90 days for bounces, 1 year for complaints)

**Components**:
- SNS Topics: `ses-bounces`, `ses-complaints`
- Lambda: `SESEventProcessor`
- DynamoDB: `email-suppression-list`, `ses-event-logs`
- SES Config Set: `snre-production`

**Why This Matters**:
- Required for AWS SES production access approval
- Maintains sender reputation (bounce rate < 5%, complaint rate < 0.1%)
- Prevents wasted costs sending to bad addresses

**Files**:
- SES Event Processor: `services/ses-event-processor/`
- Suppression Check: `services/sender-service/.../EmailChannel.java` (line 48-58)
- Infrastructure: `infra/cdk/lib/messaging-stack.ts`, `infra/cdk/lib/ses-configuration.ts`

**Documentation**: See `AWS_SES_PRODUCTION_ACCESS.md`

---

### 6. Template Rendering
**Status**: ✅ Production Ready

Handlebars template engine for dynamic content.

**Features**:
- ✅ HTML + plain text versions
- ✅ Variable substitution ({{userId}}, {{email}}, etc.)
- ✅ S3-based template storage
- ✅ Fallback inline template
- ✅ Custom templates per notification

**Example Template**:
```html
<html>
<body>
  <h1>Hello {{userId}}!</h1>
  <p>Your email is {{email}}</p>
  <p>Notification sent at optimal time for your engagement.</p>
</body>
</html>
```

**Template Storage**: `s3://{curated-bucket}/templates/`

**Files**:
- Sender Handler: `services/sender-service/src/main/java/com/yadab/sr/sender/Handler.java` (renderTemplate method)

---

### 7. EventBridge Scheduler Integration
**Status**: ✅ Production Ready

Schedules notifications at ML-predicted optimal times.

**How It Works**:
1. Decision service predicts best hour (e.g., 2 PM today)
2. Creates EventBridge schedule for that time
3. EventBridge invokes Sender Lambda at scheduled time
4. Sender delivers notification

**Features**:
- ✅ One-time schedules (no recurring)
- ✅ Automatic cleanup after execution
- ✅ Flexible time window (1-48 hours)
- ✅ UTC timezone

**Schedule Format**:
```
at(2026-06-17T14:00:00)  // Send at 2 PM UTC
```

**IAM Role**: EventBridge assumes role to invoke Sender Lambda

**Files**:
- Decision Service: `services/decision-service/` (lines 182-213)
- CDK: `infra/cdk/lib/compute-stack.ts` (scheduler role creation)

---

### 8. Analytics Dashboard
**Status**: ✅ Production Ready

Real-time analytics showing engagement, ML performance, and system health.

**Metrics Tracked**:
- Total events ingested
- Active users
- Average engagement rate
- ML model AUC-PR
- Bounce/complaint rates
- Cost per notification

**Data Sources**:
- DynamoDB user profiles (aggregated counters)
- S3 event logs (Athena queries)
- CloudWatch metrics
- SageMaker model metadata

**Dashboard Components**:
1. **Metrics Overview**: KPIs (events, users, engagement, model accuracy)
2. **Engagement Trends**: Baseline vs ML-optimized (line chart)
3. **ML Model Performance**: Training curves, feature importance
4. **Send-Time Heatmap**: 24×7 grid showing optimal hours
5. **System Health**: Lambda metrics, Kinesis throughput, SageMaker latency
6. **Impact Calculator**: ROI calculator (engagement lift → revenue impact)

**API Endpoints**:
- `GET /v1/analytics/metrics` - KPI overview
- `GET /v1/analytics/system-health` - System status

**Files**:
- Frontend: `frontend/src/pages/Analytics.tsx`
- Backend: `services/analytics-service/`
- Components: `frontend/src/components/analytics-dashboard/`

---

### 9. Authentication & Authorization
**Status**: ✅ Production Ready

AWS Cognito-based authentication with JWT tokens.

**Features**:
- ✅ User signup/login
- ✅ JWT token-based API access
- ✅ Password strength validation
- ✅ Email verification
- ✅ Protected routes

**Authentication Flow**:
```
1. User logs in → Cognito
2. Cognito returns JWT token
3. Frontend stores token in localStorage
4. API requests include: Authorization: Bearer {token}
5. API Gateway validates JWT
6. Lambda receives validated user info
```

**User Pool**: `AdminUsers` (Cognito)

**Files**:
- Frontend Auth: `frontend/src/api/auth.ts`, `frontend/src/contexts/AuthContext.tsx`
- CDK: `infra/cdk/lib/identity-stack.ts`

---

### 10. Data Lake & ETL Pipeline
**Status**: ✅ Production Ready

S3 data lake with AWS Glue ETL for ML training.

**Data Flow**:
```
Events → Kinesis → Lambda → S3 (raw JSONL, partitioned by date/hour)
                                ↓
                           Glue ETL Job
                                ↓
                           S3 (curated Parquet, ML-ready features)
                                ↓
                           SageMaker Training
```

**Data Formats**:
- **Raw**: JSONL (newline-delimited JSON)
- **Curated**: Parquet (columnar, compressed)

**S3 Buckets**:
- `events-raw`: Raw event data
- `deliveries-raw`: Notification delivery logs
- `curated`: ML-ready feature datasets
- `models`: Trained model artifacts

**Partitioning**:
```
raw/dt=2026-06-17/h=14/events-{uuid}.jsonl
curated/train/features.parquet
curated/validation/features.parquet
```

**Glue ETL Job**: `glue-jobs/build_hourly_features.py`

**Files**:
- Data Stack: `infra/cdk/lib/data-stack.ts`
- Glue Job: `glue-jobs/build_hourly_features.py`

---

## 🎨 Frontend Features

### 11. User Dashboard
**Status**: 🚧 In Progress

Customer-facing interface for notification management.

**Planned Features**:
- Schedule notification form
- ML optimal time preview
- User preferences editor
- Notification history
- Engagement stats

**Current State**: Placeholder UI

**File**: `frontend/src/pages/Dashboard.tsx`

---

### 12. Admin Analytics Dashboard
**Status**: ✅ Production Ready

Business intelligence dashboard for system operators.

**Features**:
- Real-time KPI metrics
- Engagement trend charts (Recharts)
- ML model performance visualization
- Send-time heatmap
- System health monitoring
- Business impact calculator

**File**: `frontend/src/pages/Analytics.tsx`

---

### 13. Responsive UI
**Status**: ✅ Production Ready

Mobile-first design with Tailwind CSS.

**Features**:
- ✅ Responsive layout (mobile, tablet, desktop)
- ✅ Dark mode support (via Tailwind)
- ✅ Component library (buttons, cards, forms)
- ✅ Icon system (Lucide React)
- ✅ Accessible (WCAG 2.1 AA)

**Design System**: Tailwind CSS utility classes

**Files**: `frontend/src/` (all components)

---

### 14. Promotional Banner System
**Status**: ✅ Production Ready

Dismissible banner promoting SNRE deployment to organizations.

**Features**:
- ✅ Shows on public pages (login, register)
- ✅ Hides after authentication
- ✅ Dismissible (stores state in localStorage)
- ✅ Links to landing page

**Messaging**: "Deploy SNRE to Your Organization • Zero-cost deployment with full technical support"

**Files**:
- Banner Component: `frontend/src/components/common/PilotProgramBanner.tsx`
- Landing Page: Separate repo (Smart Notification Routing Engine Landing)

---

## 🏗️ Infrastructure Features

### 15. Infrastructure as Code (AWS CDK)
**Status**: ✅ Production Ready

Complete AWS infrastructure defined in TypeScript CDK.

**Stacks**:
1. **SR-Network**: VPC, subnets, NAT gateways
2. **SR-Security**: KMS encryption keys
3. **SR-Identity**: Cognito user pools
4. **SR-Data**: DynamoDB, Kinesis, S3 buckets, Glue catalog
5. **SR-Messaging**: SNS, SES config, suppression handling
6. **SR-Compute**: Lambda functions, API Gateway
7. **SR-ML**: SageMaker endpoint
8. **SR-Frontend**: S3 + CloudFront

**Features**:
- ✅ Modular stack design
- ✅ Cross-stack references
- ✅ Environment-agnostic
- ✅ Deterministic outputs (no random suffixes)

**Files**: `infra/cdk/lib/`

---

### 16. Automated Deployment
**Status**: ✅ Production Ready

One-command deployment via CDK.

**Build Script**:
```bash
./scripts/build-services.sh
# Builds all 7 Lambda JARs in one command
```

**Deploy Script**:
```bash
cd infra/cdk
npx cdk deploy --all
# Deploys entire infrastructure
```

**Deployment Time**: ~15-20 minutes (first time), ~5-10 minutes (updates)

**Files**:
- Build: `scripts/build-services.sh`
- Deploy: `infra/cdk/`

---

### 17. Monitoring & Observability
**Status**: ✅ Production Ready

CloudWatch-based monitoring.

**Metrics Tracked**:
- Lambda invocations, errors, duration
- Kinesis stream throughput
- DynamoDB read/write capacity
- API Gateway requests, latency
- SageMaker endpoint invocations

**Logs**:
- Lambda logs: `/aws/lambda/{function-name}`
- API Gateway logs
- SES events

**Planned**:
- 🔜 CloudWatch Dashboards (pre-configured)
- 🔜 X-Ray tracing
- 🔜 Custom business metrics

---

### 18. Security Features
**Status**: ✅ Implemented Core Controls

AWS-native security controls for self-hosted deployments.

**Features**:
- ✅ KMS encryption (S3, DynamoDB, Kinesis)
- ✅ VPC isolation for Lambda
- ✅ IAM least-privilege policies
- ✅ JWT authentication
- ✅ HTTPS-only (API Gateway, CloudFront)
- ✅ Secrets in environment variables (not code)
- ✅ Input validation (email format, phone E.164)

**Compliance-supporting controls**:
- ✅ SES bounce/complaint handling for suppression workflows
- ✅ Data minimization and TTL-based deletion options
- ✅ Audit logs and encryption controls that adopters can map to their own policies

Adopting organizations remain responsible for legal and regulatory compliance.

---

## 📈 Planned Features (Roadmap)

### Phase 2: Enhanced User Experience
- 🔜 Quiet hours enforcement (no sends during user's sleep hours)
- 🔜 Timezone-aware scheduling
- 🔜 User notification preferences (frequency caps)
- 🔜 Unsubscribe management

### Phase 3: Advanced Analytics
- 🔜 A/B testing framework (ML vs random vs fixed time)
- 🔜 Campaign management (group notifications by business goal)
- 🔜 Cohort analysis
- 🔜 Real-time dashboards (WebSocket updates)

### Phase 4: ML Enhancements
- 🔜 Per-user personalized models (vs global model)
- 🔜 Content optimization (ML predicts best message variant)
- 🔜 Churn prediction (identify users likely to unsubscribe)
- 🔜 Anomaly detection (unusual engagement patterns)

### Phase 5: Additional Channels
- 🔜 Push notifications (FCM, APNs)
- 🔜 WhatsApp Business API
- 🔜 Slack integration
- 🔜 In-app notifications

### Phase 6: National Interest Features
- 🔜 Emergency alert fatigue detection
- 🔜 Multi-jurisdictional alert deduplication
- 🔜 Healthcare appointment no-show prediction
- 🔜 Cognitive accessibility for dementia patients
- 🔜 Real-time translation for LEP populations
- 🔜 Notification fraud detection

(See proposal document for detailed feature specs)

---

## 📊 Feature Status Legend

- ✅ **Production Ready**: Fully implemented, tested, deployed
- 🚧 **In Progress**: Partially implemented, not production-ready
- 🔜 **Planned**: Designed but not yet implemented
- ❌ **Deprecated**: Removed or replaced

---

## 🔄 Version History

### v1.0.0 (June 2026)
- ✅ ML-powered send-time optimization
- ✅ Multi-channel delivery (Email, SMS)
- ✅ User profile management
- ✅ Event ingestion pipeline
- ✅ SES bounce/complaint handling
- ✅ Template rendering
- ✅ EventBridge scheduling
- ✅ Analytics dashboard
- ✅ AWS CDK infrastructure
- ✅ Cognito authentication

---

## 📝 Notes

- **Tech Stack**: Java 21 (backend), React 18 + TypeScript (frontend), AWS services
- **ML Framework**: XGBoost (Python), SageMaker (inference)
- **Database**: DynamoDB (NoSQL), S3 (data lake)
- **Streaming**: Kinesis
- **Architecture**: Event-driven, serverless

---

**For detailed implementation docs, see**:
- Architecture: `docs/ARCHITECTURE.md`
- API Reference: `docs/API.md`
- Deployment: `DEPLOYMENT.md`
- SES Setup: `AWS_SES_PRODUCTION_ACCESS.md`

---

**Last Updated**: June 17, 2026 by AI Assistant
