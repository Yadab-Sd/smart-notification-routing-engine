package com.yadab.sr.sesevent;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.SNSEvent;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.*;

import java.time.Instant;
import java.util.*;

/**
 * SES Bounce and Complaint Handler
 *
 * Processes SNS notifications from AWS SES when:
 * - Bounce: Email address doesn't exist or mailbox full
 * - Complaint: Recipient marked email as spam
 *
 * Actions:
 * - Add email to suppression list (DynamoDB)
 * - Update user profile with bounce/complaint reason
 * - Log event for compliance and analytics
 *
 * AWS SES Production Access Requirement:
 * This handler must be active before SES approves production access.
 */
public class Handler implements RequestHandler<SNSEvent, Map<String, Object>> {
    private static final DynamoDbClient ddb = DynamoDbClient.create();
    private static final ObjectMapper mapper = new ObjectMapper();

    private static final String SUPPRESSION_TABLE = System.getenv("SUPPRESSION_TABLE");
    private static final String USER_PROFILES_TABLE = System.getenv("USER_PROFILES_TABLE");

    @Override
    public Map<String, Object> handleRequest(SNSEvent event, Context context) {
        int processedBounces = 0;
        int processedComplaints = 0;
        List<String> errors = new ArrayList<>();

        for (SNSEvent.SNSRecord record : event.getRecords()) {
            try {
                String message = record.getSNS().getMessage();
                JsonNode sesEvent = mapper.readTree(message);

                String eventType = sesEvent.get("eventType").asText();
                context.getLogger().log("Processing SES event: " + eventType);

                if ("Bounce".equals(eventType)) {
                    processBounce(sesEvent, context);
                    processedBounces++;
                } else if ("Complaint".equals(eventType)) {
                    processComplaint(sesEvent, context);
                    processedComplaints++;
                } else {
                    context.getLogger().log("Ignoring event type: " + eventType);
                }

            } catch (Exception e) {
                String errorMsg = "Error processing SES event: " + e.getMessage();
                context.getLogger().log(errorMsg);
                errors.add(errorMsg);
            }
        }

        // Return summary
        Map<String, Object> result = new HashMap<>();
        result.put("processedBounces", processedBounces);
        result.put("processedComplaints", processedComplaints);
        result.put("errors", errors);
        result.put("success", errors.isEmpty());

        context.getLogger().log(String.format(
            "Processed %d bounces, %d complaints. Errors: %d",
            processedBounces, processedComplaints, errors.size()
        ));

        return result;
    }

    /**
     * Process bounce notification
     *
     * Bounce types:
     * - Permanent (Hard): Email doesn't exist - SUPPRESS IMMEDIATELY
     * - Transient (Soft): Temporary issue (mailbox full) - SUPPRESS after 3 attempts
     * - Undetermined: Unknown - treat as soft
     */
    private void processBounce(JsonNode sesEvent, Context context) throws Exception {
        JsonNode bounce = sesEvent.get("bounce");
        String bounceType = bounce.get("bounceType").asText();
        String bounceSubType = bounce.has("bounceSubType") ? bounce.get("bounceSubType").asText() : "Unknown";
        Instant timestamp = Instant.parse(bounce.get("timestamp").asText());

        JsonNode bouncedRecipients = bounce.get("bouncedRecipients");

        for (JsonNode recipient : bouncedRecipients) {
            String email = recipient.get("emailAddress").asText().toLowerCase();
            String diagnosticCode = recipient.has("diagnosticCode") ?
                recipient.get("diagnosticCode").asText() : "No diagnostic info";

            context.getLogger().log(String.format(
                "Bounce: %s - Type: %s/%s - Reason: %s",
                email, bounceType, bounceSubType, diagnosticCode
            ));

            // Determine if should suppress
            boolean shouldSuppress = false;
            String suppressionReason = null;

            if ("Permanent".equals(bounceType)) {
                // Hard bounce - email doesn't exist or permanently rejected
                shouldSuppress = true;
                suppressionReason = String.format("Hard bounce: %s - %s", bounceSubType, diagnosticCode);

            } else if ("Transient".equals(bounceType)) {
                // Soft bounce - check if this is 3rd+ attempt
                int bounceCount = incrementBounceCount(email);

                if (bounceCount >= 3) {
                    shouldSuppress = true;
                    suppressionReason = String.format("Repeated soft bounces (%d times): %s", bounceCount, diagnosticCode);
                } else {
                    context.getLogger().log(String.format(
                        "Soft bounce for %s (count: %d/3). Not suppressing yet.",
                        email, bounceCount
                    ));
                }
            }

            if (shouldSuppress) {
                addToSuppressionList(email, "BOUNCE", suppressionReason, timestamp, context);
                updateUserProfile(email, "BOUNCED", suppressionReason, context);
            }

            // Log bounce event (for compliance and analytics)
            logBounceEvent(email, bounceType, bounceSubType, diagnosticCode, timestamp);
        }
    }

