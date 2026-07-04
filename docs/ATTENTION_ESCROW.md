# Attention Escrow

Attention Escrow is the system's trust-aware notification gate. It adds a second decision layer after send-time optimization:

1. **Send-time model**: When is this user most likely to engage?
2. **Attention gate**: Is this message worth spending user attention right now?

The goal is to protect users from fatigue while helping organizations avoid long-term trust damage from over-sending.

![Attention Escrow UI](docs/diagrams/AttentionEscrow.png)

---

## Current Implementation

This implementation is an MVP. It does not replace the existing SageMaker send-time model. Instead, it wraps the model output with a rule-based attention scoring layer inside `decision-service`.

Implemented pieces:

- New DynamoDB table: `AttentionLedger`
- Decision-time attention scoring
- `SEND` / `DEFER` decisions before scheduling
- Attention decision records written to DynamoDB
- Scheduled sender payload includes attention metadata
- Sender records `SENT` or `FAILED` delivery attempts linked to the attention decision

Future work:

- Outcome tracking for email clicks, opens, unsubscribes, conversions, and SMS delivery/click signals
- Source trust score updates from real outcomes
- Optional SageMaker attention-cost model trained from ledger history
- Attention ROI dashboard

---

## Why "Source" Instead Of "Brand"

The system is currently deployed per business or organization. It does not know what other companies are sending.

So Attention Escrow uses **message source** instead of brand/sender.

A source can be internal to one organization:

- campaign ID
- template ID
- notification type
- product area
- business unit
- event trigger
- priority class

Examples:

```json
{
  "sourceId": "campaign:abandoned_cart",
  "messageCategory": "MARKETING",
  "priorityClass": "LOW"
}
```

```json
{
  "sourceId": "type:SECURITY",
  "messageCategory": "SECURITY",
  "priorityClass": "CRITICAL"
}
```

This lets one organization learn which internal message sources earn trust and which ones burn attention.

---

## Data Model

### Attention Decision Record

Written by `decision-service`.

```text
pk = USER#{userId}
sk = DECISION#{attentionDecisionId}
```

Attributes:

```json
{
  "recordType": "ATTENTION_DECISION",
  "decisionId": "attn_...",
  "userId": "user_123",
  "sourceId": "campaign:abandoned_cart",
  "attentionDecision": "SEND",
  "attentionCost": 2.4,
  "attentionValue": 5.9,
  "attentionMargin": 1.0,
  "fatigueScore": 0.33,
  "sourceTrustScore": 0.75,
  "bestHour": 14,
  "probability": 0.73,
  "scheduleRequested": true,
  "categoryId": "appointment_reminder",
  "messageCategory": "MARKETING",
  "priorityClass": "LOW",
  "channel": "EMAIL",
  "categoryDefaults": {
    "messageCategory": "MARKETING",
    "priorityClass": "LOW",
    "businessValue": 6.0,
    "urgency": 0.3
  },
  "effectivePolicy": {
    "messageCategory": "MARKETING",
    "priorityClass": "STANDARD",
    "businessValue": 8.0,
    "urgency": 0.6
  },
  "policyOverrides": {
    "priorityClass": true,
    "businessValue": true,
    "urgency": true
  },
  "overrideCount": 3,
  "overrideMagnitude": 0.9,
  "reason": "Predicted value exceeds attention cost",
  "createdAt": "2026-06-19T07:00:00Z"
}
```

When a configured category is used, `categoryId` is stored as the category identity signal. Category policy fields are locked in the current admin UI, but the backend keeps `categoryDefaults`, `effectivePolicy`, and `policyOverrides` so future override workflows can separate category identity from one-off admin changes during model training.

### Delivery Attempt Record

Written by `sender-service` when the scheduled payload contains `attentionDecisionId`.

```text
pk = USER#{userId}
sk = DELIVERY#{deliveryId}
```

Attributes:

```json
{
  "recordType": "ATTENTION_DELIVERY",
  "deliveryId": "delivery_...",
  "decisionId": "attn_...",
  "userId": "user_123",
  "sourceId": "campaign:abandoned_cart",
  "status": "SENT",
  "channel": "EMAIL",
  "messageCategory": "MARKETING",
  "priorityClass": "LOW",
  "createdAt": "2026-06-19T07:04:00Z"
}
```

### Source Trust Record

Not yet automatically updated. The decision service can read this shape if present:

```text
pk = USER#{userId}
sk = SOURCE#{sourceId}
```

```json
{
  "recordType": "ATTENTION_SOURCE",
  "sourceId": "campaign:abandoned_cart",
  "trustScore": 0.81,
  "updatedAt": "2026-06-19T07:00:00Z"
}
```

If no source trust record exists, the gate uses a neutral default trust score of `0.75`.

