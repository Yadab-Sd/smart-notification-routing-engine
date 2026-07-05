# ADR 0004: Use Attention Escrow As A Second-Stage Gate

## Status

Accepted

## Context

The best predicted send time does not automatically mean a message should be
sent. A low-value marketing message can still create fatigue even if it is sent
at a relatively good hour.

## Decision

Use Attention Escrow as a second-stage decision gate after send-time scoring.

```text
Send-time model -> p_engage
Attention Escrow -> compare attention value against attention cost
Final action -> SEND, SCHEDULE, or DEFER
```

The MVP uses explainable rules for cost, value, margin, fatigue, source trust,
priority, and category. Future versions may add a learned attention-risk model.

## Consequences

Benefits:

- protects users from low-value interruptions
- gives operators a reason for send/defer outcomes
- creates an auditable Attention Ledger
- supports future research on notification fatigue and trust-aware routing

Tradeoffs:

- rule-based scoring is only an MVP
- missing clicks are incomplete signals, not proof of harm
- stronger fatigue/value modeling requires richer outcome tracking
- critical and emergency messaging must remain policy-protected

