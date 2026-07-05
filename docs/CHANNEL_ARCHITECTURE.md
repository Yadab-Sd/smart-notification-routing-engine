# Channel Architecture (Strategy Pattern)

## Design Principles

This implementation follows **SOLID principles**, specifically:

1. **Open-Close Principle**: Open for extension, closed for modification
   - New channels can be added without changing existing code
   - Just implement `NotificationChannel` interface and register in factory

2. **Single Responsibility**: Each class has one job
   - `NotificationChannel`: Defines channel contract
   - `EmailChannel`, `SmsChannel`: Implement specific channels
   - `ChannelFactory`: Creates and manages channels
   - `ChannelSelector`: Selects optimal channel with fallback
   - `Handler`: Orchestrates the workflow

3. **Strategy Pattern**: Channels are interchangeable strategies
   - Client code doesn't care which channel is used
   - Selection logic is separate from delivery logic

---

## Class Diagram

```
┌─────────────────────────────┐
│   NotificationChannel       │ (Interface)
│  ─────────────────────────  │
│  + getChannelType()         │
│  + canSend(user)            │
│  + getRequiredField()       │
│  + send(...)                │
│  + getCostPerMessage()      │
└──────────▲──────────────────┘
           │
           │ implements
           │
    ┌──────┴──────┬──────────────┐
    │             │              │
┌───┴────┐   ┌───┴────┐    ┌───┴────┐
│ Email  │   │  SMS   │    │  Push  │ (Future)
│Channel │   │Channel │    │Channel │
└────────┘   └────────┘    └────────┘

┌─────────────────────────────┐
│     ChannelFactory          │
│  ─────────────────────────  │
│  - channels: Map            │
│  + getChannel(type)         │
│  + getAllChannels()         │
└─────────────────────────────┘

┌─────────────────────────────┐
│     ChannelSelector         │
│  ─────────────────────────  │
│  - factory: ChannelFactory  │
│  + selectChannel(...)       │
└─────────────────────────────┘

┌─────────────────────────────┐
│         Handler             │
│  ─────────────────────────  │
│  - factory                  │
│  - selector                 │
│  + handleRequest()          │
└─────────────────────────────┘
```

---

## Channel Selection Flow

```
1. API Request arrives
   └─> { userId: "123", channel: "SMS" }

2. Handler calls ChannelSelector
   └─> selectChannel(user, "SMS", context)

3. ChannelSelector tries in order:
   ├─> Requested channel ("SMS")
   │   ├─> Check: factory.getChannel("SMS")
   │   ├─> Check: smsChannel.canSend(user)
   │   └─> ✅ User has phone → Use SMS
   │
   ├─> User preference (if request failed)
   │   └─> Check: user.prefs.channel
   │
   ├─> Fallback priority (if both failed)
   │   ├─> Try EMAIL
   │   ├─> Try SMS
   │   └─> Try PUSH
   │
   └─> ❌ Fail if no channel available

4. Return ChannelSelectionResult
   └─> { channel: SmsChannel, fallback: false }

5. Handler invokes channel
   └─> smsChannel.send("+14155551234", "subject", "body")
```

---

## Decision Matrix

All scenarios from your requirements:

| # | Requested | User Pref | Email | Phone | Selected | Fallback | Reason |
|---|-----------|-----------|-------|-------|----------|----------|--------|
| 1 | SMS | EMAIL | ✅ | ✅ | **SMS** | ❌ | Explicit request honored |
| 2 | SMS | EMAIL | ✅ | ❌ | **EMAIL** | ✅ | Phone missing, fallback |
| 3 | None | EMAIL | ✅ | ✅ | **EMAIL** | ❌ | User preference used |
| 4 | None | SMS | ✅ | ❌ | **EMAIL** | ✅ | Phone missing, fallback |
| 5 | None | None | ✅ | ✅ | **EMAIL** | ❌ | Default priority |
| 6 | None | None | ❌ | ✅ | **SMS** | ❌ | Only option available |
| 7 | None | None | ❌ | ❌ | **ERROR** | N/A | No contact info |
| 8 | EMAIL | SMS | ❌ | ✅ | **SMS** | ✅ | Email missing, fallback |
| 9 | PUSH | EMAIL | ✅ | ❌ | **EMAIL** | ✅ | Push not implemented |

**Key takeaway**: System never silently drops notifications. Always tries fallback or fails explicitly.

---

## API Examples

### Scenario 1: Explicit Channel Override

**Request**:
```bash
POST /v1/events
{
  "userId": "user_123",
  "type": "SEND",
  "channel": "SMS"  // Explicit override
}
```

