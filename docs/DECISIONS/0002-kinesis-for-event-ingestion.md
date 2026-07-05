# ADR 0002: Use Kinesis For Event Ingestion

## Status

Accepted

## Context

Notification events can arrive faster than downstream services can safely
process them. The ingestion API should accept valid events quickly while allowing
asynchronous processing for storage, user counters, decisioning, and delivery.

## Decision

Use Amazon Kinesis Data Streams as the buffer between `/v1/events` and the
Events Consumer Lambda.

```text
/v1/events -> Kinesis -> Events Consumer -> S3 + DynamoDB + notification trigger
```

## Consequences

Benefits:

- API can return after queueing the event
- downstream processing is decoupled from request latency
- events are ordered per partition key
- Kinesis can absorb bursts within configured capacity

Tradeoffs:

- `200 queued` is not delivery confirmation
- high traffic can create consumer lag
- adopters need visibility into iterator age and failed batches
- event lifecycle status should be added for stronger observability