    /**
     * Process complaint notification (spam report)
     *
     * When recipient clicks "Report Spam" or "Mark as Junk"
     * - ALWAYS suppress immediately (CAN-SPAM Act requirement)
     * - Update user profile
     * - Log for compliance
     */
    private void processComplaint(JsonNode sesEvent, Context context) throws Exception {
        JsonNode complaint = sesEvent.get("complaint");
        Instant timestamp = Instant.parse(complaint.get("timestamp").asText());
        String complaintFeedbackType = complaint.has("complaintFeedbackType") ?
            complaint.get("complaintFeedbackType").asText() : "not-spam"; // Default if not provided

        JsonNode complainedRecipients = complaint.get("complainedRecipients");

        for (JsonNode recipient : complainedRecipients) {
            String email = recipient.get("emailAddress").asText().toLowerCase();

            context.getLogger().log(String.format(
                "COMPLAINT: %s reported as spam (type: %s)",
                email, complaintFeedbackType
            ));

            // ALWAYS suppress on complaint (legal requirement)
            String suppressionReason = String.format("Spam complaint: %s", complaintFeedbackType);
            addToSuppressionList(email, "COMPLAINT", suppressionReason, timestamp, context);
            updateUserProfile(email, "COMPLAINED", suppressionReason, context);

            // Log complaint (CAN-SPAM compliance)
            logComplaintEvent(email, complaintFeedbackType, timestamp);
        }
    }

    /**
     * Add email to suppression list
     */
    private void addToSuppressionList(String email, String reason, String details, Instant timestamp, Context context) {
        Map<String, AttributeValue> item = new HashMap<>();
        item.put("email", AttributeValue.builder().s(email).build());
        item.put("reason", AttributeValue.builder().s(reason).build());
        item.put("details", AttributeValue.builder().s(details).build());
        item.put("suppressedAt", AttributeValue.builder().s(timestamp.toString()).build());
        item.put("ttl", AttributeValue.builder().n(String.valueOf(
            timestamp.getEpochSecond() + (365 * 24 * 3600) // Expire after 1 year
        )).build());

        PutItemRequest putReq = PutItemRequest.builder()
            .tableName(SUPPRESSION_TABLE)
            .item(item)
            .build();

        ddb.putItem(putReq);

        context.getLogger().log(String.format(
            "✓ Added %s to suppression list: %s",
            email, reason
        ));
    }