**User Profile**:
```json
{
  "userId": "user_123",
  "email": "user@example.com",
  "phone": "+14155551234",
  "prefs": {
    "channel": "EMAIL"  // User prefers email
  }
}
```

**Response**:
```json
{
  "statusCode": 200,
  "userId": "user_123",
  "channelUsed": "SMS",
  "fallback": false,
  "recipient": "+1***1234",
  "message": "Notification sent successfully"
}
```

**Log Output**:
```
Using requested channel: SMS
Sending SMS to: +14155551234 via SNS
SMS sent successfully. MessageId: abc123
```

---

### Scenario 2: Missing Contact Info - Graceful Fallback

**Request**:
```bash
POST /v1/events
{
  "userId": "user_456",
  "channel": "SMS"
}
```

**User Profile**:
```json
{
  "userId": "user_456",
  "email": "user@example.com",
  "phone": null  // No phone number!
}
```

**Response**:
```json
{
  "statusCode": 200,
  "userId": "user_456",
  "channelUsed": "EMAIL",
  "channelRequested": "SMS",
  "fallback": true,
  "fallbackReason": "Requested channel unavailable: missing phone",
  "recipient": "us***@example.com",
  "message": "Notification sent successfully"
}
```

**Log Output**:
```
WARNING: Requested channel SMS unavailable. User missing phone. Trying fallback...
Using fallback channel: EMAIL (requested: SMS, preferred: null)
Sending email to: user@example.com via SES
Email sent successfully
```

---

### Scenario 3: No Channel Specified - Use Preference

**Request**:
```bash
POST /v1/events
{
  "userId": "user_789"
  // No channel specified
}
```

**User Profile**:
```json
{
  "userId": "user_789",
  "email": "user@example.com",
  "phone": "+14155551234",
  "prefs": {
    "channel": "SMS"  // User prefers SMS
  }
}
```

**Response**:
```json
{
  "statusCode": 200,
  "userId": "user_789",
  "channelUsed": "SMS",
  "fallback": false,
  "recipient": "+1***1234",
  "message": "Notification sent successfully"
}
```

**Log Output**:
```
Using user preferred channel: SMS
Sending SMS to: +14155551234 via SNS
SMS sent successfully. MessageId: xyz789
```

---

### Scenario 4: No Contact Info - Error

**Request**:
```bash
POST /v1/events
{
  "userId": "user_000"
}
```

**User Profile**:
```json
{
  "userId": "user_000",
  "email": null,
  "phone": null  // No contact info!
}
```

**Response**:
```json
{
  "statusCode": 500,
  "error": "No valid notification channel available for user user_000. Missing contact information for all channels. Requested: null, Preferred: null"
}
```

**Log Output**:
```
ERROR: No valid channel available for user user_000
```

---

## Adding New Channels

### Example: Push Notifications

**Step 1**: Create channel class

```java
// services/sender-service/src/main/java/com/yadab/sr/sender/channels/PushChannel.java
package com.yadab.sr.sender.channels;

import com.amazonaws.services.lambda.runtime.Context;
import com.yadab.sr.sender.model.UserProfile;

public class PushChannel implements NotificationChannel {
    private final FcmClient fcm; // Firebase Cloud Messaging
    
    public PushChannel(FcmClient fcm) {
        this.fcm = fcm;
    }
    
    @Override
    public String getChannelType() {
        return "PUSH";
    }
    
    @Override
    public boolean canSend(UserProfile user) {
        return user.getDeviceToken() != null && !user.getDeviceToken().isEmpty();
    }
    
    @Override
    public String getRequiredField() {
        return "deviceToken";
    }
    
    @Override
    public void send(String recipient, String subject, String body, Context context) {
        // FCM implementation
        fcm.send(recipient, subject, body);
    }
    
    @Override
    public double getCostPerMessage() {
        return 0.0; // FCM is free
    }
}
```

**Step 2**: Register in factory

```java
// services/sender-service/src/main/java/com/yadab/sr/sender/channels/ChannelFactory.java
public ChannelFactory(SesV2Client ses, SnsClient sns, FcmClient fcm, String defaultFromAddress) {
    this.channels = new HashMap<>();
    
    channels.put("EMAIL", new EmailChannel(ses, defaultFromAddress));
    channels.put("SMS", new SmsChannel(sns));
    channels.put("PUSH", new PushChannel(fcm));  // <-- Add here
}
```

**Step 3**: Update UserProfile model

```java
// Add deviceToken field
private String deviceToken;

public String getDeviceToken() { return deviceToken; }
public void setDeviceToken(String deviceToken) { this.deviceToken = deviceToken; }
```

**Done!** No changes to Handler, ChannelSelector, or any other code.

---

### Example: WhatsApp via Twilio

