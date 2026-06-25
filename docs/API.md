# API Reference

## Base URL

```
https://{api-id}.execute-api.us-west-2.amazonaws.com
```

Get your API URL after deployment:
```bash
aws cloudformation describe-stacks --stack-name SR-Compute \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text
```

---

## Authentication

All endpoints (except `/v1/health`) require JWT authentication via AWS Cognito.

**Header**:
```
Authorization: Bearer {jwt_token}
```

**Get token**:
```bash
aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id {client_id} \
  --auth-parameters USERNAME={username},PASSWORD={password} \
  --query 'AuthenticationResult.IdToken' --output text
```

---

## Endpoints

### Health Check

**GET /v1/health**

Check API status (no auth required).

**Response 200**:
```json
{
  "status": "ok"
}
```

---

### User Management

**POST /v1/users** - Create user

**Request**:
```json
{
  "userId": "user_123",
  "email": "user@example.com",
  "phone": "+14155551234",
  "prefs": {
    "channel": "EMAIL"
  }
}
```

**Response 201**:
```json
{
  "userId": "user_123",
  "created": true
}
```

**GET /v1/users/{id}** - Get user

**Response 200**:
```json
{
  "userId": "user_123",
  "email": "user@example.com",
  "phone": "+14155551234",
  "prefs": { "channel": "EMAIL" },
  "counters": {
    "events": 100,
    "clicks": 45,
    "sends": 50
  },
  "lastSeenAt": "2026-06-12T10:30:00Z"
}
```

**PUT /v1/users/{id}** - Update user

**Request**:
```json
{
  "email": "newemail@example.com",
  "prefs": { "channel": "SMS" }
}
```

**Response 200**:
```json
{
  "userId": "user_123",
  "updated": true
}
```

**DELETE /v1/users/{id}** - Delete user

**Response 200**:
```json
{
  "userId": "user_123",
  "deleted": true
}
```

---

### Event Tracking

**POST /v1/events** - Track event

**Analytics-only request**:
```json
{
  "userId": "user_123",
  "type": "CLICK",
  "ts": "2026-06-12T10:30:00Z"
}
```

**Event types**:
- `CLICK`: User clicked notification
- `SEND`: Notification sent
- `OPEN`: User opened notification
- Custom types supported

Events may also include an optional `notification` object. This lets an existing application record an event and ask the routing engine to send a related message.

### Notification Categories

Categories are organization-defined notification policies. They are different from campaigns:

- **Category**: reusable rules/defaults for a type of notification, such as appointment reminder, renewal reminder, learning nudge, or marketing offer.
- **Campaign**: a specific initiative or message run, such as March renewal campaign or Spring enrollment reminder.

Create categories first when you want API callers to send simpler events and let SNRE fill in policy defaults. Categories are stored independently from users in the `NotificationCategories` DynamoDB table and scoped by organization. Until full multi-tenant onboarding exists, the API uses organization `default`; callers may send `X-Organization-Id` to scope categories explicitly.

In the admin console, use **Messaging → Categories** to create and edit these policies. The **Send Event** and **Attention Escrow** pages can load a category and lock its policy fields so test sends follow the organization's configured rules. Leave the category blank when you want a custom one-off decision without a category relationship.

The **Attention Escrow** page is a decision workbench: choose a delivery window, preview first, then schedule the recommended time, send immediately, or adjust inputs and preview again. The default UI window is the next 24 hours, but admins can choose today, tomorrow, next 48 hours, or a custom local date/time range. If the selected category has `defaultDeliveryMode: "IMMEDIATE"`, the preview focuses on send-now impact and the UI shows only the Send Now action.

Category `maxDelayHours` is a policy limit for that notification type. The Attention page uses it to prefill the delivery window for optimized categories. The delivery window is still the actual per-decision search range. Immediate categories use `maxDelayHours: 0` and hide delivery-window controls because no scheduling search is needed.

Storage shape:

- Table: `NotificationCategories`
- Partition key: `pk = ORG#{organizationId}`
- Sort key: `sk = CATEGORY#{categoryId}`
- CloudFormation output: `SR-Data.NotificationCategoriesTableName`

**POST /v1/categories** - Create category

