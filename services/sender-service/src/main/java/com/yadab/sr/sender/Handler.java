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
import software.amazon.awssdk.services.pinpoint.PinpointClient;
import software.amazon.awssdk.services.pinpoint.model.AddressConfiguration;
import software.amazon.awssdk.services.pinpoint.model.ChannelType;
import software.amazon.awssdk.services.pinpoint.model.SimpleEmailPart;
import software.amazon.awssdk.services.pinpoint.model.SimpleEmail;
import software.amazon.awssdk.services.pinpoint.model.EmailMessage;
import software.amazon.awssdk.services.pinpoint.model.DirectMessageConfiguration;
import software.amazon.awssdk.services.pinpoint.model.MessageRequest;
import software.amazon.awssdk.services.pinpoint.model.SendMessagesRequest;
import software.amazon.awssdk.services.pinpoint.model.PinpointException;

import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.Template;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Map;
import java.util.HashMap;

/**
 * Sender Lambda Handler - Supports two invocation modes:
 * 1. EventBridge Scheduler: Simple payload with just userId
 * 2. API Gateway: Full payload with template and recipient details
 */
public class Handler implements RequestHandler<Map<String, Object>, Map<String, Object>> {
    private final S3Client s3;
    private final DynamoDbClient dynamodb;
    private final PinpointClient pinpoint;
    private final Handlebars handlebars;
    private final String pinpointAppId;
    private final String userProfilesTable;
    private final String curatedBucket;
    private final String defaultFromAddress;

    public Handler() {
        Region region = Region.of(System.getenv("AWS_REGION"));
        this.s3 = S3Client.builder().region(region).build();
        this.dynamodb = DynamoDbClient.builder().region(region).build();
        this.pinpoint = PinpointClient.builder().region(region).build();
        this.handlebars = new Handlebars();
        this.pinpointAppId = System.getenv("PINPOINT_APP_ID");
        this.userProfilesTable = System.getenv("USER_PROFILES_TABLE");
        this.curatedBucket = System.getenv("CURATED_BUCKET");

        // Get sender email from environment variable (set via CDK from SENDER_EMAIL in .env)
        // Fallback to obvious placeholder if not configured
        this.defaultFromAddress = System.getenv().getOrDefault("DEFAULT_FROM_ADDRESS", "CHANGE_ME@example.com");
    }

