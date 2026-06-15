package com.yadab.sr.sender;

import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.Context;

import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.GetItemRequest;
import software.amazon.awssdk.services.dynamodb.model.GetItemResponse;
import software.amazon.awssdk.services.sesv2.SesV2Client;
import software.amazon.awssdk.services.sns.SnsClient;

import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.Template;
import com.fasterxml.jackson.databind.ObjectMapper;

import com.yadab.sr.sender.channels.*;
import com.yadab.sr.sender.model.UserProfile;

import java.util.Map;
import java.util.HashMap;

/**
 * Multi-Channel Sender Lambda Handler (Strategy Pattern Implementation)
 *
 * Supports extensible notification channels:
 * - Email (Amazon SES v2)
 * - SMS (Amazon SNS)
 * - Future: Push, WhatsApp, etc. (add without modifying this class)
 *
 * Invocation modes:
 * 1. EventBridge Scheduler: { "userId": "...", "channel": "SMS" (optional) }
 * 2. API Gateway: Full payload with channel, template, recipient
 *
 * Channel Selection Priority:
 * 1. Explicit channel in request (highest)
 * 2. User preference from DynamoDB
 * 3. Smart fallback (EMAIL > SMS > PUSH)
 * 4. Fail if no channel available
 */
public class Handler implements RequestHandler<Map<String, Object>, Map<String, Object>> {
    private final S3Client s3;
    private final DynamoDbClient dynamodb;
    private final Handlebars handlebars;
    private final ChannelFactory channelFactory;
    private final ChannelSelector channelSelector;
    private final String userProfilesTable;
    private final String curatedBucket;

    public Handler() {
        Region region = Region.of(System.getenv("AWS_REGION"));
        this.s3 = S3Client.builder().region(region).build();
        this.dynamodb = DynamoDbClient.builder().region(region).build();
        this.handlebars = new Handlebars();
        this.userProfilesTable = System.getenv("USER_PROFILES_TABLE");
        this.curatedBucket = System.getenv("CURATED_BUCKET");

        String defaultFromAddress = System.getenv().getOrDefault("DEFAULT_FROM_ADDRESS", "CHANGE_ME@example.com");

        // Initialize channel factory and selector
        SesV2Client ses = SesV2Client.builder().region(region).build();
        SnsClient sns = SnsClient.builder().region(region).build();

        this.channelFactory = new ChannelFactory(ses, sns, defaultFromAddress);
        this.channelSelector = new ChannelSelector(channelFactory);
    }

    @Override
    public Map<String, Object> handleRequest(Map<String, Object> event, Context context) {
        context.getLogger().log("Event received: " + event);

        try {
            // Detect invocation type:
            // - handleScheduledSend: EventBridge or Events Consumer (has userId, may have message/channel/metadata)
            // - handleDirectSend: API Gateway (has templateBucket/templateKey for S3 templates)
            if (event.containsKey("templateBucket") && event.containsKey("templateKey")) {
                // API Gateway call with S3 template
                return handleDirectSend(event, context);
            } else if (event.containsKey("userId")) {
                // EventBridge or Events Consumer (scheduled or immediate notification)
                return handleScheduledSend(event, context);
            } else {
                throw new RuntimeException("Invalid event format: missing userId or template info");
            }
        } catch (Exception e) {
            context.getLogger().log("ERROR: " + e.getMessage());
            e.printStackTrace();

            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("statusCode", 500);
            errorResponse.put("error", e.getMessage());
            return errorResponse;
        }
    }