```bash
curl -X POST $API_URL/v1/categories \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "categoryId": "appointment_reminder",
    "displayName": "Appointment Reminder",
    "description": "Reminder before a scheduled appointment",
    "defaultDeliveryMode": "OPTIMIZED",
    "allowedChannels": ["EMAIL", "SMS"],
    "messageCategory": "TRANSACTIONAL",
    "riskClass": "LOW",
    "priorityClass": "STANDARD",
    "businessValue": 7.0,
    "urgency": 0.6,
    "maxDelayHours": 24,
    "quietHoursRespect": true,
    "active": true
  }'
```

**GET /v1/categories** - List categories

```bash
curl -H "Authorization: Bearer $TOKEN" $API_URL/v1/categories
```

**GET /v1/categories/{categoryId}** - Get one category

```bash
curl -H "Authorization: Bearer $TOKEN" \
  $API_URL/v1/categories/appointment_reminder
```

**PUT /v1/categories/{categoryId}** - Replace category config

```bash
curl -X PUT $API_URL/v1/categories/appointment_reminder \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "Appointment Reminder",
    "defaultDeliveryMode": "OPTIMIZED",
    "allowedChannels": ["EMAIL"],
    "messageCategory": "TRANSACTIONAL",
    "riskClass": "LOW",
    "priorityClass": "STANDARD",
    "businessValue": 7.0,
    "urgency": 0.5,
    "maxDelayHours": 12,
    "active": true
  }'
```

**DELETE /v1/categories/{categoryId}** - Delete category

```bash
curl -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  $API_URL/v1/categories/appointment_reminder
```

When `/v1/events` includes `notification.categoryId`, Control Plane loads the category and fills missing notification fields. The admin UI locks category policy fields after selection. Direct API callers may still send explicit policy fields; the backend preserves category audit metadata so a future admin UI can re-enable override workflows without backend changes. For example, an event may send only:

```json
{
  "notification": {
    "categoryId": "appointment_reminder",
    "message": "Your appointment is tomorrow at 10 AM."
  }
}
```

SNRE enriches it internally with category defaults such as `deliveryMode`, `messageCategory`, `priorityClass`, `businessValue`, `urgency`, `maxDelayHours`, and channel policy before routing.

To override one send through the API while still keeping the category relationship:

```json
{
  "notification": {
    "categoryId": "appointment_reminder",
    "message": "Your appointment is tomorrow at 10 AM.",
    "priorityClass": "HIGH",
    "urgency": 0.9,
    "businessValue": 8.5
  }
}
```

Attention Escrow uses the final enriched values for that specific user/message. There is no category-level `bypassAttentionEscrow`; urgent or must-send policies should use `priorityClass` values such as `URGENT`, `CRITICAL`, or `EMERGENCY`, combined with the correct `messageCategory`.

For auditability and future model training, category-based events are enriched before routing with:

- `categoryDefaults`: the category policy configured by the organization
- `effectivePolicy`: the final policy used for this specific send or preview
- `policyOverrides`: boolean flags showing which category defaults were explicitly changed

Decision Service stores these fields in `AttentionLedger` with `overrideCount` and `overrideMagnitude` when the decision is scheduled or triggered through `/v1/events`.

Preview requests are simulations by default and do not write `ATTENTION_DECISION` records unless `auditPreview` is explicitly set to `true`. This keeps KPI cards and future model training focused on real scheduled/event-driven decisions instead of admin experiments.

**Event-triggered immediate notification**:
```json
{
  "userId": "user_123",
  "type": "ORDER_READY",
  "ts": "2026-06-12T10:30:00Z",
  "attrs": {
    "orderId": "order_789"
  },
  "notification": {
    "deliveryMode": "IMMEDIATE",
    "channel": "SMS",
    "message": "Your order is ready for pickup.",
    "metadata": {
      "subject": "Order ready"
    }
  }
}
```

