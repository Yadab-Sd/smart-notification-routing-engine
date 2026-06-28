# User Management API

## Overview

Users must be **explicitly created** before they can receive notifications or track events. This prevents spam, ensures data quality, and follows industry best practices (Twilio, Segment, Braze).

---

## User Lifecycle

```
1. Create User      → POST /v1/users (required first step)
2. Track Events     → POST /v1/events (validates user exists)
3. Send Notification → POST /v1/decisions/schedule (user must exist)
4. Update User      → PUT /v1/users/{id} (optional)
5. Delete User      → DELETE /v1/users/{id} (cleanup)
```

---

## API Endpoints

### 1. Create User

**Endpoint**: `POST /v1/users`

**Purpose**: Create a new user with contact information and preferences.

**Required Before**:
- Sending any events for this user
- Scheduling notifications for this user

**Request**:
```json
POST /v1/users
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "userId": "user_123",
  "email": "user@example.com",
  "phone": "+14155551234",
  "prefs": {
    "channel": "EMAIL"
  }
}
```

**Validation Rules**:
- `userId`: Required, string
- At least ONE of `email` or `phone` required
- `phone`: Must be E.164 format (`+[country code][number]`)
  - Valid: `+14155551234` (US)
  - Invalid: `4155551234`, `415-555-1234`
- `prefs.channel`: Optional, one of `EMAIL`, `SMS`, `PUSH`

**Response (201 Created)**:
```json
{
  "userId": "user_123",
  "created": true
}
```

**Error Responses**:

**400 Bad Request** - Missing required fields:
```json
{
  "error": "userId is required"
}
```

**400 Bad Request** - No contact info:
```json
{
  "error": "At least one contact method required (email or phone)"
}
```

**400 Bad Request** - Invalid phone format:
```json
{
  "error": "Phone must be in E.164 format (+1XXXXXXXXXX)"
}
```

**409 Conflict** - User already exists:
```json
{
  "error": "User already exists: user_123"
}
```

---

### 2. Get User

**Endpoint**: `GET /v1/users/{id}`

**Purpose**: Retrieve user profile with contact info and counters.

**Request**:
```bash
GET /v1/users/user_123
Authorization: Bearer {jwt_token}
```

**Response (200 OK)**:
```json
{
  "userId": "user_123",
  "email": "user@example.com",
  "phone": "+14155551234",
  "prefs": {
    "channel": "EMAIL"
  },
  "counters": {
    "events": 150,
    "clicks": 45,
    "sends": 50
  },
  "lastSeenAt": "2026-06-12T10:30:00Z"
}
```

**Error Response (404 Not Found)**:
```json
{
  "error": "User not found: user_123"
}
```

---

### 3. Update User

**Endpoint**: `PUT /v1/users/{id}`

**Purpose**: Update user's contact info or preferences.

**Request**:
```json
PUT /v1/users/user_123
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "email": "newemail@example.com",
  "phone": "+14155559999",
  "prefs": {
    "channel": "SMS"
  }
}
```

**Notes**:
- Only include fields you want to update
- Omitted fields remain unchanged
- Phone must be E.164 format if provided

**Response (200 OK)**:
```json
{
  "userId": "user_123",
  "updated": true
}
```

**Error Responses**:

**404 Not Found** - User doesn't exist:
```json
{
  "error": "User not found: user_123"
}
```

**400 Bad Request** - Invalid phone format:
```json
{
  "error": "Phone must be in E.164 format (+1XXXXXXXXXX)"
}
```

**400 Bad Request** - No fields to update:
```json
{
  "error": "No valid fields to update"
}
```

---

### 4. Delete User

**Endpoint**: `DELETE /v1/users/{id}`

**Purpose**: Permanently delete user and their profile.

**Request**:
```bash
DELETE /v1/users/user_123
Authorization: Bearer {jwt_token}
```

**Response (200 OK)**:
```json
{
  "userId": "user_123",
  "deleted": true
}
```

**Error Response (404 Not Found)**:
```json
{
  "error": "User not found: user_123"
}
```

**Important**: This does NOT delete historical events from S3 data lake. Only the user profile is removed.

---

## Event Ingestion (Updated)

### Track Event

**Endpoint**: `POST /v1/events`

