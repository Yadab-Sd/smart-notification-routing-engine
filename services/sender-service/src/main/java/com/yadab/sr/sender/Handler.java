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

// SES v2 for email
import software.amazon.awssdk.services.sesv2.SesV2Client;
import software.amazon.awssdk.services.sesv2.model.SendEmailRequest;
import software.amazon.awssdk.services.sesv2.model.EmailContent;
import software.amazon.awssdk.services.sesv2.model.Body;
import software.amazon.awssdk.services.sesv2.model.Content;
import software.amazon.awssdk.services.sesv2.model.Message;
import software.amazon.awssdk.services.sesv2.model.Destination;
import software.amazon.awssdk.services.sesv2.model.SesV2Exception;

// SNS for SMS
import software.amazon.awssdk.services.sns.SnsClient;
import software.amazon.awssdk.services.sns.model.PublishRequest;
import software.amazon.awssdk.services.sns.model.PublishResponse;
import software.amazon.awssdk.services.sns.model.SnsException;

import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.Template;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Map;
import java.util.HashMap;

/**
 * Multi-Channel Sender Lambda Handler
 * Supports: Email (Amazon SES v2) and SMS (Amazon SNS)
 *
 * Invocation modes:
 * 1. EventBridge Scheduler: Simple payload with userId, looks up user preferences
 * 2. API Gateway: Full payload with channel, template, and recipient details
 */
public class Handler implements RequestHandler<Map<String, Object>, Map<String, Object>> {
    private final S3Client s3;
    private final DynamoDbClient dynamodb;
    private final SesV2Client ses;
    private final SnsClient sns;
    private final Handlebars handlebars;
    private final String userProfilesTable;
    private final String curatedBucket;
    private final String defaultFromAddress;

    // Channel types
    private static final String CHANNEL_EMAIL = "EMAIL";
    private static final String CHANNEL_SMS = "SMS";

    public Handler() {
        Region region = Region.of(System.getenv("AWS_REGION"));
        this.s3 = S3Client.builder().region(region).build();
        this.dynamodb = DynamoDbClient.builder().region(region).build();
        this.ses = SesV2Client.builder().region(region).build();
        this.sns = SnsClient.builder().region(region).build();
        this.handlebars = new Handlebars();
        this.userProfilesTable = System.getenv("USER_PROFILES_TABLE");
        this.curatedBucket = System.getenv("CURATED_BUCKET");

        // Sender email from environment (set via CDK from SENDER_EMAIL in .env)
        this.defaultFromAddress = System.getenv().getOrDefault("DEFAULT_FROM_ADDRESS", "CHANGE_ME@example.com");
    }