**Event-triggered optimized notification**:
```json
{
  "userId": "user_123",
  "type": "ABANDONED_CART",
  "ts": "2026-06-12T10:30:00Z",
  "attrs": {
    "cartId": "cart_456"
  },
  "notification": {
    "categoryId": "cart_recovery",
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

`deliveryMode` values:
- `IMMEDIATE`: invoke Sender Service now
- `OPTIMIZED`: invoke Decision Service; send-time model and Attention Escrow decide whether and when to schedule

For backward compatibility, top-level `notificationType: "immediate"` and `notificationType: "optimized"` still work. New integrations should use `notification.deliveryMode`.

`categoryId` is optional. If supplied, it must reference an active category created with `/v1/categories`. The admin UI treats category policy as locked. Direct API callers can still override category defaults, and the backend records override audit fields.

**Response 200**:
```json
{
  "userId": "user_123",
  "status": "queued"
}
```

For `deliveryMode: "OPTIMIZED"`, the event response means the event was accepted into the ingestion stream. Track the routing decision in the `AttentionLedger` DynamoDB table:

```bash
aws cloudformation describe-stacks \
  --stack-name SR-Data \
  --query "Stacks[0].Outputs[?OutputKey=='AttentionLedgerTableName'].OutputValue" \
  --output text

aws dynamodb query \
  --table-name "$ATTENTION_TABLE" \
  --key-condition-expression "pk = :pk" \
  --expression-attribute-values '{":pk":{"S":"USER#user_123"}}' \
  --scan-index-forward false \
  --limit 20
```

Expected optimized records:
- `ATTENTION_DECISION`: written by Decision Service after Attention Escrow evaluates the message
- `ATTENTION_DELIVERY`: written later by Sender Service when a scheduled `SEND` decision is delivered

If the ledger is empty, check Events Consumer CloudWatch logs first. Look for `Decision service invoked` and inspect the logged payload response. A `400`/`500` response means Decision Service did not reach the ledger write.

If the user does not exist, the Control Plane can auto-create the user when the event includes `email` or `phone`.

**Response 400** (user not found and no contact info provided):
```json
{
  "error": "User not found and no contact info (email/phone) provided in event"
}
```

---

### Reusable Campaigns

Campaigns are saved notification plans. They prevent admins from retyping the same campaign ID, message, category, priority, business value, urgency, and delivery settings every time they want to run another launch.

A campaign is reusable configuration. A campaign launch is one execution of that configuration.

In the admin UI, loading a saved campaign populates the campaign draft form and filters recent launch history to that campaign. The campaign library `Outcome` action shows campaign-wide performance across all launches for the same `campaignId`.

**POST /v1/campaigns** - Create reusable campaign

```json
{
  "campaignId": "renewal_reminder_june",
  "name": "Renewal Reminder June",
  "description": "Reminder campaign for June renewals",
  "categoryId": "renewal_reminder",
  "eventType": "CAMPAIGN_NOTIFICATION",
  "subject": "Your renewal is coming up",
  "message": "Please review your renewal details.",
  "channel": "EMAIL",
  "messageCategory": "TRANSACTIONAL",
  "priorityClass": "STANDARD",
  "businessValue": 7.0,
  "urgency": 0.5,
  "maxDelayHours": 24,
  "defaultDeliveryMode": "OPTIMIZED",
  "active": true
}
```

**GET /v1/campaigns** - List reusable campaigns

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "$API_URL/v1/campaigns"
```

**GET /v1/campaigns/{campaignId}** - Get one campaign

**PUT /v1/campaigns/{campaignId}** - Update campaign

**DELETE /v1/campaigns/{campaignId}** - Delete campaign configuration. Existing launch history remains stored separately.

---

### Campaign Launch History

Campaign launch history stores the result of launching a campaign batch after preview. It is an audit summary, not the delivery outcome itself. Delivery, bounce, complaint, and suppression outcomes are still tracked by sender and SES event flows.

Launch records are stored in `AttentionLedger` with `recordType: "CAMPAIGN_LAUNCH"` and organization scope.

The Campaigns page loads a campaign outcome snapshot by querying `GET /v1/attention/summary?sourceId=campaign:{campaignId}`. That summary intentionally aggregates all launches for the same campaign, so admins can see overall campaign performance over time. Immediate campaign sends carry `sourceId` to Sender Service so delivery records can still be counted even when no scheduled Attention decision exists.

**POST /v1/campaigns/launches** - Record campaign launch summary

The Campaigns page calls this after submitting campaign events through `/v1/events`.

