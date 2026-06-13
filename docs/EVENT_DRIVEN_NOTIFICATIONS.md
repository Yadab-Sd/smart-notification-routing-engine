# Event-Driven Notification Architecture

## Overview

The system supports **automatic notification triggering** based on user events, matching real-world notification platforms like Braze, Twilio Segment, and Iterable.

**Flow**: Event → Kinesis → Events Consumer → Auto-trigger Notification

---

## Event Types

### 1. Analytics-Only Events (No Notification)

Events without `notificationType` field are recorded for ML training only.

```json
{
  "userId": "user_123",
  "type": "CLICK",
  "ts": "2026-06-13T10:30:00Z"
}
```

**Behavior**:
- ✅ Written to S3 for ML training
- ✅ Updates DynamoDB counters
- ❌ NO notification sent

---

### 2. Immediate Notifications (Transactional)

Use `"notificationType": "immediate"` for time-sensitive, transactional messages.

```json
{
  "userId": "user_123",
  "type": "ORDER_PLACED",
  "notificationType": "immediate",
  "message": "Order #12345 confirmed! Ships in 24 hours.",
  "channel": "EMAIL",
  "ts": "2026-06-13T10:30:00Z",
  "metadata": {
    "orderId": "12345",
    "orderTotal": "$49.99"
  }
}
```

**Behavior**:
- ✅ Recorded to S3/DynamoDB
- ✅ **Sends notification immediately** via Sender Lambda
- ✅ Uses specified channel or user preference
- ⏱️ **Latency**: < 2 seconds

**Use cases**:
- Order confirmations
- Password resets
- OTP codes
- Payment receipts
- Account security alerts

---

### 3. ML-Optimized Notifications (Marketing)

Use `"notificationType": "optimized"` for engagement/marketing messages.

```json
{
  "userId": "user_123",
  "type": "CART_ABANDONED",
  "notificationType": "optimized",
  "message": "You left 3 items in your cart. Complete your purchase now!",
  "channel": "SMS",
  "ts": "2026-06-13T10:30:00Z",
  "metadata": {
    "cartValue": "$129.99",
    "itemCount": 3
  }
}
```

**Behavior**:
- ✅ Recorded to S3/DynamoDB
- ✅ **Triggers Decision Service** to predict best send time
- ✅ Schedules notification via EventBridge (within 24 hours)
- ⏱️ **Latency**: Sent at ML-predicted optimal hour

**Use cases**:
- Cart abandonment reminders
- Product recommendations
- Weekly digests
- Re-engagement campaigns
- Promotional offers

---

## Complete Flow Diagram

### Immediate Notification Flow

```
POST /v1/events {notificationType: "immediate"}
  ↓
Control Plane Lambda
  ↓
Kinesis Stream
  ↓
Events Consumer Lambda
  ├─→ S3 raw/ (for ML training)
  ├─→ DynamoDB counters
  └─→ Invoke Sender Lambda directly ⚡
        ↓
      Sender Lambda
        ├─→ Fetch user profile
        ├─→ Select channel (EMAIL/SMS)
        ├─→ Send via SES/SNS
        └─→ Record SEND event
```

**Total time**: 1-3 seconds

---

### Optimized Notification Flow

```
POST /v1/events {notificationType: "optimized"}
  ↓
Control Plane Lambda
  ↓
Kinesis Stream
  ↓
Events Consumer Lambda
  ├─→ S3 raw/ (for ML training)
  ├─→ DynamoDB counters
  └─→ Invoke Decision Lambda 🧠
        ↓
      Decision Service Lambda
        ├─→ Fetch user click rate
        ├─→ Call SageMaker endpoint for each hour
        ├─→ Find hour with highest probability
        └─→ Create EventBridge Schedule
              ↓
            [Wait until optimal hour]
              ↓
            EventBridge Scheduler triggers Sender Lambda
              ↓
            Sender Lambda sends notification
```

**Total time**: 0-24 hours (scheduled at optimal time)

---

## API Examples

### Example 1: Order Confirmation (Immediate)

```bash
curl -X POST $API_URL/v1/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_123",
    "type": "ORDER_PLACED",
    "notificationType": "immediate",
    "message": "Your order #12345 has been confirmed!",
    "channel": "EMAIL",
    "ts": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "metadata": {
      "orderId": "12345",
      "total": "$49.99"
    }
  }'
```

**Response**:
```json
{
  "userId": "user_123",
  "status": "queued"
}
```

**Result**: Email sent within 2 seconds ✉️

---

### Example 2: Cart Abandonment (ML-Optimized)

```bash
curl -X POST $API_URL/v1/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_123",
    "type": "CART_ABANDONED",
    "notificationType": "optimized",
    "message": "Complete your purchase! 3 items waiting in your cart.",
    "ts": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "metadata": {
      "cartValue": "$129.99",
      "items": 3
    }
  }'
```

**Response**:
```json
{
  "userId": "user_123",
  "status": "queued"
}
```

**Result**: Notification scheduled for optimal hour (e.g., 2pm tomorrow) 📅

