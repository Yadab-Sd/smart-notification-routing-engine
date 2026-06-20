# Business Adoption Guide

Smart Notification Routing Engine (SNRE) helps organizations test a safer way to send notifications: not only choosing a better delivery time, but also asking whether a message is worth the user's attention right now.

SNRE is open source and pilot-ready. It is best introduced through a small, controlled pilot before any permanent adoption decision.

---

## Recommended Adoption Path

### 1. Hosted Discovery Pilot

Best for organizations that want to evaluate SNRE without creating AWS infrastructure first.

**What this means**:

- I host a dedicated pilot environment for a limited period.
- The organization tests one low-risk notification use case.
- Pilot data is minimized, pseudonymized where possible, and deleted or transferred after the pilot.
- The goal is to prove whether SNRE is useful before asking the organization to own infrastructure.

**Typical duration**:

- 7 days: technical validation
- 15 days: recommended first pilot
- 30 days: stronger measurement window

**Best for**:

- early evaluation
- non-technical teams
- organizations that want to see value before assigning engineers
- low-risk email-first notification workflows

**Important boundary**:

This is not a permanent hosted SaaS offer. If the organization decides to adopt SNRE long-term, the recommended model is deployment into the organization's own AWS account.

---

### 2. Assisted Customer-Owned Deployment

Best after a successful pilot or for organizations that already require data and infrastructure control.

**What you get**:

- SNRE deployed into your AWS account
- full ownership of infrastructure and data
- API integration guidance
- admin console setup
- SES sender configuration guidance
- documentation for your technical team

**What you pay**:

- your AWS infrastructure cost
- no software licensing fee
- optional support/customization if agreed separately

**Why this is the preferred long-term model**:

- you control access
- you control retention
- you control AWS billing
- there is no vendor lock-in
- the code is MIT licensed

---

### 3. Self-Deploy

Best for technical teams comfortable with AWS, CDK, Java, and React.

Start here:

👉 **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Complete technical deployment guide

Recommended commands:

```bash
./scripts/deploy-infra.sh
./scripts/deploy-frontend.sh
```

---

## Best First Use Cases

Good first pilots are useful but not dangerous if delayed:

- appointment reminders
- abandoned cart reminders
- renewal reminders
- course or learning reminders
- account nudges
- shipping or order updates
- internal staff announcements
- community announcements

Avoid first pilots with:

- emergency alerts
- password reset codes
- fraud alerts
- medical-critical notifications
- legal notices
- financial-critical instructions

Those can be considered later after the system proves reliability in safer categories.

---

## What A Pilot Measures

SNRE pilots should be judged with practical, conservative metrics:

- how many messages were sent, scheduled, or deferred
- how often Attention Escrow prevented low-value sends
- bounce and complaint behavior
- suppression list additions
- blocked sends to suppressed addresses
- click/open/conversion trends if available
- organization feedback on explainability and workflow fit

The goal is not to promise a dramatic lift. The goal is to test whether notification delivery becomes safer, more explainable, and more respectful of user attention.

---

## Data And Security Expectations

For hosted discovery pilots:

- use one limited notification workflow
- prefer test users, pilot users, or a small eligible segment
- avoid sensitive content unless a proper agreement is in place
- use stable pseudonymous IDs when possible
- share only the fields needed for routing and measurement
- define deletion/export expectations before starting

For permanent adoption:

- deploy into your AWS account
- keep data under your access controls
- connect SNRE to your existing compliance and consent workflows
- review security, retention, and monitoring policies internally

See [SECURITY.md](./SECURITY.md) for vulnerability reporting and security expectations.

---

## Contact For Pilot Or Adoption Discussion

**Email**: contact@intelligent-routing.com

**Subject**:

```text
SNRE Pilot Or Adoption Request - [Your Organization]
```

Include:

```text
Organization:
Industry:
Location:
Primary notification use case:
Current sending channel:
Approximate monthly notification volume:
Preferred pilot length: 7 / 15 / 30 days
Do you have a technical contact?:
Do you want hosted pilot first or customer-owned AWS deployment?:
What outcome do you want to improve?:
Can you share aggregate pilot metrics?:
Preferred start date:
```

---

## Why I Offer Pilots

This open-source project supports my work on intelligent, trust-aware notification infrastructure. Real-world pilots help validate the system with operational data, while organizations get a low-friction way to test whether smarter notification timing and Attention Escrow are useful for their users.

The pilot is designed to be mutually beneficial:

- organizations test the system with limited risk
- users benefit from more respectful notification delivery
- the project gains evidence, feedback, and adoption readiness

---

## After A Pilot

The organization can choose:

1. **Stop**
   - pilot data is deleted or exported as agreed
   - no lock-in

2. **Extend**
   - add more users, campaigns, or tracking signals
   - continue measuring before adoption

3. **Adopt**
   - deploy SNRE into the organization's AWS account
   - operate it independently
   - customize the MIT-licensed code as needed

---

## Frequently Asked Questions

### Do we need AWS knowledge to try SNRE?

Not for a hosted discovery pilot. For permanent adoption, your organization should use its own AWS account or have a technical partner operate it.

### Who pays for the pilot AWS cost?

For selected discovery pilots, I may host and cover the limited pilot infrastructure cost. Permanent adoption runs in the organization's AWS account and is paid by the organization.

### Is this a SaaS product?

No. SNRE is an open-source system. The recommended long-term model is customer-owned deployment.

### Can we use real users?

Yes, but start with a small, low-risk segment and only after consent, compliance, and data-sharing expectations are clear.

### Can we modify the system?

Yes. SNRE is MIT licensed and can be used commercially or modified.

---

## Pilot Program

For the detailed pilot scope, phases, entry criteria, and metrics:

👉 **[PILOT_PROGRAM.md](./PILOT_PROGRAM.md)**

---

Last updated: June 20, 2026
