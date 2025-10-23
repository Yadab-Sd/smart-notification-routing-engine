package com.yadab.sr.sender;

import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPResponse;

import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
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

public class Handler implements RequestHandler<APIGatewayV2HTTPEvent, APIGatewayV2HTTPResponse> {
    private final S3Client s3;
    private final PinpointClient pinpoint;
    private final Handlebars handlebars;
    private final String pinpointAppId;

    public Handler() {
        // Initialize AWS SDK clients and Handlebars engine
        Region region = Region.of(System.getenv("AWS_REGION"));  // use Lambda's region
        this.s3 = S3Client.builder().region(region).build();
        this.pinpoint = PinpointClient.builder().region(region).build();
        this.handlebars = new Handlebars();
        this.pinpointAppId = System.getenv("PINPOINT_APP_ID");  // Pinpoint Application ID from env
    }

    @Override
    public APIGatewayV2HTTPResponse handleRequest(APIGatewayV2HTTPEvent event, Context context) {
        try {
            String body = event.getBody();
            if (body == null || body.isEmpty()) {
                // Return 400 if request body is missing
                return APIGatewayV2HTTPResponse.builder()
                        .withStatusCode(400)
                        .withHeaders(Map.of("Content-Type", "application/json"))
                        .withBody("{\"error\":\"Empty request body\"}")
                        .build();
            }
            ObjectMapper json = new ObjectMapper();
            SendRequest req = json.readValue(body, SendRequest.class);

            // Fetch the Handlebars template content from S3:contentReference[oaicite:5]{index=5}
            GetObjectRequest getReq = GetObjectRequest.builder()
                    .bucket(req.getTemplateBucket())
                    .key(req.getTemplateKey())
                    .build();
            ResponseBytes<GetObjectResponse> s3Object = s3.getObjectAsBytes(getReq);
            String templateContent = s3Object.asUtf8String();

            // Compile and apply the Handlebars template with variables:contentReference[oaicite:6]{index=6}
            Template template = handlebars.compileInline(templateContent);
            String mergedBody = template.apply(req.getVariables());  // merged email HTML content

            // Create Pinpoint email message parts (HTML, text, subject):contentReference[oaicite:7]{index=7}
            SimpleEmailPart htmlPart = SimpleEmailPart.builder()
                    .data(mergedBody)
                    .charset("UTF-8")
                    .build();
            // Derive a plain-text body by stripping HTML tags (simple approach)
            String textBody = mergedBody.replaceAll("<[^>]+>", "");
            SimpleEmailPart textPart = SimpleEmailPart.builder()
                    .data(textBody)
                    .charset("UTF-8")
                    .build();
            SimpleEmailPart subjectPart = SimpleEmailPart.builder()
                    .data(req.getSubject())
                    .charset("UTF-8")
                    .build();

            SimpleEmail simpleEmail = SimpleEmail.builder()
                    .htmlPart(htmlPart)
                    .textPart(textPart)
                    .subject(subjectPart)
                    .build();
            EmailMessage emailMessage = EmailMessage.builder()
                    .fromAddress(req.getFromAddress())
                    .simpleEmail(simpleEmail)
                    .build();

            // Set up the address (recipient) and channel type:contentReference[oaicite:8]{index=8}
            AddressConfiguration destConfig = AddressConfiguration.builder()
                    .channelType(ChannelType.EMAIL)
                    .build();
            Map<String, AddressConfiguration> addressMap = Map.of(req.getToAddress(), destConfig);

            // Build the Pinpoint MessageRequest and SendMessagesRequest
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

            // Send the email through Amazon Pinpoint
            pinpoint.sendMessages(sendReq);

            // Return success response:contentReference[oaicite:9]{index=9}
            return APIGatewayV2HTTPResponse.builder()
                    .withStatusCode(200)
                    .withHeaders(Map.of("Content-Type", "application/json"))
                    .withBody("{\"status\":\"Message sent successfully\"}")
                    .build();
        } catch (PinpointException e) {
            // Amazon Pinpoint service error
            context.getLogger().log("Pinpoint error: " + e.awsErrorDetails().errorMessage());
            return APIGatewayV2HTTPResponse.builder()
                    .withStatusCode(502)  // Bad Gateway / service error
                    .withHeaders(Map.of("Content-Type", "application/json"))
                    .withBody("{\"error\":\"Failed to send message: " + e.awsErrorDetails().errorMessage() + "\"}")
                    .build();
        } catch (Exception e) {
            // General error handling
            context.getLogger().log("Unhandled error in sender handler: " + e.getMessage());
            return APIGatewayV2HTTPResponse.builder()
                    .withStatusCode(500)
                    .withHeaders(Map.of("Content-Type", "application/json"))
                    .withBody("{\"error\":\"" + e.getMessage() + "\"}")
                    .build();
        }
    }

    // Helper class to model the request payload for the sender Lambda
    public static class SendRequest {
        private String templateBucket;
        private String templateKey;
        private Map<String, String> variables;
        private String toAddress;
        private String subject;
        private String fromAddress;
        // Getters and setters (for JSON deserialization)
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