**Request**:
```json
{
  "campaignId": "renewal_reminder_june",
  "categoryId": "renewal_reminder",
  "sourceId": "campaign:renewal_reminder_june",
  "deliveryMode": "OPTIMIZED",
  "recipientCount": 100,
  "previewedCount": 98,
  "sendReadyCount": 76,
  "deferredCount": 22,
  "deferredIncludedCount": 3,
  "notFoundSkippedCount": 2,
  "acceptedCount": 79,
  "failedCount": 0,
  "avgAttentionCost": 2.4,
  "avgAttentionValue": 6.1,
  "avgFatigueScore": 0.18,
  "avgProbability": 0.71,
  "estimatedAttentionSaved": 11.2,
  "modelSource": "SAGEMAKER",
  "modelConfidence": "TRAINED_MODEL",
  "recommendation": "Batch looks healthy: most recipients clear the attention gate with value above cost."
}
```

**GET /v1/campaigns/launches** - List recent campaign launch summaries

Query parameters:

| Parameter | Meaning |
| --- | --- |
| `campaignId` | Optional campaign filter |
| `limit` | Optional result limit, default 25 |

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "$API_URL/v1/campaigns/launches?limit=10"
```

---

### Decision & Scheduling

**POST /v1/decisions/preview** - Get optimal send time

**Request**:
```json
{
  "userId": "user_123",
  "windowStart": 1718186400,
  "windowEnd": 1718272800,
  "channel": "EMAIL",
  "sourceId": "campaign:abandoned_cart",
  "timezone": "America/Los_Angeles",
  "messageCategory": "MARKETING",
  "priorityClass": "LOW",
  "businessValue": 6.0,
  "urgency": 0.3
}
```

Timestamps are Unix epoch (seconds).
`timezone` is optional. When provided, EventBridge Scheduler uses it to format the one-time schedule expression while preserving the same absolute UTC send instant. If omitted, schedules use UTC.

Attention Escrow fields are optional:
- `sourceId`: Internal message source for trust tracking
- `campaignId`: Campaign identifier, used if `sourceId` is omitted
- `templateId`: Template identifier, used if `sourceId` and `campaignId` are omitted
- `businessValue`: `0.0` to `10.0`
- `urgency`: `0.0` to `1.0`

`channel` values:

| Value | Meaning |
| --- | --- |
| `AUTO` | Let Sender Service choose from user preferences |
| `EMAIL` | Email delivery; lower interruption cost |
| `SMS` | SMS delivery; higher interruption cost |
| `PUSH` | Push notification delivery; medium interruption cost |

`messageCategory` values:

| Value | Meaning |
| --- | --- |
| `GENERAL` | Default informational message |
| `MARKETING` | Revenue or re-engagement message |
| `PROMOTION` | Discount, offer, or campaign message |
| `NEWSLETTER` | Recurring content update |
| `TRANSACTIONAL` | User-requested or account-related update |
| `SECURITY` | Security-sensitive alert |
| `EMERGENCY` | Emergency or safety alert |

`priorityClass` values:

| Value | Meaning |
| --- | --- |
| `LOW` | Nice-to-have message; requires stronger value to send |
| `STANDARD` | Normal message; default priority |
| `HIGH` | Important but not mandatory |
| `URGENT` | Time-sensitive message; small delay allowed |
| `CRITICAL` | Must-reach-soon message; bypasses the normal attention budget |
| `EMERGENCY` | Emergency or safety alert |

`businessValue` is the sender-side value of this message from `0.0` to `10.0`. `urgency` is the time sensitivity from `0.0` to `1.0`; use it only when waiting would noticeably reduce usefulness.

Do not use `notificationType` for Attention Escrow category. In the event ingestion flow, `notificationType` is reserved for routing modes such as `immediate` and `optimized`. Use `messageCategory` for business category.

**Response 200**:
```json
{
  "userId": "user_123",
  "hour": 14,
  "probability": 0.73,
  "modelSource": "SAGEMAKER",
  "modelConfidence": "TRAINED_MODEL",
  "modelExplanation": "Prediction from the SageMaker send-time model trained on historical notification engagement data.",
  "recommendedSendTime": "2026-06-12T14:00:00Z",
  "sendNowTime": "2026-06-12T10:37:24Z",
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
  "categoryId": "appointment_reminder",
  "decisionId": "attn_abc123",
  "categoryDefaults": {
    "messageCategory": "TRANSACTIONAL",
    "priorityClass": "STANDARD",
    "businessValue": 7.0,
    "urgency": 0.6
  },
  "effectivePolicy": {
    "messageCategory": "TRANSACTIONAL",
    "priorityClass": "HIGH",
    "businessValue": 8.5,
    "urgency": 0.9
  },
  "policyOverrides": {
    "priorityClass": true,
    "businessValue": true,
    "urgency": true
  },
  "overrideCount": 3,
  "overrideMagnitude": 0.78,
  "previewOnly": true,
  "scheduled": false
}
```

`recommendedSendTime` is the actual UTC timestamp chosen inside `windowStart`/`windowEnd`. `probability` is the model score for that timestamp's UTC hour bucket. `sendNowTime` is the actual current request time in UTC, not `windowStart`; `sendNowProbability` is the model score for that current UTC hour bucket. If `windowStart` is in the future, send-now impact is shown as a separate immediate-send comparison, while the recommended time still stays inside the requested window.

`modelSource` is `SAGEMAKER` when the send-time endpoint is available. If the endpoint is missing, throttled, or unavailable, Decision Service uses a built-in heuristic scorer and returns `FALLBACK_HEURISTIC` so preview and schedule flows still work during first-time setup. In fallback mode, treat `probability` and `sendNowProbability` as startup timing estimates, not trained click predictions. `modelConfidence` will be `LOW_STARTUP_ESTIMATE` until SageMaker is available.

`/v1/decisions/preview` returns `previewOnly: true` by default. It does not write to `AttentionLedger`, so KPI cards and future model training are based on real scheduled/event-driven decisions instead of admin experiments. To audit previews intentionally, send `"auditPreview": true`.

Scheduled recommendations avoid the current instant. The API scores send-now separately through `sendNowProbability`; `/v1/decisions/schedule` uses a future candidate slot and enforces a minimum scheduling lead time so the Schedule action does not behave like Send Now.

**POST /v1/decisions/batch-preview** - Preview Attention Escrow decisions for a campaign draft

This endpoint is the MVP campaign workflow. It previews multiple users at once, returns a campaign-level summary, and does **not** schedule sends or write `AttentionLedger` records. Use it before launching a batch/campaign to see how many users would send, defer, or fail because the profile does not exist.

Current MVP limit: 100 users per request.

The admin Campaigns page uses this endpoint first, then launches previewed users through the existing `/v1/events` endpoint. By default, only `SEND` users are launched and `DEFER`/missing users are skipped. If deferred users exist, the UI can show an admin override checkbox to include them deliberately. `Send now` submits `deliveryMode: "IMMEDIATE"`. `Schedule optimized` submits `deliveryMode: "OPTIMIZED"` and lets the normal event-consumer/Decision-Service flow create schedules.

**Request**:
```json
{
  "campaignId": "renewal_reminder_june",
  "categoryId": "renewal_reminder",
  "userIds": ["user_123", "user_456", "user_789"],
  "windowStart": 1782345600,
  "windowEnd": 1782432000,
  "channel": "EMAIL",
  "messageCategory": "TRANSACTIONAL",
  "priorityClass": "STANDARD",
  "businessValue": 7.0,
  "urgency": 0.6,
  "message": "Your renewal date is coming up."
}
```

`categoryId` is optional but recommended for real campaign previews. When a category is selected in the admin UI, category policy fields are locked and sent as the effective policy for auditability.

**Response 200**:
```json
{
  "campaignId": "renewal_reminder_june",
  "categoryId": "renewal_reminder",
  "sourceId": "campaign:renewal_reminder_june",
  "previewOnly": true,
  "recipientCount": 3,
  "previewedCount": 2,
  "sendCount": 2,
  "deferCount": 0,
  "notFoundCount": 1,
  "sendRate": 1.0,
  "deferRate": 0.0,
  "avgAttentionCost": 2.35,
  "avgAttentionValue": 6.12,
  "avgFatigueScore": 0.18,
  "avgProbability": 0.71,
  "estimatedAttentionSaved": 0.0,
  "modelSource": "FALLBACK_HEURISTIC",
  "modelConfidence": "LOW_STARTUP_ESTIMATE",
  "recommendation": "Batch looks healthy: most recipients clear the attention gate with value above cost.",
  "results": [
    {
      "userId": "user_123",
      "status": "PREVIEWED",
      "attentionDecision": "SEND",
      "recommendedSendTime": "2026-06-24T16:00:00Z",
      "probability": 0.74,
      "attentionCost": 2.1,
      "attentionValue": 6.4,
      "attentionReason": "Predicted value exceeds attention cost",
      "previewOnly": true
    },
    {
      "userId": "user_789",
      "status": "USER_NOT_FOUND",
      "attentionDecision": "SKIPPED",
      "attentionReason": "User profile not found",
      "previewOnly": true
    }
  ]
}
```

**POST /v1/decisions/schedule** - Schedule notification

**Request**:
```json
{
  "userId": "user_123",
  "windowStart": 1718186400,
  "windowEnd": 1718272800,
  "channel": "SMS",
  "timezone": "America/Los_Angeles",
  "messageCategory": "TRANSACTIONAL",
  "priorityClass": "HIGH",
  "message": "Your order is ready.",
  "metadata": {
    "subject": "Order update"
  }
}
```

`channel` is optional. If not specified, Sender Service uses user preference or falls back to EMAIL.

Attention Escrow runs before scheduling. If the decision is `DEFER`, no EventBridge schedule is created.
One-time EventBridge schedules are deleted by Sender Service after successful delivery, so completed sends do not leave stale schedules behind.

**Response 200**:
```json
{
  "userId": "user_123",
  "hour": 14,
  "probability": 0.73,
  "modelSource": "SAGEMAKER",
  "modelConfidence": "TRAINED_MODEL",
  "recommendedSendTime": "2026-06-12T14:00:00Z",
  "sendNowTime": "2026-06-12T10:37:24Z",
  "sendNowHour": 10,
  "sendNowProbability": 0.41,
  "attentionDecision": "SEND",
  "attentionCost": 2.1,
  "attentionValue": 6.8,
  "attentionReason": "Predicted value exceeds attention cost",
  "decisionId": "attn_abc123",
  "scheduled": true,
  "scheduleId": "send-abc123",
  "scheduledTime": "2026-06-12T14:00:00Z"
}
```

Deferred:
```json
{
  "userId": "user_123",
  "hour": 14,
  "probability": 0.21,
  "attentionDecision": "DEFER",
  "attentionCost": 5.8,
  "attentionValue": 2.4,
  "attentionReason": "Marketing message deferred because attention cost is higher than value",
  "decisionId": "attn_def456",
  "scheduled": false,
  "scheduleSkippedReason": "Marketing message deferred because attention cost is higher than value"
}
```

Sender channel fallback is still returned by Sender Service at delivery time:
```json
{
  "statusCode": 200,
  "userId": "user_123",
  "channelUsed": "EMAIL",
  "channelRequested": "SMS",
  "fallback": true,
  "fallbackReason": "Requested channel unavailable: missing phone",
  "recipient": "us***@example.com",
  "message": "Notification sent successfully"
}
```

**GET /v1/attention/summary** - Business summary for Attention Escrow decisions

Query parameters:
- `sourceId`: optional campaign/source scope, for example `campaign:abandoned_cart`
- `userId`: optional user scope, for example `pilot_user_3`
- `limit`: optional number of recent records to inspect, default `200`, max `500`

Use this endpoint for the Attention Escrow dashboard. It aggregates `ATTENTION_DECISION` records from `AttentionLedger` and includes `ATTENTION_DELIVERY` counts when delivery records are available for the same scope.

**Response 200**:
```json
{
  "scope": {
    "sourceId": "campaign:abandoned_cart",
    "userId": "ALL",
    "limit": 200
  },
  "totalDecisions": 25,
  "sendDecisions": 16,
  "deferredDecisions": 9,
  "sendRate": 0.64,
  "deferRate": 0.36,
  "avgAttentionCost": 3.8,
  "avgAttentionValue": 5.1,
  "avgFatigueScore": 0.42,
  "avgSourceTrustScore": 0.75,
  "attentionProtected": 9,
  "estimatedAttentionSaved": 34.2,
  "deliveryRecords": 18,
  "sentDeliveries": 17,
  "failedDeliveries": 1,
  "deliverySuccessRate": 0.9444,
  "recommendation": "Mixed performance: compare message categories, priority classes, and source trust before increasing volume.",
  "topSources": [
    {
      "sourceId": "campaign:abandoned_cart",
      "decisions": 25
    }
  ],
  "recentDecisions": [
    {
      "decisionId": "attn_abc123",
      "userId": "pilot_user_3",
      "sourceId": "campaign:abandoned_cart",
      "channel": "EMAIL",
      "messageCategory": "MARKETING",
      "priorityClass": "STANDARD",
      "attentionDecision": "SEND",
      "attentionCost": 1.5,
      "attentionValue": 6.2,
      "fatigueScore": 0,
      "sourceTrustScore": 0.75,
      "reason": "Predicted value exceeds attention cost",
      "createdAt": "2026-06-20T08:00:00Z"
    }
  ]
}
```

---

## Error Responses

### 400 Bad Request

```json
{
  "error": "userId is required"
}
```

### 404 Not Found

```json
{
  "error": "User not found: user_123"
}
```

### 409 Conflict

```json
{
  "error": "User already exists: user_123"
}
```

### 500 Internal Server Error

```json
{
  "error": "Internal server error"
}
```

---

## Rate Limits

- **Burst**: 5000 requests/second
- **Steady state**: 10000 requests/second

Exceeding limits returns HTTP 429 (Too Many Requests).

---

## Complete Example

```bash
#!/bin/bash