**Purpose**: Track user events (CLICK, SEND, etc.)

**IMPORTANT CHANGE**: User must exist before tracking events.

**Request**:
```json
POST /v1/events
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "userId": "user_123",
  "type": "CLICK",
  "ts": "2026-06-12T10:30:00Z"
}
```

**Response (200 OK)**:
```json
{
  "userId": "user_123",
  "status": "queued"
}
```

**Error Response (404 Not Found)** - User doesn't exist:
```json
{
  "error": "User not found: user_123. Create user first via POST /v1/users"
}
```

**Before** (OLD BEHAVIOR - REMOVED):
- Events for non-existent users were accepted
- Users were auto-created without contact info
- Led to data pollution

**After** (NEW BEHAVIOR):
- Events rejected if user doesn't exist
- Must create user explicitly first
- Ensures data quality

---

## Pilot Workflow Example

### Step 1: Create Pilot Users

```bash
API_URL="https://your-api-id.execute-api.us-west-2.amazonaws.com"
TOKEN="your-jwt-token"

# Create User 1 (email preference)
curl -X POST $API_URL/v1/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "pilot_user_1",
    "email": "pilot.user1@example.com",
    "phone": "+14155551111",
    "prefs": {
      "channel": "EMAIL"
    }
  }'

# Create User 2 (SMS preference)
curl -X POST $API_URL/v1/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "pilot_user_2",
    "email": "pilot.user2@example.com",
    "phone": "+14155552222",
    "prefs": {
      "channel": "SMS"
    }
  }'
```

### Step 2: Track Events

```bash
# Track click event
curl -X POST $API_URL/v1/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "pilot_user_1",
    "type": "CLICK",
    "ts": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'

# Track send event
curl -X POST $API_URL/v1/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "pilot_user_1",
    "type": "SEND",
    "ts": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'
```

### Step 3: Schedule Notifications

```bash
# Schedule notification (uses user's preferred channel)
curl -X POST $API_URL/v1/decisions/schedule \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "pilot_user_1",
    "windowStart": 1718186400,
    "windowEnd": 1718272800
  }'
```

### Step 4: Update User Preferences

```bash
# Change channel preference to SMS
curl -X PUT $API_URL/v1/users/pilot_user_1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prefs": {
      "channel": "SMS"
    }
  }'
```

### Step 5: Get User Profile

```bash
# Check user details
curl -X GET $API_URL/v1/users/pilot_user_1 \
  -H "Authorization: Bearer $TOKEN"

# Response includes counters
{
  "userId": "pilot_user_1",
  "email": "pilot.user1@example.com",
  "phone": "+14155551111",
  "prefs": {
    "channel": "SMS"
  },
  "counters": {
    "events": 25,
    "clicks": 10,
    "sends": 15
  },
  "lastSeenAt": "2026-06-12T15:45:30Z"
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | When |
|------|---------|------|
| 200 | OK | Successful GET/PUT/DELETE |
| 201 | Created | Successful POST (user created) |
| 400 | Bad Request | Validation failed |
| 404 | Not Found | User doesn't exist |
| 409 | Conflict | User already exists |
| 500 | Internal Error | Server-side error |

### Common Errors

**Creating duplicate user**:
```bash
# First call succeeds
POST /v1/users { "userId": "user_123", "email": "..." }
# Response: 201 Created

# Second call fails
POST /v1/users { "userId": "user_123", "email": "..." }
# Response: 409 Conflict
```

**Tracking event for non-existent user**:
```bash
POST /v1/events { "userId": "fake_user", "type": "CLICK" }
# Response: 404 Not Found
# Error: "User not found: fake_user. Create user first via POST /v1/users"
```

**Updating non-existent user**:
```bash
PUT /v1/users/fake_user { "email": "..." }
# Response: 404 Not Found
```

---

## Phone Number Validation

### E.164 Format Required

Format: `+[country code][number]`

**Valid Examples**:
```
+14155551234    (US)
+442071234567   (UK)
+919876543210   (India)
+61412345678    (Australia)
```

**Invalid Examples** (will be rejected):
```
4155551234           (missing +)
415-555-1234         (contains dashes)
(415) 555-1234       (contains parentheses)
+1 415 555 1234      (contains spaces)
```

**Regex Pattern**: `^\\+[1-9]\\d{1,14}$`

**JavaScript Validation**:
```javascript
const isValidE164 = (phone) => /^\+[1-9]\d{1,14}$/.test(phone);