    /**
     * Update user profile with bounce/complaint status
     */
    private void updateUserProfile(String email, String status, String reason, Context context) {
        // Find user by email
        ScanRequest scanReq = ScanRequest.builder()
            .tableName(USER_PROFILES_TABLE)
            .filterExpression("email = :email")
            .expressionAttributeValues(Map.of(
                ":email", AttributeValue.builder().s(email).build()
            ))
            .limit(1)
            .build();

        ScanResponse scanResp = ddb.scan(scanReq);

        if (scanResp.items().isEmpty()) {
            context.getLogger().log("User not found for email: " + email);
            return;
        }

        Map<String, AttributeValue> userItem = scanResp.items().get(0);
        String pk = userItem.get("pk").s();
        String sk = userItem.get("sk").s();

        // Update user profile with email status
        UpdateItemRequest updateReq = UpdateItemRequest.builder()
            .tableName(USER_PROFILES_TABLE)
            .key(Map.of(
                "pk", AttributeValue.builder().s(pk).build(),
                "sk", AttributeValue.builder().s(sk).build()
            ))
            .updateExpression("SET emailStatus = :status, emailStatusReason = :reason, emailStatusUpdatedAt = :ts")
            .expressionAttributeValues(Map.of(
                ":status", AttributeValue.builder().s(status).build(),
                ":reason", AttributeValue.builder().s(reason).build(),
                ":ts", AttributeValue.builder().s(Instant.now().toString()).build()
            ))
            .build();

        ddb.updateItem(updateReq);

        context.getLogger().log(String.format(
            "✓ Updated user profile for %s: %s",
            email, status
        ));
    }

    /**
     * Track soft bounce count to suppress after 3 attempts
     */
    private int incrementBounceCount(String email) {
        UpdateItemRequest updateReq = UpdateItemRequest.builder()
            .tableName(SUPPRESSION_TABLE)
            .key(Map.of(
                "email", AttributeValue.builder().s(email).build()
            ))
            .updateExpression("ADD softBounceCount :one SET lastBounceAt = :ts")
            .expressionAttributeValues(Map.of(
                ":one", AttributeValue.builder().n("1").build(),
                ":ts", AttributeValue.builder().s(Instant.now().toString()).build()
            ))
            .returnValues(ReturnValue.UPDATED_NEW)
            .build();

        UpdateItemResponse response = ddb.updateItem(updateReq);

        if (response.attributes().containsKey("softBounceCount")) {
            return Integer.parseInt(response.attributes().get("softBounceCount").n());
        }

        return 1; // First bounce
    }

    /**
     * Log bounce event for compliance and analytics
     */
    private void logBounceEvent(String email, String bounceType, String bounceSubType, String diagnosticCode, Instant timestamp) {
        // Store in DynamoDB for audit trail
        Map<String, AttributeValue> item = new HashMap<>();
        item.put("email", AttributeValue.builder().s(email).build());
        item.put("eventType", AttributeValue.builder().s("BOUNCE").build());
        item.put("bounceType", AttributeValue.builder().s(bounceType).build());
        item.put("bounceSubType", AttributeValue.builder().s(bounceSubType).build());
        item.put("diagnosticCode", AttributeValue.builder().s(diagnosticCode).build());
        item.put("timestamp", AttributeValue.builder().s(timestamp.toString()).build());
        item.put("ttl", AttributeValue.builder().n(String.valueOf(
            timestamp.getEpochSecond() + (90 * 24 * 3600) // Keep logs for 90 days
        )).build());

        PutItemRequest putReq = PutItemRequest.builder()
            .tableName(System.getenv("SES_EVENTS_TABLE"))
            .item(item)
            .build();

        ddb.putItem(putReq);
    }

    /**
     * Log complaint event for CAN-SPAM compliance
     */
    private void logComplaintEvent(String email, String complaintType, Instant timestamp) {
        Map<String, AttributeValue> item = new HashMap<>();
        item.put("email", AttributeValue.builder().s(email).build());
        item.put("eventType", AttributeValue.builder().s("COMPLAINT").build());
        item.put("complaintType", AttributeValue.builder().s(complaintType).build());
        item.put("timestamp", AttributeValue.builder().s(timestamp.toString()).build());
        item.put("ttl", AttributeValue.builder().n(String.valueOf(
            timestamp.getEpochSecond() + (365 * 24 * 3600) // Keep complaint logs for 1 year (legal requirement)
        )).build());

        PutItemRequest putReq = PutItemRequest.builder()
            .tableName(System.getenv("SES_EVENTS_TABLE"))
            .item(item)
            .build();

        ddb.putItem(putReq);
    }
}