    /**
     * Handle scheduled send from EventBridge or direct Lambda invocation.
     * Looks up user profile and sends via optimal channel.
     */
    private Map<String, Object> handleScheduledSend(Map<String, Object> event, Context context) {
        String userId = (String) event.get("userId");
        String requestedChannel = (String) event.get("channel"); // Optional: explicit channel override
        String customMessage = (String) event.get("message"); // Optional: custom message from event

        context.getLogger().log("Handling scheduled send for userId: " + userId +
                (requestedChannel != null ? ", requested channel: " + requestedChannel : ""));

        // Fetch user profile from DynamoDB
        UserProfile user = fetchUserProfile(userId, context);

        // Select optimal channel with fallback logic
        ChannelSelector.ChannelSelectionResult selection = channelSelector.selectChannel(
                user, requestedChannel, context);

        NotificationChannel channel = selection.getChannel();
        String recipient = getRecipient(user, channel);

        // Extract subject from metadata if provided
        String subject = "Notification from Smart Routing Engine"; // Default
        if (event.containsKey("metadata") && event.get("metadata") instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> metadata = (Map<String, Object>) event.get("metadata");
            if (metadata.containsKey("subject")) {
                subject = (String) metadata.get("subject");
                context.getLogger().log("Using custom subject from metadata: " + subject);
            }
        }

        // Use custom message if provided, otherwise fetch template
        String renderedBody;

        if (customMessage != null && !customMessage.isEmpty()) {
            renderedBody = customMessage;
            context.getLogger().log("Using custom message from event");
        } else {
            String templateContent = fetchTemplate(context);
            renderedBody = renderTemplate(templateContent, user, context);
            context.getLogger().log("Using template-based message");
        }

        // Send via selected channel
        try {
            channel.send(recipient, subject, renderedBody, context);
        } catch (Exception e) {
            context.getLogger().log("Failed to send via " + channel.getChannelType() + ": " + e.getMessage());
            throw new RuntimeException("Notification delivery failed", e);
        }

        // Build response with metadata
        Map<String, Object> response = new HashMap<>();
        response.put("statusCode", 200);
        response.put("userId", userId);
        response.put("channelUsed", selection.getChannelType());
        response.put("fallback", selection.isFallback());
        response.put("recipient", maskContactInfo(recipient));
        response.put("message", "Notification sent successfully");

        if (selection.getRequestedChannel() != null) {
            response.put("channelRequested", selection.getRequestedChannel());
        }
        if (selection.isFallback() && selection.getReason() != null) {
            response.put("fallbackReason", selection.getReason());
        }

        return response;
    }