---

## Scoring Logic

The current MVP uses transparent rules.

### Where The Values Come From

The current implementation does not invent hidden scores. Every value comes from one of four places:

1. **Existing SageMaker send-time endpoint**
   - Provides `sendTimeProbability`
   - This is the engagement probability for the best candidate hour

2. **DynamoDB user counters**
   - `counters.sends`
   - `counters.clicks`
   - Used to calculate click rate and a simple fatigue score

3. **Request payload**
   - `channel`
   - `messageCategory`
   - `priorityClass`
   - `businessValue`
   - `urgency`
   - `sourceId`

4. **AttentionLedger source trust record**
   - Optional `trustScore` per user and source
   - Defaults to `0.75` if no source record exists yet

The MVP is intentionally explainable. Operators can see why a message was sent or deferred.

### Attention Cost

Cost estimates how expensive the interruption is:

```text
attentionCost =
  1.0
  + fatigueScore * 3.0
  + (1 - sourceTrustScore) * 2.0
  + channelCost
  + messageCategoryPenalty
```

Current MVP fatigue calculation:

```text
volume = min(1.0, totalSends / 30.0)
ignoreRatio = totalSends > 0 ? (totalSends - totalClicks) / totalSends : 0.0
fatigueScore = clamp((volume * 0.45) + (ignoreRatio * 0.55), 0.0, 1.0)
```

This is intentionally conservative, but incomplete. A missing click is not proof that the notification was useless; the user may have read the subject, SMS body, or push preview and still benefited. Future scoring should treat negative signals such as unsubscribe, spam complaint, bounce, explicit mute, and repeated ignores as stronger fatigue evidence than a single missing click.

Channel costs:

```text
EMAIL = 0.4
PUSH  = 0.7
SMS   = 0.9
AUTO  = 0.6
```

Type penalties:

```text
MARKETING / PROMOTION = +1.2
NEWSLETTER            = +0.8
TRANSACTIONAL         = -0.4
SECURITY / EMERGENCY  = -1.0
```

### Attention Value

Value estimates user and business benefit:

```text
attentionValue =
  sendTimeProbability * 6.0
  + urgency * 2.0
  + businessValue * 2.0
  + priorityBoost
```

Priority boosts:

```text
EMERGENCY     = +4.0
CRITICAL      = +3.0
URGENT        = +2.0
HIGH          = +1.4
STANDARD      =  0.0
LOW           = -0.5
```

### Gate Decision

```text
if priorityClass in [EMERGENCY, CRITICAL]:
    SEND
else if attentionValue >= attentionCost + attentionMargin:
    SEND
else:
    DEFER
```

Marketing and low-priority messages use a larger safety margin.

---

## Request Fields

The decision APIs remain backward-compatible. Existing requests with only `userId`, `windowStart`, and `windowEnd` still work.

Optional fields:

```json
{
  "channel": "EMAIL",
  "sourceId": "campaign:abandoned_cart",
  "campaignId": "abandoned_cart",
  "templateId": "promo_template_1",
  "messageCategory": "MARKETING",
  "priorityClass": "LOW",
  "businessValue": 6.0,
  "urgency": 0.3,
  "message": "You left something in your cart",
  "metadata": {
    "subject": "Complete your order"
  }
}
```

Field guidance:

- `sourceId`: best explicit identifier for trust tracking
- `campaignId`: used if `sourceId` is absent
- `templateId`: used if `sourceId` and `campaignId` are absent
- `businessValue`: `0.0` to `10.0`
- `urgency`: `0.0` to `1.0`

`channel` enum:

| Value | Meaning |
| --- | --- |
| `AUTO` | Let Sender Service choose the best available channel from user preferences |
| `EMAIL` | Email delivery; lower interruption cost, slower response expectation |
| `SMS` | SMS delivery; higher interruption cost, usually higher urgency |
| `PUSH` | Push notification delivery; medium interruption cost |

`messageCategory` enum:

| Value | Meaning |
| --- | --- |
| `GENERAL` | Default informational message when no category is supplied |
| `MARKETING` | Revenue or re-engagement message; needs stronger value to spend attention |
| `PROMOTION` | Discount, offer, or campaign message; treated like marketing |
| `NEWSLETTER` | Recurring content update; less urgent than transactional messages |
| `TRANSACTIONAL` | User-requested or account-related update; lower attention penalty |
| `SECURITY` | Security-sensitive alert; bypasses normal attention budget |
| `EMERGENCY` | Emergency or safety alert; bypasses normal attention budget |

`priorityClass` enum:

| Value | Meaning |
| --- | --- |
| `LOW` | Nice-to-have message; requires a wider value-over-cost margin |
| `STANDARD` | Normal message; default priority when caller does not specify one |
| `HIGH` | Important but not mandatory; receives urgency and value boost |
| `URGENT` | Time-sensitive message; small delay is acceptable if attention cost is high |
| `CRITICAL` | Must-reach-soon message; bypasses the normal attention budget |
| `EMERGENCY` | Emergency or safety alert; bypasses the attention budget |

`businessValue` is the organization's declared value for sending this message now. `urgency` is how fast the message loses usefulness if delayed.

Do not use `notificationType` for Attention Escrow category. The event ingestion flow already uses `notificationType` as a routing mode with values such as `immediate` and `optimized`. Attention Escrow uses `messageCategory` for business meaning.

---

## Event-Triggered Notifications

`POST /v1/events` is still event-first. It records facts that happened.

If an event should also trigger a notification, add an optional nested `notification` object:

```json
{
  "userId": "user_123",
  "type": "ABANDONED_CART",
  "ts": "2026-06-19T08:00:00Z",
  "attrs": {
    "cartId": "cart_456"
  },
  "notification": {
    "deliveryMode": "OPTIMIZED",
    "channel": "EMAIL",
    "message": "You left something in your cart.",
    "sourceId": "campaign:abandoned_cart",
    "campaignId": "abandoned_cart",
    "templateId": "cart_reminder_v1",
    "messageCategory": "MARKETING",
    "priorityClass": "LOW",
    "businessValue": 6.0,
    "urgency": 0.3,
    "metadata": {
      "subject": "Complete your order"
    }
  }
}
```

`deliveryMode` controls delivery timing:

```text
IMMEDIATE = invoke Sender Service now
OPTIMIZED = invoke Decision Service, run send-time model and Attention Escrow
```

The legacy top-level field `notificationType: "immediate|optimized"` still works for old clients, but new integrations should prefer `notification.deliveryMode`.

---

## Future SageMaker Attention Model

The current Attention Gate is rule-based. A future SageMaker model should predict the risk and value of spending user attention.

Recommended first model:

```text
Attention Negative Outcome Model
```

Prediction target:

```text
P(negative_or_wasted_attention)
```

Positive outcomes:

```text
CLICK
CONVERSION
SAVE
REPLY
HELPFUL
```

Negative outcomes:

```text
UNSUBSCRIBE
COMPLAINT
BOUNCE
MUTE
RAPID_DELETE
REPEATED_IGNORE
```

Neutral or censored outcomes:

```text
DELIVERED_WITH_NO_TRACKABLE_ACTION
SMS_WITH_NO_CLICK
EMAIL_OPEN_BLOCKED_BY_PRIVACY
NO_SIGNAL_YET
```

Training input features:

```text
hour
channel
messageCategory
priorityClass
businessValue
urgency
sendTimeProbability
recentSends24h
recentSends7d
recentClicks7d
recentIgnores7d
userClickRate
sourceTrustScore
daysSinceLastClick
daysSinceLastComplaint
isSuppressed
```

Training label:

```text
1 = negative or wasted attention within outcome window
0 = positive or acceptable outcome within outcome window
```

Example training row:

```csv
label,hour,channel,messageCategory,priorityClass,businessValue,urgency,sendTimeProbability,recentSends24h,recentSends7d,userClickRate,sourceTrustScore
0,14,EMAIL,MARKETING,LOW,6.0,0.3,0.73,1,5,0.42,0.81
```

Runtime collaboration:

```text
Existing send-time model -> scores UTC hour buckets inside the requested window
Future attention model   -> predicts negative/wasted-attention risk
Attention Gate           -> combines value, cost, urgency, and policy
```

The final decision should remain explainable:

```text
SEND if value outweighs predicted attention risk
DEFER if risk is high and urgency is low
DIGEST if low-priority messages can be bundled
SUPPRESS if compliance/user preference blocks delivery
```

Do not train this model until enough outcome data exists in `AttentionLedger` and normalized event history.

---

## Example Response

```json
{
  "userId": "user_123",
  "hour": 14,
  "probability": 0.73,
  "recommendedSendTime": "2026-06-19T14:00:00Z",
  "sendNowTime": "2026-06-19T10:37:24Z",
  "sendNowHour": 10,
  "sendNowProbability": 0.41,
  "attentionDecision": "SEND",
  "attentionCost": 2.4,
  "attentionValue": 5.9,
  "attentionMargin": 1.0,
  "attentionReason": "Predicted value exceeds attention cost",
  "fatigueScore": 0.33,
  "sourceTrustScore": 0.75,
  "sourceId": "campaign:abandoned_cart",
  "decisionId": "attn_...",
  "scheduled": true,
  "scheduleId": "send-...",
  "scheduledTime": "2026-06-19T14:00:00Z"
}
```

