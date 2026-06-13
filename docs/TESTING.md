# Testing Guide

## Quick Test Script

```bash
#!/bin/bash
set -e

# Configuration
API_URL="https://your-api-id.execute-api.us-west-2.amazonaws.com"
TOKEN="your-jwt-token"  # Get from Cognito

echo "=== Smart Notification Router Test Suite ==="

# Test 1: Health Check
echo -e "\n[1/6] Health Check"
curl -s $API_URL/v1/health | jq .

# Test 2: Create User
echo -e "\n[2/6] Create User"
curl -s -X POST $API_URL/v1/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user_'$(date +%s)'",
    "email": "test@example.com",
    "phone": "+14155551234",
    "prefs": {"channel": "EMAIL"}
  }' | jq .

USER_ID=$(echo $RESPONSE | jq -r '.userId')

# Test 3: Get User
echo -e "\n[3/6] Get User"
curl -s $API_URL/v1/users/$USER_ID \
  -H "Authorization: Bearer $TOKEN" | jq .

# Test 4: Track Event
echo -e "\n[4/6] Track Event"
curl -s -X POST $API_URL/v1/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "'$USER_ID'",
    "type": "CLICK",
    "ts": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }' | jq .

# Test 5: Update User
echo -e "\n[5/6] Update User"
curl -s -X PUT $API_URL/v1/users/$USER_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prefs": {"channel": "SMS"}}' | jq .

# Test 6: Delete User
echo -e "\n[6/6] Delete User"
curl -s -X DELETE $API_URL/v1/users/$USER_ID \
  -H "Authorization: Bearer $TOKEN" | jq .

echo -e "\n=== All Tests Passed ==="
```

---

## Unit Tests

### Java Lambda Tests

**Location**: `services/*/src/test/java/`

**Run tests**:
```bash
cd services/control-plane
mvn test
```

**Example test**:
```java
@Test
public void testUserCreation() {
    User user = new User();
    user.setUserId("test_123");
    user.setEmail("test@example.com");
    
    assertTrue(user.hasContactInfo());
}
```

---

## Integration Tests

### End-to-End Workflow

```bash
# 1. Create user
RESPONSE=$(curl -X POST $API_URL/v1/users \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"userId":"e2e_test","email":"test@example.com"}')

# 2. Verify user created
curl $API_URL/v1/users/e2e_test \
  -H "Authorization: Bearer $TOKEN" | jq .email

# 3. Track 10 events
for i in {1..10}; do
  curl -X POST $API_URL/v1/events \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"userId":"e2e_test","type":"CLICK","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}'
  sleep 1
done

# 4. Schedule notification
curl -X POST $API_URL/v1/decisions/schedule \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"userId":"e2e_test","windowStart":1718186400,"windowEnd":1718272800}'
```

---

## Load Testing

### Apache Bench

```bash
# 100 requests, 10 concurrent
ab -n 100 -c 10 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -p event.json \
  $API_URL/v1/events
```

**event.json**:
```json
{
  "userId": "load_test_user",
  "type": "CLICK",
  "ts": "2026-06-12T10:30:00Z"
}
```

---

## Monitoring Tests

### CloudWatch Logs

```bash
# Tail Lambda logs
aws logs tail /aws/lambda/SR-Compute-ControlPlaneFn --follow

# Search for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/SR-Compute-ControlPlaneFn \
  --filter-pattern "ERROR"
```

---

## Channel-Specific Tests

### Email (SES)

```bash
# Test email delivery
curl -X POST $API_URL/v1/users \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "userId": "email_test",
    "email": "verified@example.com",
    "prefs": {"channel": "EMAIL"}
  }'

curl -X POST $API_URL/v1/decisions/schedule \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"userId":"email_test","windowStart":1718186400,"windowEnd":1718186460}'

# Check inbox for email
```

### SMS (SNS)

```bash
# Test SMS delivery
curl -X POST $API_URL/v1/users \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "userId": "sms_test",
    "phone": "+14155551234",
    "prefs": {"channel": "SMS"}
  }'

curl -X POST $API_URL/v1/decisions/schedule \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"userId":"sms_test","windowStart":1718186400,"windowEnd":1718186460}'

# Check phone for SMS
```

---

## Error Testing

### Invalid Phone Format

```bash
# Should return 400
curl -X POST $API_URL/v1/users \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"userId":"bad_phone","phone":"4155551234"}'
```

### Non-existent User Event

```bash
# Should return 404
curl -X POST $API_URL/v1/events \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"userId":"fake_user","type":"CLICK"}'
```

---

**Last Updated**: June 2026