```java
public class WhatsAppChannel implements NotificationChannel {
    private final TwilioClient twilio;
    
    public WhatsAppChannel(TwilioClient twilio) {
        this.twilio = twilio;
    }
    
    @Override
    public String getChannelType() {
        return "WHATSAPP";
    }
    
    @Override
    public boolean canSend(UserProfile user) {
        return user.getPhone() != null && user.getPhone().startsWith("+");
    }
    
    @Override
    public String getRequiredField() {
        return "phone";
    }
    
    @Override
    public void send(String recipient, String subject, String body, Context context) {
        twilio.sendWhatsApp(recipient, body);
    }
    
    @Override
    public double getCostPerMessage() {
        return 0.005; // Twilio WhatsApp cost
    }
}
```

Register in factory:
```java
channels.put("WHATSAPP", new WhatsAppChannel(twilioClient));
```

Update priority order:
```java
this.channelPriorityOrder = Arrays.asList("EMAIL", "SMS", "WHATSAPP", "PUSH");
```

---

## Testing

### Unit Test: Channel Selection

```java
@Test
public void testChannelFallback() {
    // User with only email
    UserProfile user = new UserProfile();
    user.setEmail("test@example.com");
    user.setPhone(null);
    
    // Request SMS (unavailable)
    ChannelSelectionResult result = selector.selectChannel(user, "SMS", context);
    
    // Should fallback to EMAIL
    assertEquals("EMAIL", result.getChannelType());
    assertTrue(result.isFallback());
    assertEquals("SMS", result.getRequestedChannel());
}

@Test
public void testNoContactInfo() {
    // User with no contact info
    UserProfile user = new UserProfile();
    user.setEmail(null);
    user.setPhone(null);
    
    // Should throw exception
    assertThrows(IllegalStateException.class, () -> {
        selector.selectChannel(user, null, context);
    });
}
```

### Integration Test: End-to-End

```bash
# Test 1: Explicit channel override
curl -X POST $API_URL/v1/events \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"userId": "test_user", "channel": "SMS"}'

# Expected: SMS sent (if phone exists) or fallback to email

# Test 2: User preference
curl -X POST $API_URL/v1/events \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"userId": "test_user"}'

# Expected: Uses user.prefs.channel from DynamoDB

# Test 3: No channel, no preference
curl -X POST $API_URL/v1/events \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"userId": "new_user"}'

# Expected: Falls back to EMAIL (default priority)
```

---

## Monitoring

### CloudWatch Metrics

**Custom Metrics** (to be added):
```java
// In Handler.java after successful send
cloudWatch.putMetricData(
    "NotificationsSent",
    1.0,
    Map.of(
        "Channel", channel.getChannelType(),
        "Fallback", String.valueOf(selection.isFallback())
    )
);
```

**Queries**:
```sql
-- Fallback rate by channel
SELECT 
    Channel,
    SUM(CASE WHEN Fallback = 'true' THEN 1 ELSE 0 END) / COUNT(*) as FallbackRate
FROM NotificationsSent
GROUP BY Channel

-- Cost per day by channel
SELECT 
    Channel,
    COUNT(*) * getCostPerMessage() as TotalCost
FROM NotificationsSent
GROUP BY Channel
```

---

## Benefits of This Architecture

### ✅ Extensibility (Open-Close Principle)
- Add WhatsApp: Create `WhatsAppChannel.java`, register in factory → Done
- Add Slack: Create `SlackChannel.java`, register in factory → Done
- **Zero modifications** to existing code

### ✅ Testability
- Each channel can be unit tested independently
- Mock `NotificationChannel` for Handler tests
- Selector logic testable without real AWS services

### ✅ Maintainability
- Each class has single responsibility
- Changes to SMS logic don't affect Email
- Clear separation of concerns

### ✅ Flexibility
- Easy to change fallback priority order
- Easy to add channel-specific logic (rate limiting, retry)
- Easy to disable channels (remove from factory)

### ✅ Implementation Ready
- Graceful degradation (never silent failure)
- Detailed logging for debugging
- Fallback metadata in response

---

## Migration from Old Code

If you have existing deployments:

**Old code** (tightly coupled):
```java
if (channel.equals("EMAIL")) {
    sendEmailViaSES(...);
} else if (channel.equals("SMS")) {
    sendSMSViaSNS(...);
}
```

**New code** (strategy pattern):
```java
NotificationChannel channel = factory.getChannel(channelType);
channel.send(...);
```

**Migration steps**:
1. Deploy new code (old Pinpoint code removed)
2. Update user profiles to include `prefs.channel`
3. Test with pilot users
4. Gradually migrate all users

**No breaking changes** - API contract remains the same.

---

**Last Updated**: June 2026
