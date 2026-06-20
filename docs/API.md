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
  "messageCategory": "MARKETING",
  "priorityClass": "LOW",
  "businessValue": 6.0,
  "urgency": 0.3
}
```

Timestamps are Unix epoch (seconds).

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
| `TRANSACTIONAL` | Must-reach user-requested update |
| `SECURITY` | Security-critical alert |
| `EMERGENCY` | Emergency or safety alert |

`businessValue` is the sender-side value of this message from `0.0` to `10.0`. `urgency` is the time sensitivity from `0.0` to `1.0`; use it only when waiting would noticeably reduce usefulness.

Do not use `notificationType` for Attention Escrow category. In the event ingestion flow, `notificationType` is reserved for routing modes such as `immediate` and `optimized`. Use `messageCategory` for business category.

**Response 200**:
```json
{
  "userId": "user_123",
  "hour": 14,
  "probability": 0.73,
  "sendNowHour": 10,
  "sendNowProbability": 0.41,
  "recommendedSendTime": "2026-06-12T14:00Z",
  "attentionDecision": "SEND",
  "attentionCost": 2.4,
  "attentionValue": 5.9,
  "attentionMargin": 1.0,
  "attentionReason": "Predicted value exceeds attention cost",
  "fatigueScore": 0.33,
  "sourceTrustScore": 0.75,
  "sourceId": "campaign:abandoned_cart",
  "decisionId": "attn_abc123",
  "scheduled": false
}
```

`probability` is the model score for the recommended hour. `sendNowProbability` is the model score for the current hour at request time. `recommendedSendTime` shows the timestamp that would be used if the caller schedules this decision.

**POST /v1/decisions/schedule** - Schedule notification

**Request**:
```json
{
  "userId": "user_123",
  "windowStart": 1718186400,
  "windowEnd": 1718272800,
  "channel": "SMS",
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

**Response 200**:
```json
{
  "userId": "user_123",
  "hour": 14,
  "probability": 0.73,
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

Use this endpoint for the Attention Escrow dashboard. It aggregates `ATTENTION_DECISION` records from `AttentionLedger`.

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