    @Override
    public Map<String, Object> handleRequest(Map<String, Object> event, Context context) {
        context.getLogger().log("Event received: " + event);

        try {
            // Detect invocation type
            if (event.containsKey("userId") && event.size() <= 2) {
                // EventBridge Scheduler invocation
                return handleScheduledSend(event, context);
            } else {
                // API Gateway or full invocation
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
     * Handle scheduled send from EventBridge - look up user and send via preferred channel
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

        // Extract user contact details
        String userEmail = item.containsKey("email") ? item.get("email").s() : null;
        String userPhone = item.containsKey("phone") ? item.get("phone").s() : null;

        // Determine preferred channel (default to EMAIL if not specified)
        String preferredChannel = CHANNEL_EMAIL;
        if (item.containsKey("prefs")) {
            Map<String, AttributeValue> prefs = item.get("prefs").m();
            if (prefs.containsKey("channel")) {
                preferredChannel = prefs.get("channel").s();
            }
        }

        context.getLogger().log("User email: " + userEmail + ", phone: " + userPhone + ", preferred channel: " + preferredChannel);

        // Validate contact info for chosen channel
        if (CHANNEL_EMAIL.equals(preferredChannel) && (userEmail == null || userEmail.isEmpty())) {
            throw new RuntimeException("User email not found but EMAIL channel selected for userId: " + userId);
        }
        if (CHANNEL_SMS.equals(preferredChannel) && (userPhone == null || userPhone.isEmpty())) {
            throw new RuntimeException("User phone not found but SMS channel selected for userId: " + userId);
        }

        // Fetch default notification template from S3
        String templateContent = fetchTemplate(context);

        // Compile Handlebars template
        Template template;
        try {
            template = handlebars.compileInline(templateContent);
        } catch (Exception e) {
            throw new RuntimeException("Failed to compile template: " + e.getMessage(), e);
        }

        Map<String, String> variables = new HashMap<>();
        variables.put("userId", userId);
        variables.put("email", userEmail);
        variables.put("phone", userPhone);

        String mergedBody;
        try {
            mergedBody = template.apply(variables);
        } catch (Exception e) {
            throw new RuntimeException("Failed to render template: " + e.getMessage(), e);
        }

        // Send via preferred channel
        Map<String, Object> response = new HashMap<>();
        response.put("statusCode", 200);
        response.put("userId", userId);
        response.put("channel", preferredChannel);

        if (CHANNEL_EMAIL.equals(preferredChannel)) {
            sendEmailViaSES(userEmail, defaultFromAddress, "Notification from Smart Routing Engine", mergedBody, context);
            response.put("email", userEmail);
            response.put("message", "Email sent successfully");
        } else if (CHANNEL_SMS.equals(preferredChannel)) {
            // Strip HTML for SMS (plain text only)
            String smsBody = mergedBody.replaceAll("<[^>]+>", "").trim();
            sendSMSViaSNS(userPhone, smsBody, context);
            response.put("phone", userPhone);
            response.put("message", "SMS sent successfully");
        }

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

        // Send via specified channel
        String channel = req.getChannel() != null ? req.getChannel() : CHANNEL_EMAIL;

        if (CHANNEL_EMAIL.equals(channel)) {
            sendEmailViaSES(req.getToAddress(), req.getFromAddress(), req.getSubject(), mergedBody, context);
        } else if (CHANNEL_SMS.equals(channel)) {
            String smsBody = mergedBody.replaceAll("<[^>]+>", "").trim();
            sendSMSViaSNS(req.getToAddress(), smsBody, context);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("statusCode", 200);
        response.put("channel", channel);
        response.put("message", "Message sent successfully via " + channel);
        return response;
    }

    /**
     * Fetch default template from S3 or use inline fallback
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
     * Send email via Amazon SES v2
     */
    private void sendEmailViaSES(String toAddress, String fromAddress, String subject, String htmlBody, Context context) {
        context.getLogger().log("Sending email to: " + toAddress + " via SES");

        try {
            // Strip HTML for text version
            String textBody = htmlBody.replaceAll("<[^>]+>", "");

            Content subjectContent = Content.builder()
                    .data(subject)
                    .charset("UTF-8")
                    .build();

            Content htmlContent = Content.builder()
                    .data(htmlBody)
                    .charset("UTF-8")
                    .build();

            Content textContent = Content.builder()
                    .data(textBody)
                    .charset("UTF-8")
                    .build();

            Body body = Body.builder()
                    .html(htmlContent)
                    .text(textContent)
                    .build();

            Message message = Message.builder()
                    .subject(subjectContent)
                    .body(body)
                    .build();

            Destination destination = Destination.builder()
                    .toAddresses(toAddress)
                    .build();

            EmailContent emailContent = EmailContent.builder()
                    .simple(message)
                    .build();

            SendEmailRequest emailRequest = SendEmailRequest.builder()
                    .fromEmailAddress(fromAddress)
                    .destination(destination)
                    .content(emailContent)
                    .build();

            ses.sendEmail(emailRequest);
            context.getLogger().log("Email sent successfully to: " + toAddress);

        } catch (SesV2Exception e) {
            context.getLogger().log("SES error: " + e.awsErrorDetails().errorMessage());
            throw new RuntimeException("Failed to send email via SES: " + e.awsErrorDetails().errorMessage(), e);
        }
    }

    /**
     * Send SMS via Amazon SNS
     */
    private void sendSMSViaSNS(String phoneNumber, String message, Context context) {
        context.getLogger().log("Sending SMS to: " + phoneNumber + " via SNS");

        try {
            // Truncate message if too long (SNS limit: 160 chars for single SMS)
            String smsMessage = message.length() > 160 ? message.substring(0, 157) + "..." : message;

            PublishRequest request = PublishRequest.builder()
                    .message(smsMessage)
                    .phoneNumber(phoneNumber)
                    .build();

            PublishResponse result = sns.publish(request);
            context.getLogger().log("SMS sent successfully. MessageId: " + result.messageId());

        } catch (SnsException e) {
            context.getLogger().log("SNS error: " + e.awsErrorDetails().errorMessage());
            throw new RuntimeException("Failed to send SMS via SNS: " + e.awsErrorDetails().errorMessage(), e);
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
        private String channel; // "EMAIL" or "SMS"

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
        public String getChannel() { return channel; }
        public void setChannel(String channel) { this.channel = channel; }
    }
}
