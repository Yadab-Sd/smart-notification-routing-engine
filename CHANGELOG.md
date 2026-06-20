# CHANGELOG

All notable changes to Smart Notification Routing Engine will be documented in this file.

## [2.1.0] - 2026-06-20

### Major Features

#### Attention Escrow MVP

- **NEW**: Attention Escrow decision layer for trust-aware notification routing
- **NEW**: `AttentionLedger` DynamoDB table for decision and delivery audit records
- **NEW**: Attention decision records with cost, value, margin, fatigue score, trust score, and reason
- **NEW**: Delivery records written by sender service for Attention Escrow traceability
- **NEW**: Business summary endpoint for Attention Escrow dashboard metrics
- **NEW**: Attention dashboard with decision KPIs, preview workflow, and latest decision details

#### Optimized Event Payload

- **NEW**: Nested `notification.deliveryMode` support with `IMMEDIATE` and `OPTIMIZED`
- **NEW**: Attention Escrow payload fields for `sourceId`, `campaignId`, `templateId`, `messageCategory`, `priorityClass`, `businessValue`, and `urgency`
- Backward compatibility retained for legacy top-level `notificationType: "immediate|optimized"`

#### SES Compliance and Suppression

- **NEW**: SES bounce and complaint handling through SNS and SES Event Processor
- **NEW**: DynamoDB email suppression list updates for bounced and complained addresses
- Fixed user profile table wiring for SES event processing
- Improved SES configuration set event publishing and default tracking behavior

#### Deployment and Contributor Experience

- **NEW**: Local infrastructure deployment helper: `./scripts/deploy-infra.sh`
- **NEW**: Local frontend deployment helper: `./scripts/deploy-frontend.sh`
- **NEW**: Local CloudFront invalidation helper: `./scripts/invalidate-frontend.sh`
- **NEW**: Optional manual GitHub Actions frontend deployment workflow with OIDC
- Improved infrastructure CI reliability with pnpm, Lambda artifact builds, offline CDK synth context, and Ruby setup for `cfn-nag`
- Updated GitHub Actions Node runtime to Node 24

#### Pilot and Adoption Readiness

- **NEW**: Pilot program documentation for controlled organizational testing
- Improved business adoption positioning for pilots, hosted trials, and permanent adopter-owned deployments
- Improved contributor guide and deployment documentation
- Updated architecture diagram and Attention Escrow documentation

### API Changes

**New and enhanced endpoints:**

- `GET /v1/attention/summary` - Attention Escrow business summary metrics
- `POST /v1/events` - Enhanced with nested `notification.deliveryMode` and Attention Escrow fields
- `POST /v1/decisions/preview` - Enhanced with Attention Escrow decision context

### Infrastructure Changes

- Adds `AttentionLedger` DynamoDB table
- Adds environment variables and permissions needed for Attention Escrow decision and delivery writes
- Adds SES bounce/complaint processing resources and suppression list integrations

### Compatibility

- **Backward Compatible**: Yes for existing event clients using legacy `notificationType`
- **CDK Deploy Required**: Yes, because this release adds and updates AWS resources
- **Recommended Version Type**: Minor release, because the release is additive and does not intentionally remove existing API behavior

---

## [2.0.0] - 2026-06-15

### 🎉 Major Features

#### User Management

- **NEW**: User Management Interface - Complete CRUD operations from dashboard
- **NEW**: User Statistics API - `GET /v1/users/stats` for creation analytics
- **NEW**: List Users API - `GET /v1/users` with pagination support
- **NEW**: Auto-user creation - Events auto-create users with contact info if not exists

#### Event Management

- **NEW**: Event Sending Interface - Manual event testing from dashboard
- **NEW**: Custom email subjects - Extract subject from event metadata
- Support for immediate, optimized, and analytics-only notification types
- Real-time event log with success/error tracking

#### Documentation

- **NEW**: Terms of Service (`TERMS_OF_SERVICE.md`)
- **NEW**: Pre-Deployment Checklist (`PRE_DEPLOYMENT_CHECKLIST.md`)
- **NEW**: Compliance Guide (`COMPLIANCE.md`)
- **NEW**: Business Adoption Guide (`BUSINESS_ADOPTION.md`)

#### Infrastructure & CI/CD

- **NEW**: Complete CI/CD pipeline with GitHub Actions
  - Frontend CI (lint, build, test, security audit)
  - Backend CI (all 6 services with Maven)
  - Infrastructure CI (CDK synth, cfn-nag, cost estimation)
- **NEW**: Branch protection with required status checks
- **NEW**: Security hardening with explicit GITHUB_TOKEN permissions
- Universal branch triggers (works on all branches, not just feature/\*)

### Bug Fixes

- Fixed routing order for `/v1/users/stats` endpoint (was returning 404)
- Fixed API endpoint configuration (`VITE_API_URL` instead of `VITE_API_ENDPOINT`)
- Fixed authentication imports (`@/contexts/AuthContext` instead of `@/lib/auth`)
- Fixed email subject extraction from event metadata
- Fixed ESLint configuration for frontend
- Fixed frontend build issues with missing imports
- Fixed npm cache errors in infrastructure CI

### Improvements

- Centralized API configuration in `@/config/env`
- Better error handling in user creation
- Improved logging in sender service
- Path filters in CI workflows to prevent unnecessary runs
- Non-blocking security audits (reports but doesn't fail)

### API Changes

**New Endpoints:**

- `GET /v1/users` - List all users (paginated)
- `GET /v1/users/stats` - Get user creation statistics
  **Enhanced Endpoints:**
- `POST /v1/events` - Now auto-creates users if they don't exist
- Email sending now respects `metadata.subject` from events

### Security

- Explicit GITHUB_TOKEN permissions following least privilege
- Security audit in CI pipeline
- Terms of Service for legal protection
- Compliance documentation for GDPR, HIPAA, CAN-SPAM, TCPA

### Dependencies

- No breaking changes to existing dependencies
- All existing deployments remain compatible

### Migration Guide

See [MIGRATION.md](MIGRATION.md) for upgrade instructions

---

## [1.0.1] - 2026-06-07

### Zenodo Inclusion

- Included Zenodo for citation

---

## [1.0.0] - 2026-06-03

### Initial Release

- Core notification routing engine
- ML-based delivery optimization
- Multi-channel support (Email, SMS)
- User preference management
- CloudWatch monitoring
- Basic dashboard UI
