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

**Request**:
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

**Response 200**:
```json
{
  "userId": "user_123",
  "status": "queued"
}
```

**Response 404** (user not found):
```json
{
  "error": "User not found: user_123. Create user first via POST /v1/users"
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
  "windowEnd": 1718272800
}
```

Timestamps are Unix epoch (seconds).

**Response 200**:
```json
{
  "hour": 14,
  "probability": 0.73,
  "channel": "EMAIL"
}
```

**POST /v1/decisions/schedule** - Schedule notification

**Request**:
```json
{
  "userId": "user_123",
  "windowStart": 1718186400,
  "windowEnd": 1718272800,
  "channel": "SMS"
}
```

`channel` is optional. If not specified, uses user preference or falls back to EMAIL.

**Response 200**:
```json
{
  "userId": "user_123",
  "scheduleId": "sched_abc123",
  "scheduledTime": "2026-06-12T14:00:00Z",
  "channel": "EMAIL",
  "fallback": false
}
```

With fallback:
```json
{
  "userId": "user_123",
  "scheduleId": "sched_abc123",
  "scheduledTime": "2026-06-12T14:00:00Z",
  "channel": "EMAIL",
  "channelRequested": "SMS",
  "fallback": true,
  "fallbackReason": "Requested channel unavailable: missing phone"
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

# 3. Preview optimal time
curl -X POST $API_URL/v1/decisions/preview \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "pilot_user_1",
    "windowStart": 1718186400,
    "windowEnd": 1718272800
  }'

# 4. Schedule notification
curl -X POST $API_URL/v1/decisions/schedule \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "pilot_user_1",
    "windowStart": 1718186400,
    "windowEnd": 1718272800
  }'

# 5. Get user profile
curl -X GET $API_URL/v1/users/pilot_user_1 \
  -H "Authorization: Bearer $TOKEN"
```

---

**Last Updated**: June 2026