---

### Example 3: Analytics Only (No Notification)

```bash
curl -X POST $API_URL/v1/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_123",
    "type": "CLICK",
    "ts": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'
```

**Response**:
```json
{
  "userId": "user_123",
  "status": "queued"
}
```

**Result**: No notification sent, data recorded for ML training only 📊

---

## Event Schema Reference

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | User identifier (must exist in system) |
| `type` | string | Event type (CLICK, ORDER_PLACED, etc.) |
| `ts` | string | ISO 8601 timestamp |

### Optional Fields (For Notifications)

| Field | Type | Description |
|-------|------|-------------|
| `notificationType` | string | `"immediate"` or `"optimized"` |
| `message` | string | Custom notification message |
| `channel` | string | `"EMAIL"` or `"SMS"` (overrides user preference) |
| `metadata` | object | Additional event data |

---

## Channel Selection Logic

When `notificationType` is present:

1. **Explicit channel** in event → Use that channel
2. **No channel specified** → Use user preference from DynamoDB
3. **No user preference** → Smart fallback: EMAIL > SMS > PUSH
4. **No contact info** → Fail with error

---

## Error Handling

### Event rejected (404)

**Cause**: User doesn't exist

**Solution**: Create user first via `POST /v1/users`

```bash
curl -X POST $API_URL/v1/users \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "userId": "user_123",
    "email": "user@example.com",
    "prefs": {"channel": "EMAIL"}
  }'
```

---

### Notification trigger fails

**Events Consumer behavior**: 
- Logs error
- Does NOT fail entire Kinesis batch
- Event still recorded to S3/DynamoDB
- Only notification trigger skipped

**Check CloudWatch logs**:
```bash
aws logs tail /aws/lambda/SR-Compute-EventsConsumerFn --follow
```

---

### No contact info for channel

**Sender behavior**:
- Falls back to available channel
- Returns `fallback: true` in response
- Logs fallback reason

**Example**: User has no phone, SMS requested → Falls back to EMAIL

---

## Monitoring

### Check notification triggers

```bash
# Events Consumer logs (see trigger decisions)
aws logs filter-log-events \
  --log-group-name /aws/lambda/SR-Compute-EventsConsumerFn \
  --filter-pattern "Triggering" \
  --start-time $(date -d '1 hour ago' +%s)000
```

### Check immediate sends

```bash
# Sender Lambda logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/SR-Compute-SenderFn \
  --filter-pattern "Notification sent" \
  --start-time $(date -d '1 hour ago' +%s)000
```

### Check scheduled sends

```bash
# List active schedules
aws scheduler list-schedules \
  --query "Schedules[?starts_with(Name, 'send-email')]" \
  --output table
```

---

## Architecture Comparison

### Before (Manual)

```
Your App → POST /v1/events → Records event ✅
Your App → POST /v1/decisions/schedule → Triggers notification ❌ Manual step
```

**Problem**: Requires external orchestration

---

### After (Event-Driven)

```
Your App → POST /v1/events {notificationType: "immediate"} → Auto-sends ✅
```

**Benefit**: Fully automatic, matches Braze/Iterable/Segment behavior

---

## Real-World Use Cases

### E-Commerce Platform

```javascript
// Order placed
POST /v1/events {
  type: "ORDER_PLACED",
  notificationType: "immediate",
  message: "Order confirmed!"
}

// Cart abandoned (1 hour later)
POST /v1/events {
  type: "CART_ABANDONED",
  notificationType: "optimized",
  message: "Complete your purchase!"
}
```

---

### Healthcare Platform

```javascript
// Appointment reminder
POST /v1/events {
  type: "APPOINTMENT_REMINDER",
  notificationType: "immediate",
  message: "Your appointment is tomorrow at 2pm",
  channel: "SMS"
}

// Medication refill reminder
POST /v1/events {
  type: "REFILL_DUE",
  notificationType: "optimized",
  message: "Time to refill your prescription"
}
```

---

### SaaS Platform

```javascript
// Welcome email
POST /v1/events {
  type: "USER_SIGNUP",
  notificationType: "immediate",
  message: "Welcome to our platform!"
}

// Re-engagement campaign
POST /v1/events {
  type: "INACTIVE_USER",
  notificationType: "optimized",
  message: "We miss you! Check out what's new."
}
```

---

## Migration Guide

### Existing Manual Flow

```bash
# Old way (2 API calls)
curl -X POST $API_URL/v1/events -d '{"userId":"123","type":"CLICK"}'
curl -X POST $API_URL/v1/decisions/schedule -d '{"userId":"123",...}'
```

### New Event-Driven Flow

```bash
# New way (1 API call)
curl -X POST $API_URL/v1/events -d '{
  "userId":"123",
  "type":"PROMO",
  "notificationType":"optimized",
  "message":"Check out our sale!"
}'
```

**Benefits**:
- 50% fewer API calls
- Automatic notification orchestration
- Matches industry best practices

---

**Last Updated**: June 2026