console.log(isValidE164('+14155551234')); // true
console.log(isValidE164('4155551234'));    // false
```

**Python Validation**:
```python
import re

def is_valid_e164(phone):
    return bool(re.match(r'^\+[1-9]\d{1,14}$', phone))

print(is_valid_e164('+14155551234'))  # True
print(is_valid_e164('4155551234'))    # False
```

---

## Data Model

### User Profile Structure

**DynamoDB Storage**:
```json
{
  "pk": "USER#user_123",
  "sk": "PROFILE",
  "email": "user@example.com",
  "phone": "+14155551234",
  "prefs": {
    "channel": "EMAIL"
  },
  "counters": {
    "events": 100,
    "clicks": 40,
    "sends": 50
  },
  "lastSeenAt": "2026-06-12T10:30:00Z"
}
```

**API Response Format**:
```json
{
  "userId": "user_123",
  "email": "user@example.com",
  "phone": "+14155551234",
  "prefs": {
    "channel": "EMAIL"
  },
  "counters": {
    "events": 100,
    "clicks": 40,
    "sends": 50
  },
  "lastSeenAt": "2026-06-12T10:30:00Z"
}
```

Note: `pk` and `sk` are internal DynamoDB fields not exposed in API responses.

---

## Migration Guide

### For Existing Deployments

If you have existing users created via events (old behavior), you need to backfill:

**Step 1: Export existing users from DynamoDB**
```bash
aws dynamodb scan \
  --table-name UserProfiles \
  --filter-expression "attribute_exists(pk)" \
  > existing_users.json
```

**Step 2: Add contact info via API**
```bash
# For each user, call PUT /v1/users/{id} with email/phone
curl -X PUT $API_URL/v1/users/user_123 \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"email": "user@example.com"}'
```

**Step 3: Delete users with no contact info**
```bash
# Clean up pollution
curl -X DELETE $API_URL/v1/users/invalid_user \
  -H "Authorization: Bearer $TOKEN"
```

---

## Security Considerations

### Authorization

All endpoints require JWT authentication:
```bash
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Rate Limiting

API Gateway throttling:
- Configure throttling based on expected workload, AWS account quotas, and
  controlled load-test results.
- Do not treat sample settings as a production capacity guarantee.

### Data Privacy

- User profiles stored encrypted at rest (KMS)
- Contact info masked in logs (`us***@example.com`, `+1***1234`)
- No PII in CloudWatch logs

---

## Testing

### Postman Collection

```json
{
  "info": {
    "name": "User Management API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Create User",
      "request": {
        "method": "POST",
        "header": [
          {"key": "Authorization", "value": "Bearer {{token}}"},
          {"key": "Content-Type", "value": "application/json"}
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"userId\": \"test_user\",\n  \"email\": \"test@example.com\",\n  \"phone\": \"+14155551234\",\n  \"prefs\": {\"channel\": \"EMAIL\"}\n}"
        },
        "url": {
          "raw": "{{api_url}}/v1/users",
          "host": ["{{api_url}}"],
          "path": ["v1", "users"]
        }
      }
    }
  ]
}
```

### Integration Test Script

```bash
#!/bin/bash
set -e

API_URL="https://your-api.execute-api.us-west-2.amazonaws.com"
TOKEN="your-jwt-token"

echo "1. Create user"
curl -X POST $API_URL/v1/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"test_user","email":"test@example.com"}' \
  | jq .

echo "2. Get user"
curl -X GET $API_URL/v1/users/test_user \
  -H "Authorization: Bearer $TOKEN" \
  | jq .

echo "3. Update user"
curl -X PUT $API_URL/v1/users/test_user \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+14155551234"}' \
  | jq .

echo "4. Track event"
curl -X POST $API_URL/v1/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"test_user","type":"CLICK","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' \
  | jq .

echo "5. Delete user"
curl -X DELETE $API_URL/v1/users/test_user \
  -H "Authorization: Bearer $TOKEN" \
  | jq .

echo "All tests passed!"
```

---

**Last Updated**: June 2026