`recommendedSendTime` is the actual UTC timestamp selected inside the requested delivery window. `probability` is the predicted score for that timestamp's UTC hour bucket. `sendNowTime` is the actual current request time in UTC, not `windowStart`; `sendNowProbability` is the predicted score for sending in that current UTC hour bucket. If `windowStart` is in the future, send-now impact is shown as a separate immediate-send comparison, while the recommended time still stays inside the requested window.

If the message is deferred:

```json
{
  "userId": "user_123",
  "hour": 14,
  "probability": 0.21,
  "attentionDecision": "DEFER",
  "attentionCost": 5.8,
  "attentionValue": 2.4,
  "attentionReason": "Marketing message deferred because attention cost is higher than value",
  "scheduled": false,
  "scheduleSkippedReason": "Marketing message deferred because attention cost is higher than value"
}
```

---

## End-To-End Flow

```text
Client calls /v1/decisions/schedule
        |
Decision Service fetches UserProfiles counters
        |
Decision Service invokes SageMaker send-time endpoint
        |
Attention Gate calculates cost, value, fatigue, trust
        |
Decision is written to AttentionLedger for schedule/event-driven sends
        |
If SEND:
    EventBridge Scheduler invokes Sender Service
    Sender Service sends through SES/SNS
    Sender Service writes delivery attempt to AttentionLedger

If DEFER:
    No schedule is created
    Decision response explains why
```

`/v1/decisions/preview` runs the same scoring and Attention Gate logic, but it is a simulation by default. It returns `previewOnly: true` and does not write an `ATTENTION_DECISION` record unless the caller sends `auditPreview: true`.

For event-triggered optimized sends, the flow starts one step earlier:

```text
Client calls /v1/events with notification.deliveryMode = OPTIMIZED
        |
Events Consumer stores the event and invokes Decision Service
        |
Decision Service writes ATTENTION_DECISION to AttentionLedger
```

If `AttentionLedger` is empty after an optimized event, check Events Consumer CloudWatch logs for `Decision service invoked`. The log includes the Decision Service response payload, which is the fastest way to see whether the decision request failed validation, user lookup, SageMaker invocation, or scheduling.

### Business Summary API

The admin UI uses `GET /v1/attention/summary` to turn raw ledger decisions into business-facing indicators.

Supported scopes:

```text
/v1/attention/summary
/v1/attention/summary?sourceId=campaign:abandoned_cart
/v1/attention/summary?userId=pilot_user_3
```

The response includes:
- `sendRate`: percentage of messages that cleared the gate
- `deferRate`: percentage of messages protected from over-sending
- `avgAttentionCost`: average fatigue/interruption cost
- `avgAttentionValue`: average predicted message value
- `attentionProtected`: count of deferred non-critical messages
- `estimatedAttentionSaved`: summed attention cost avoided by deferring messages
- `recommendation`: operator-facing guidance for the selected scope

---

## Tracking Plan

The MVP records decisions and send attempts. It does not yet measure every downstream outcome.

Planned normalized events:

```text
SEND
DELIVERED
OPEN
CLICK
CONVERSION
UNSUBSCRIBE
BOUNCE
COMPLAINT
IGNORE_INFERRED
```

Email:

- `SEND`: Sender Service
- `DELIVERED`: SES delivery event
- `BOUNCE`: already handled by SES Event Processor
- `COMPLAINT`: already handled by SES Event Processor
- `CLICK`: tracking redirect endpoint
- `OPEN`: SES/open pixel where available, treated as noisy
- `UNSUBSCRIBE`: unsubscribe endpoint and/or SES list management

SMS:

- `SEND`: Sender Service
- `DELIVERED`: SNS SMS delivery status if enabled
- `CLICK`: tracked link
- `UNSUBSCRIBE`: STOP/two-way SMS provider support or link-based unsubscribe
- `OPEN`: unavailable, treated as unknown

Push:

- future channel
- app callback can emit `OPEN`, `DISMISS`, `ACTION`, and `CONVERSION`

Unknown outcomes are not treated as hard failures. They are weak/neutral signals depending on notification type and expected action.

---

## Deployment Notes

This feature adds a new DynamoDB table and new Lambda environment variables.

Rebuild Java Lambda artifacts before deploying `SR-Compute`:

```bash
./scripts/build-services.sh
```

Deploy order:

```bash
cd infra/cdk
pnpm run build
pnpm exec cdk deploy SR-Data
pnpm exec cdk deploy SR-Compute
```

---

## Design Principle

The existing model optimizes short-term timing.

Attention Escrow optimizes long-term trust:

```text
Predict -> Gate -> Send or defer -> Observe -> Update trust -> Improve future decisions
```