    @Override
    public Map<String, Object> handleRequest(Map<String, Object> event, Context context) {
        context.getLogger().log("Event received: " + event);

        try {
            // Detect invocation type: EventBridge (has userId) or API Gateway (has full payload)
            if (event.containsKey("userId") && event.size() <= 2) {
                // EventBridge Scheduler invocation - simple payload
                return handleScheduledSend(event, context);
            } else {
                // API Gateway or full invocation - complete payload
                return handleDirectSend(event, context);
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
     * Handle scheduled send from EventBridge - look up user and use default template
     */
    private Map<String, Object> handleScheduledSend(Map<String, Object> event, Context context) {
        String userId = (String) event.get("userId");
        context.getLogger().log("Handling scheduled send for userId: " + userId);

        // Look up user profile from DynamoDB
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

        // Extract user email (required for notification)
        String userEmail = null;
        if (item.containsKey("email")) {
            userEmail = item.get("email").s();
        }

        if (userEmail == null || userEmail.isEmpty()) {
            throw new RuntimeException("User email not found for userId: " + userId);
        }

        context.getLogger().log("User email: " + userEmail);

        // Fetch default notification template from S3
        String templateContent;
        try {
            GetObjectRequest s3Req = GetObjectRequest.builder()
                    .bucket(curatedBucket)
                    .key("templates/default-notification.html")
                    .build();
            ResponseBytes<GetObjectResponse> s3Object = s3.getObjectAsBytes(s3Req);
            templateContent = s3Object.asUtf8String();
        } catch (NoSuchKeyException e) {
            context.getLogger().log("Default template not found, using inline template");
            // Use a simple inline template if S3 template doesn't exist
            templateContent = "<html><body><h1>Notification for {{userId}}</h1>" +
                    "<p>You have a new notification!</p>" +
                    "<p>This is an automated message from Smart Notification Routing Engine.</p></body></html>";
        }

        // Compile Handlebars template with user variables
        Template template;
        try {
            template = handlebars.compileInline(templateContent);
        } catch (Exception e) {
            throw new RuntimeException("Failed to compile template: " + e.getMessage(), e);
        }

        Map<String, String> variables = new HashMap<>();
        variables.put("userId", userId);
        variables.put("email", userEmail);

        String mergedBody;
        try {
            mergedBody = template.apply(variables);
        } catch (Exception e) {
            throw new RuntimeException("Failed to render template: " + e.getMessage(), e);
        }

        // Send email via Pinpoint
        sendEmail(userEmail, defaultFromAddress, "Notification from Smart Routing Engine", mergedBody, context);

        Map<String, Object> response = new HashMap<>();
        response.put("statusCode", 200);
        response.put("userId", userId);
        response.put("email", userEmail);
        response.put("message", "Notification sent successfully");
        return response;
    }

    /**
     * Handle direct send with full payload (API Gateway or manual invocation)
     */
    private Map<String, Object> handleDirectSend(Map<String, Object> event, Context context) {
        ObjectMapper json = new ObjectMapper();
        SendRequest req;
        try {
            req = json.convertValue(event, SendRequest.class);
        } catch (Exception e) {
            throw new RuntimeException("Invalid request format: " + e.getMessage(), e);
        }

        // Fetch template from S3
        GetObjectRequest getReq = GetObjectRequest.builder()
                .bucket(req.getTemplateBucket())
                .key(req.getTemplateKey())
                .build();
        ResponseBytes<GetObjectResponse> s3Object = s3.getObjectAsBytes(getReq);
        String templateContent = s3Object.asUtf8String();

        // Compile and apply template
        Template template;
        try {
            template = handlebars.compileInline(templateContent);
        } catch (Exception e) {
            throw new RuntimeException("Failed to compile template: " + e.getMessage(), e);
        }

        String mergedBody;
        try {
            mergedBody = template.apply(req.getVariables());
        } catch (Exception e) {
            throw new RuntimeException("Failed to render template: " + e.getMessage(), e);
        }

        // Send email
        sendEmail(req.getToAddress(), req.getFromAddress(), req.getSubject(), mergedBody, context);

        Map<String, Object> response = new HashMap<>();
        response.put("statusCode", 200);
        response.put("message", "Message sent successfully");
        return response;
    }

    /**
     * Send email via Amazon Pinpoint
     */
    private void sendEmail(String toAddress, String fromAddress, String subject, String htmlBody, Context context) {
        context.getLogger().log("Sending email to: " + toAddress);

        // Create email parts
        SimpleEmailPart htmlPart = SimpleEmailPart.builder()
                .data(htmlBody)
                .charset("UTF-8")
                .build();

        // Strip HTML for text version
        String textBody = htmlBody.replaceAll("<[^>]+>", "");
        SimpleEmailPart textPart = SimpleEmailPart.builder()
                .data(textBody)
                .charset("UTF-8")
                .build();

        SimpleEmailPart subjectPart = SimpleEmailPart.builder()
                .data(subject)
                .charset("UTF-8")
                .build();

        SimpleEmail simpleEmail = SimpleEmail.builder()
                .htmlPart(htmlPart)
                .textPart(textPart)
                .subject(subjectPart)
                .build();

        EmailMessage emailMessage = EmailMessage.builder()
                .fromAddress(fromAddress)
                .simpleEmail(simpleEmail)
                .build();

        // Configure recipient
        AddressConfiguration destConfig = AddressConfiguration.builder()
                .channelType(ChannelType.EMAIL)
                .build();
        Map<String, AddressConfiguration> addressMap = Map.of(toAddress, destConfig);

        // Build message request
        DirectMessageConfiguration directConfig = DirectMessageConfiguration.builder()
                .emailMessage(emailMessage)
                .build();
        MessageRequest msgRequest = MessageRequest.builder()
                .addresses(addressMap)
                .messageConfiguration(directConfig)
                .build();
        SendMessagesRequest sendReq = SendMessagesRequest.builder()
                .applicationId(pinpointAppId)
                .messageRequest(msgRequest)
                .build();

        // Send via Pinpoint
        try {
            pinpoint.sendMessages(sendReq);
            context.getLogger().log("Email sent successfully to: " + toAddress);
        } catch (PinpointException e) {
            context.getLogger().log("Pinpoint error: " + e.awsErrorDetails().errorMessage());
            throw new RuntimeException("Failed to send email: " + e.awsErrorDetails().errorMessage(), e);
        }
    }

    // Helper class for direct send requests
    public static class SendRequest {
        private String templateBucket;
        private String templateKey;
        private Map<String, String> variables;
        private String toAddress;
        private String subject;
        private String fromAddress;

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
        public String getFromAddress() { return fromAddress; }
        public void setFromAddress(String fromAddress) { this.fromAddress = fromAddress; }
    }
}