    /**
     * Handle direct send with full payload (API Gateway).
     */
    private Map<String, Object> handleDirectSend(Map<String, Object> event, Context context) {
        ObjectMapper json = new ObjectMapper();
        SendRequest req;
        try {
            req = json.convertValue(event, SendRequest.class);
        } catch (Exception e) {
            throw new RuntimeException("Invalid request format: " + e.getMessage(), e);
        }

        // Fetch user profile if userId provided (for channel selection)
        UserProfile user = null;
        if (req.getUserId() != null) {
            user = fetchUserProfile(req.getUserId(), context);
        } else {
            // Create minimal profile with provided contact info
            user = new UserProfile();
            user.setUserId("direct_send");
            if (req.getToAddress().contains("@")) {
                user.setEmail(req.getToAddress());
            } else if (req.getToAddress().startsWith("+")) {
                user.setPhone(req.getToAddress());
            }
        }

        // Select channel
        ChannelSelector.ChannelSelectionResult selection = channelSelector.selectChannel(
                user, req.getChannel(), context);

        NotificationChannel channel = selection.getChannel();
        String recipient = req.getToAddress() != null ? req.getToAddress() : getRecipient(user, channel);

        // Fetch and render template
        GetObjectRequest getReq = GetObjectRequest.builder()
                .bucket(req.getTemplateBucket())
                .key(req.getTemplateKey())
                .build();
        ResponseBytes<GetObjectResponse> s3Object = s3.getObjectAsBytes(getReq);
        String templateContent = s3Object.asUtf8String();

        String renderedBody = renderTemplate(templateContent, req.getVariables(), context);

        // Send via selected channel
        try {
            channel.send(recipient, req.getSubject(), renderedBody, context);
        } catch (Exception e) {
            context.getLogger().log("Failed to send via " + channel.getChannelType() + ": " + e.getMessage());
            throw new RuntimeException("Notification delivery failed", e);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("statusCode", 200);
        response.put("channelUsed", selection.getChannelType());
        response.put("fallback", selection.isFallback());
        response.put("message", "Message sent successfully");

        if (selection.isFallback()) {
            response.put("channelRequested", selection.getRequestedChannel());
            response.put("fallbackReason", selection.getReason());
        }

        return response;
    }

    /**
     * Fetch user profile from DynamoDB.
     */
    private UserProfile fetchUserProfile(String userId, Context context) {
        GetItemRequest getReq = GetItemRequest.builder()
                .tableName(userProfilesTable)
                .key(Map.of(
                        "pk", AttributeValue.builder().s("USER#" + userId).build(),
                        "sk", AttributeValue.builder().s("PROFILE").build()
                ))
                .build();

        GetItemResponse getResp = dynamodb.getItem(getReq);
        Map<String, AttributeValue> item = getResp.item();

        if (item == null || item.isEmpty()) {
            throw new RuntimeException("User profile not found for userId: " + userId);
        }

        // Parse DynamoDB item to UserProfile
        UserProfile user = new UserProfile();
        user.setUserId(userId);

        if (item.containsKey("email")) {
            user.setEmail(item.get("email").s());
        }
        if (item.containsKey("phone")) {
            user.setPhone(item.get("phone").s());
        }
        if (item.containsKey("prefs") && item.get("prefs").hasM()) {
            Map<String, AttributeValue> prefsMap = item.get("prefs").m();
            UserProfile.UserPreferences prefs = new UserProfile.UserPreferences();
            if (prefsMap.containsKey("channel")) {
                prefs.setChannel(prefsMap.get("channel").s());
            }
            user.setPrefs(prefs);
        }

        context.getLogger().log("Fetched user profile: " + user);
        return user;
    }

    /**
     * Fetch default template from S3 or use inline fallback.
     */
    private String fetchTemplate(Context context) {
        try {
            GetObjectRequest s3Req = GetObjectRequest.builder()
                    .bucket(curatedBucket)
                    .key("templates/default-notification.html")
                    .build();
            ResponseBytes<GetObjectResponse> s3Object = s3.getObjectAsBytes(s3Req);
            return s3Object.asUtf8String();
        } catch (NoSuchKeyException e) {
            context.getLogger().log("Default template not found, using inline template");
            return "<html><body><h1>Notification for {{userId}}</h1>" +
                    "<p>You have a new notification!</p>" +
                    "<p>This is an automated message from Smart Notification Routing Engine.</p></body></html>";
        }
    }

    /**
     * Render Handlebars template with user data.
     */
    private String renderTemplate(String templateContent, UserProfile user, Context context) {
        Map<String, String> variables = new HashMap<>();
        variables.put("userId", user.getUserId());
        variables.put("email", user.getEmail());
        variables.put("phone", user.getPhone());
        return renderTemplate(templateContent, variables, context);
    }

    /**
     * Render Handlebars template with provided variables.
     */
    private String renderTemplate(String templateContent, Map<String, String> variables, Context context) {
        try {
            Template template = handlebars.compileInline(templateContent);
            return template.apply(variables);
        } catch (Exception e) {
            throw new RuntimeException("Failed to render template: " + e.getMessage(), e);
        }
    }

    /**
     * Get recipient address based on channel type.
     */
    private String getRecipient(UserProfile user, NotificationChannel channel) {
        String requiredField = channel.getRequiredField();
        if ("email".equals(requiredField)) {
            return user.getEmail();
        } else if ("phone".equals(requiredField)) {
            return user.getPhone();
        }
        throw new IllegalStateException("Unknown channel type: " + channel.getChannelType());
    }

    /**
     * Mask contact info for logging (privacy).
     */
    private String maskContactInfo(String contact) {
        if (contact == null) return null;
        if (contact.contains("@")) {
            // Email: show first 2 chars + domain
            String[] parts = contact.split("@");
            return parts[0].substring(0, Math.min(2, parts[0].length())) + "***@" + parts[1];
        } else if (contact.startsWith("+")) {
            // Phone: show country code + last 4 digits
            return contact.substring(0, 2) + "***" + contact.substring(contact.length() - 4);
        }
        return contact;
    }

    /**
     * Request model for direct send API.
     */
    public static class SendRequest {
        private String userId;
        private String templateBucket;
        private String templateKey;
        private Map<String, String> variables;
        private String toAddress;
        private String subject;
        private String channel;
        private String message;  // Custom message from event (for immediate/optimized notifications)
        private String metadata; // Event metadata (stored as JSON string)

        public String getUserId() { return userId; }
        public void setUserId(String userId) { this.userId = userId; }
        public String getTemplateBucket() { return templateBucket; }
        public void setTemplateBucket(String templateBucket) { this.templateBucket = templateBucket; }
        public String getTemplateKey() { return templateKey; }
        public void setTemplateKey(String templateKey) { this.templateKey = templateKey; }
        public Map<String, String> getVariables() { return variables; }
        public void setVariables(Map<String, String> variables) { this.variables = variables; }
        public String getToAddress() { return toAddress; }
        public void setToAddress(String toAddress) { this.toAddress = toAddress; }
        public String getSubject() { return subject; }
        public void setSubject(String subject) { this.subject = subject; }
        public String getChannel() { return channel; }
        public void setChannel(String channel) { this.channel = channel; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
        public String getMetadata() { return metadata; }
        public void setMetadata(String metadata) { this.metadata = metadata; }
    }
}
