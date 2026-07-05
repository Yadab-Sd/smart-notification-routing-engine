# Roadmap

This roadmap describes likely project direction. It is not a delivery promise,
service-level commitment, or production-readiness claim. Priorities may change
based on adopter feedback, contributor interest, security findings, and pilot
evidence.

## Current Focus

SNRE currently focuses on a self-hosted AWS deployment model:

- event ingestion through API Gateway and Kinesis
- user profile, category, audience, campaign, and template management
- send-time optimization through SageMaker XGBoost or fallback heuristics
- Attention Escrow decisioning before sends or schedules
- SES/SNS delivery with bounce and complaint suppression
- admin console workflows for preview, launch, and monitoring

The near-term goal is to make this flow more observable, easier to adopt, and
safer to operate.

## Near-Term Priorities

### 1. Event Lifecycle Tracking

`POST /v1/events` currently confirms that an event was queued. It does not
confirm that the event was consumed, scheduled, sent, deferred, or failed.

Planned improvement:

```text
POST /v1/events -> returns eventId
GET /v1/events/{eventId}/status -> returns lifecycle state
```

Candidate states:

```text
QUEUED
CONSUMED
RAW_EVENT_STORED
USER_PROFILE_UPDATED
DECISION_CREATED
SCHEDULED
SENT
DEFERRED
FAILED
```

### 2. Outcome Tracking

The system records decisions and delivery attempts. Future work should normalize
more downstream outcome signals:

- delivered
- opened, where available and privacy-appropriate
- clicked
- converted
- unsubscribed
- complained
- bounced
- muted or opted out
- no signal within an outcome window

This is required before making meaningful model-quality or fatigue-reduction
claims.

### 3. Attention Escrow Model Learning

The current Attention Escrow MVP is transparent and rule-based. A future model
can learn:

```text
P(negative_or_wasted_attention | user, source, category, channel, time, history)
```

The model should remain policy-constrained and explainable. Critical and
emergency messages must not be blocked by an opaque model.

### 4. Campaign And Audience Maturity

Current campaign and audience workflows support reusable definitions and batch
preview. Planned work:

- CSV audience upload
- audience validation before launch
- campaign launch status by recipient
- campaign outcome comparison across repeated launches
- reusable campaign templates with controlled variables

### 5. Operations And Observability

The project should become easier to operate in adopter-owned AWS accounts:

- CloudWatch dashboard definitions
- Kinesis lag visibility
- failed schedule investigation guide
- SES suppression and reputation dashboards
- endpoint fallback visibility
- cost and quota warnings

## Medium-Term Priorities

### Additional Channels

Potential channels:

- push notifications through FCM/APNs
- WhatsApp Business
- Slack or Microsoft Teams
- in-app notifications

Each channel should implement the existing sender channel interface and expose
clear failure/fallback reasons.

### A/B And Shadow-Mode Evaluation

Adopters need a trustworthy way to compare:

- fixed send time
- randomized send time
- send-time optimization only
- send-time optimization plus Attention Escrow

Shadow mode should allow SNRE to produce recommendations without actually
sending messages.

### Privacy-Preserving Learning

Future ML improvements should avoid unnecessary personally identifiable data.
Candidate directions:

- aggregated cohort features
- source/category-level statistics
- anonymized or hashed user features
- retention-aware training datasets
- configurable data minimization

## Long-Term Research Direction

SNRE can support research on:

- notification fatigue and interruption cost
- trust-aware communication infrastructure
- explainable notification routing
- critical versus non-critical message prioritization
- privacy-preserving personalization
- self-hosted ML decision systems for public-interest communication

Any empirical claims must be backed by real evaluation data from controlled
pilots or adopter-owned deployments.

