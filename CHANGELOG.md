# CHANGELOG

All notable changes to Smart Notification Routing Engine will be documented in this file.

## [Unreleased]

---

## [2.4.0] - 2026-06-25

### Added

- Reusable Campaign Library with saved campaign create/list/update/delete APIs
- Campaign library UI for saving, loading, updating, deleting, and relaunching campaign configurations
- Campaign-scoped launch history filtering after loading a saved campaign
- Campaign-wide outcome action from the campaign library, aggregating all launches for the same campaign source
- Campaign model stored as organization-scoped configuration records

### Changed

- Campaigns page now treats a campaign as a reusable plan and a launch as one execution of that plan
- Recent launches can switch between a selected campaign view and all launches
- Campaign documentation and feature list now explain saved campaigns, launches, and campaign-wide outcomes

### Fixed

- Campaign priority compatibility for older/stale `TRANSACTIONAL` priority values by mapping them to `STANDARD`
- Category listing now filters only category records when campaigns share the same configuration table

### Compatibility

- **Backward Compatible**: Yes. Existing campaign launch history and event ingestion continue to work.
- **CDK Deploy Required**: Yes, because this release adds `/v1/campaigns` API routes.
- **Recommended Version Type**: Minor release, because this adds reusable campaign management without intentionally removing existing behavior.

---

## [2.3.0] - 2026-06-24

### Added

- Campaign batch preview API: `POST /v1/decisions/batch-preview`
- Campaign draft workbench for previewing multiple users before launch
- Campaign-level Attention Escrow summary with send/defer/not-found counts, average value/cost, fatigue, probability, attention saved, and recommendation
- Campaign launch actions from preview through the existing `/v1/events` flow
- Admin override checkbox for deliberately including deferred users in campaign launch
- `modelSource`, `modelConfidence`, and explanatory startup heuristic messaging when SageMaker send-time endpoint is unavailable
- Optional nightly ML pipeline EventBridge schedule configuration

### Changed

- Campaigns page now uses real preview and launch workflows instead of static demo rows
- Decision Service now has a shared single-decision evaluation path used by preview, schedule, and batch preview
- Frontend registration and adoption-facing documentation now avoid certification/compliance promises and clarify adopter responsibilities
- Frontend stack output now surfaces the configured custom frontend domain when available

### Fixed

- Scheduled recommendations avoid immediate/current-time execution and enforce a minimum lead time
- Sender Service deletes completed one-time EventBridge schedules after delivery
- Native select dropdown rendering is used to avoid displaced option menus

### Compatibility

- **Backward Compatible**: Yes. Existing `/v1/events`, `/v1/decisions/preview`, and `/v1/decisions/schedule` clients continue to work.
- **CDK Deploy Required**: Yes, because this release adds the `/v1/decisions/batch-preview` API route and ML schedule configuration.
- **Recommended Version Type**: Minor release, because the release adds campaign/batch capabilities without intentionally removing existing behavior.

---

## [2.2.0] - 2026-06-23

### Added

- Notification category configuration API with create/list/get/update/delete endpoints
- Admin console page for creating, editing, and deleting notification categories
- Send Event category selector with editable category-derived defaults
- Attention Escrow decision workbench actions for preview, schedule recommended time, send now, and adjust inputs
- Category-based event enrichment for `notification.categoryId`
- Dedicated organization-scoped category storage in the `NotificationCategories` DynamoDB table
- Category policy defaults for delivery mode, channel policy, message category, priority, value, urgency, and scheduling window
- Category identifiers on Attention Escrow decision and delivery records for future campaign/category reporting

### Changed

- Attention and Send Event forms now lock category-controlled fields when a category is selected
- Immediate categories now focus the UI on send-now impact and hide schedule-only controls
- Immediate categories use `maxDelayHours: 0`; optimized categories use max delay to prefill delivery windows
- Scheduled recommendations now avoid the current instant and enforce a minimum lead time before creating schedules

---

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