API_URL="https://your-api-id.execute-api.us-west-2.amazonaws.com"
TOKEN="your-jwt-token"
WINDOW_START=$(date -u +%s)
WINDOW_END=$((WINDOW_START + 86400))

# 1. Create user
curl -X POST $API_URL/v1/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "pilot_user_1",
    "email": "pilot@example.com",
    "phone": "+14155551234",
    "prefs": {"channel": "EMAIL"}
  }'

# 2. Track event
curl -X POST $API_URL/v1/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "pilot_user_1",
    "type": "CLICK",
    "ts": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'

# 3. Track event and trigger an immediate notification
curl -X POST $API_URL/v1/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "pilot_user_1",
    "type": "ORDER_READY",
    "ts": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "notification": {
      "deliveryMode": "IMMEDIATE",
      "channel": "SMS",
      "message": "Your order is ready for pickup.",
      "metadata": {
        "subject": "Order ready"
      }
    }
  }'

# 4. Track event and trigger optimized delivery with Attention Escrow
curl -X POST $API_URL/v1/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "pilot_user_1",
    "type": "ABANDONED_CART",
    "ts": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
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
  }'

# 5. Preview optimal time and Attention Escrow decision directly
curl -X POST $API_URL/v1/decisions/preview \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "pilot_user_1",
    "windowStart": '"$WINDOW_START"',
    "windowEnd": '"$WINDOW_END"',
    "channel": "EMAIL",
    "sourceId": "campaign:abandoned_cart",
    "messageCategory": "MARKETING",
    "priorityClass": "LOW",
    "businessValue": 6.0,
    "urgency": 0.3
  }'

# 6. Schedule notification directly through Decision Service
curl -X POST $API_URL/v1/decisions/schedule \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "pilot_user_1",
    "windowStart": '"$WINDOW_START"',
    "windowEnd": '"$WINDOW_END"',
    "channel": "EMAIL",
    "sourceId": "campaign:abandoned_cart",
    "messageCategory": "MARKETING",
    "priorityClass": "LOW",
    "businessValue": 6.0,
    "urgency": 0.3,
    "message": "You left something in your cart.",
    "metadata": {
      "subject": "Complete your order"
    }
  }'

# 7. Get user profile
curl -X GET $API_URL/v1/users/pilot_user_1 \
  -H "Authorization: Bearer $TOKEN"
```

---

**Last Updated**: June 2026
