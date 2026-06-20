# SNRE Pilot Program

Smart Notification Routing Engine (SNRE) is available for limited pilot testing with organizations that want to reduce notification fatigue, improve delivery timing, and evaluate trust-aware notification routing with real operational data.

This is a **controlled pilot program**, not a claim that SNRE is a finished enterprise notification platform. The goal is to test whether intelligent timing and Attention Escrow can improve user experience and business outcomes in a safe, measurable way.

---

## Pilot Positioning

SNRE helps answer two questions before a message is sent:

1. **When should this user receive the message?**
2. **Is this message worth spending the user's attention right now?**

The first question is handled by send-time optimization. The second is handled by **Attention Escrow**, a trust-aware gate that compares estimated attention cost against message value before scheduling.

The pilot is best suited for organizations that already send user notifications and want to test whether smarter routing can:

- reduce over-sending
- protect user trust
- improve engagement timing
- lower bounce/complaint risk
- make notification decisions more explainable

---

## Current Pilot Scope

### Pilot-Ready Today

- Email notification routing through Amazon SES
- Immediate and optimized delivery modes
- Event ingestion API for organization systems
- Admin console for testing and monitoring
- Send-time prediction integration
- Attention Escrow MVP scoring
- Attention decision ledger in DynamoDB
- Scheduled delivery through EventBridge Scheduler
- Bounce and complaint processing through SES/SNS
- Email suppression list enforcement before sending
- Local deployment scripts and optional GitHub Actions frontend deploy

### Designed For Expansion

The architecture is designed for SMS, push, and additional channels, but the recommended pilot path is **email-first**. This keeps the pilot lower-risk and easier to validate before adding SMS, push, WhatsApp, or emergency channels.

### Not Recommended For First Pilot

Do not start with:

- emergency alerts
- medical-critical notifications
- legal notices
- financial-critical alerts
- high-volume marketing blasts

Start with non-critical or moderately important messages where deferral is acceptable.

---

## Good Pilot Use Cases

Strong first use cases:

- appointment reminders
- abandoned cart reminders
- renewal reminders
- course or learning reminders
- account nudges
- shipping or order updates
- internal non-urgent staff notifications
- community announcements

Poor first use cases:

- password reset codes
- fraud alerts
- account lockout alerts
- evacuation or emergency warnings
- time-sensitive legal or healthcare instructions

Those can be considered later after the system has proven reliability in safer notification categories.

---

## What The Organization Gets

- A deployable open-source notification optimization system
- A hosted discovery pilot environment for selected low-risk evaluations, or deployment into the organization's AWS account when preferred
- API-based integration path for existing systems
- Admin UI for testing, previewing, and monitoring decisions
- Suppression handling for bounces and complaints
- Clear metrics for sends, deferrals, suppression, and Attention Escrow decisions
- A pilot review report at the end of the test period

SNRE is MIT licensed. After the pilot, the organization can continue using, modifying, or self-hosting the system.

Hosted pilots are meant to reduce evaluation friction. They are not a replacement for customer-owned infrastructure when the organization decides to adopt SNRE permanently.

---

## What SNRE Needs From A Pilot Partner

Minimum data/configuration:

- user ID or stable pseudonymous user identifier
- destination email address
- notification category
- message text or template identifier
- urgency level
- approximate business value score
- delivery mode: `IMMEDIATE` or `OPTIMIZED`

Recommended data:

- campaign ID or source ID
- template ID
- notification priority
- historical send timestamps
- historical click/open/conversion data if available
- unsubscribe/spam/complaint history if available

SNRE can start without full click/open tracking. However, richer outcome data makes future optimization stronger.

---

## Pilot Architecture

Typical data flow:

```text
Organization System
  -> SNRE Events API
  -> Decision Service
  -> Send-Time Optimization
  -> Attention Escrow Gate
  -> EventBridge Scheduler
  -> Sender Service
  -> Amazon SES
  -> User Inbox

SES Bounce/Complaint Events
  -> SNS
  -> SES Event Processor
  -> Suppression List
  -> Future Send Blocking
```

Admin teams can use the SNRE frontend to:

- preview attention decisions
- send test events
- inspect send/defer behavior
- monitor Attention Escrow summary metrics
- verify suppression behavior

---

## Success Metrics

The pilot should be judged with clear, conservative metrics.

### Delivery Safety

- bounce rate
- complaint rate
- suppression list additions
- blocked sends to suppressed users
- failed scheduled sends

### User Trust And Fatigue

- percentage of messages deferred by Attention Escrow
- average attention cost
- average attention value
- repeated sends per user over time
- opt-out or unsubscribe trend, if available

### Engagement

- click rate, if available
- open rate, if available and appropriate
- conversion or task completion rate, if available
- response rate for reminder workflows

### Business Value

- messages sent at predicted better times
- avoidable sends blocked or deferred
- campaign/source-level performance
- operational feedback from staff
- AWS cost per notification volume

For early pilots, the most important result is not a dramatic lift claim. The most important result is whether SNRE makes notification delivery safer, more explainable, and measurably useful.

---

## Pilot Phases

### Phase 1: Fit Check

Duration: 30-45 minutes

- understand the organization's notification workflow
- choose one safe pilot use case
- confirm compliance constraints
- define success metrics
- choose deployment model
- decide whether the first test should be hosted discovery, shadow mode, or customer-owned AWS

### Phase 2: Pilot Setup

Duration: 1-3 days depending on integration and AWS readiness

- prepare the hosted pilot environment or deploy infrastructure with CDK/helper scripts
- configure SES sender identity
- configure API and Cognito access
- deploy frontend
- run health checks
- test bounce/complaint suppression

Recommended commands for technical teams:

```bash
./scripts/deploy-infra.sh
./scripts/deploy-frontend.sh
```

### Phase 3: Integration

Duration: 2-10 business days

- connect one notification source to `/v1/events`
- start with test users
- validate immediate and optimized delivery
- verify Attention Escrow preview and ledger entries
- confirm CloudWatch and DynamoDB traces

### Phase 4: Limited Production Test

Duration: 2-4 weeks

- route a small percentage of eligible notifications through SNRE
- monitor send/defer decisions
- monitor SES reputation and suppression events
- compare against baseline behavior

### Phase 5: Review

Duration: 1 week

- summarize results
- identify integration gaps
- decide whether to expand, continue, or stop
- optionally prepare a public or private case study

---

## Deployment Models

### Recommended First Step: Hosted Discovery Pilot

Best when the organization wants to validate SNRE before assigning cloud budget or engineering time.

- SNRE maintainer hosts a dedicated pilot environment for a limited period
- organization shares only the minimum data needed for the selected use case
- data should be pseudonymized where possible
- pilot scope, deletion/export expectations, and access boundaries are agreed before starting
- useful for 7, 15, or 30 day evaluations

This model is designed to lower evaluation friction, not to become permanent hosted infrastructure.

### Long-Term Adoption: Organization-Owned AWS Account

Best for data sovereignty and trust.

- organization owns all AWS resources
- organization controls data and access
- SNRE is deployed from open-source code
- easiest path to long-term adoption

### Shadow Mode Evaluation

Best when the organization is not ready to let SNRE send messages.

- organization sends event samples or limited live events
- SNRE produces send/schedule/defer/suppress decisions
- existing production system continues sending as usual
- results are compared against the organization's baseline behavior

Shadow mode is often the safest first path for sensitive organizations.

For sensitive industries, organization-owned AWS is strongly preferred.

---

## Responsibilities

### SNRE Maintainer

- provide deployment guidance
- help configure the pilot use case
- support API integration questions
- review system metrics
- help interpret Attention Escrow decisions
- document lessons learned
- for hosted discovery pilots, operate the limited pilot environment and follow the agreed deletion/export plan

### Pilot Organization

- ensure it has permission to message users
- provide compliant notification content
- maintain opt-out, consent, and privacy obligations
- monitor AWS costs when using its own AWS account
- identify one technical contact
- share agreed aggregate pilot metrics
- avoid sending sensitive data unless an appropriate agreement is in place

### Important Compliance Note

SNRE is a software tool. The sending organization remains responsible for legal and regulatory compliance, including consent, unsubscribe handling, data protection, CAN-SPAM, TCPA, HIPAA, FERPA, GDPR, or other applicable rules.

This repository includes compliance guidance, but it is not legal advice.

---

## Current Limitations

Be transparent about these during pilot conversations:

- Attention Escrow is currently MVP rule-based scoring, not a trained attention-cost model.
- Email is the recommended first pilot channel.
- Click/open/conversion tracking may require additional integration work.
- Missing clicks do not always mean a message had no value.
- SMS/push support should be treated as expansion work, not the first validation path.
- Production SES access and sender/domain authentication may be required before real outbound email volume.
- The system is deployed per organization and does not learn from other organizations' traffic.

These limitations are acceptable for a pilot as long as the pilot scope is honest.

---

## Pilot Entry Criteria

Good candidates have:

- a real notification workflow
- one low-risk pilot use case
- a technical contact
- willingness to start with hosted discovery, shadow mode, or organization-owned AWS
- permission to send the selected notification type
- willingness to evaluate results with aggregate metrics

Suggested pilot volume:

- minimum: 500-1,000 eligible notifications/month
- comfortable range: 1,000-50,000 notifications/month
- higher volume should start with a small percentage rollout

---

## Application Template

Email: `contact@intelligent-routing.com`

Subject:

```text
SNRE Pilot Request - [Organization Name]
```

Include:

```text
Organization:
Industry:
Location:
Primary notification use case:
Current sending channel:
Approximate monthly notification volume:
Preferred deployment model: Hosted discovery / Shadow mode / Organization-owned AWS
Do you use SES, SendGrid, Twilio, Firebase, or another provider?:
What outcome do you want to improve?:
Can you share aggregate pilot metrics?:
Preferred pilot start date:
Technical contact:
```

---

## After The Pilot

The organization can choose:

1. **Adopt in its own AWS account**
   - keep using the MIT-licensed system
   - operate it under its own AWS controls
   - modify it as needed

2. **Expand the pilot**
   - add more notification sources
   - add richer outcome tracking
   - test more channels
   - calibrate Attention Escrow scoring

3. **Stop**
   - export any needed data
   - delete AWS resources
   - share lessons learned

There is no lock-in.

---

## Maintainer Notes For Outreach

Use careful language:

- Say "pilot-ready", not "enterprise complete".
- Say "email-first", not "fully multi-channel".
- Say "MVP Attention Escrow scoring", not "fully trained attention AI".
- Say "measured pilot", not "guaranteed engagement lift".
- Lead with trust, safety, and explainability.

Best one-sentence pitch:

> SNRE helps organizations decide not only when to send a notification, but whether sending it is worth the user's attention right now.

---

Last updated: June 20, 2026
