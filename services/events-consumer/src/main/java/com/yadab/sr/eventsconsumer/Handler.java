package com.yadab.sr.eventsconsumer;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.events.KinesisEvent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import software.amazon.awssdk.services.dynamodb.model.ConditionalCheckFailedException;
import software.amazon.awssdk.services.dynamodb.model.DynamoDbException;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.UpdateItemRequest;
import software.amazon.awssdk.services.lambda.LambdaClient;
import software.amazon.awssdk.services.lambda.model.InvokeRequest;
import software.amazon.awssdk.services.lambda.model.InvokeResponse;
import software.amazon.awssdk.core.SdkBytes;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;

public class Handler implements RequestHandler<KinesisEvent, Map<String, Object>> {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static final String S3_BUCKET = System.getenv("EVENTS_BUCKET");
    private static final String USER_TABLE = System.getenv("USER_TABLE");
    private static final String SENDER_FUNCTION_ARN = System.getenv("SENDER_FUNCTION_ARN");
    private static final String DECISION_FUNCTION_ARN = System.getenv("DECISION_FUNCTION_ARN");

    private static final S3Client S3 = S3Client.create();
    private static final DynamoDbClient DDB = DynamoDbClient.create();
    private static final LambdaClient LAMBDA = LambdaClient.create();

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter HOUR = DateTimeFormatter.ofPattern("HH");

    @Override
    public Map<String, Object> handleRequest(KinesisEvent event, Context ctx) {
        LambdaLogger log = ctx.getLogger();
        Map<String, List<String>> buffers = new LinkedHashMap<>();
        List<String> writtenKeys = new ArrayList<>();

        log.log("DB: " + USER_TABLE + " S3: " + S3_BUCKET);

        try {
            for (KinesisEvent.KinesisEventRecord rec : event.getRecords()) {
                ByteBuffer bb = rec.getKinesis().getData();
                String rawJson = StandardCharsets.UTF_8.decode(bb).toString();

                // Parse and re-serialize to compact JSON (single line)
                JsonNode node = MAPPER.readTree(rawJson);
                String json = MAPPER.writeValueAsString(node);

                // ts handling (fallback to now if missing)
                String ts = node.path("ts").asText(null);
                if (ts == null || ts.isBlank()) {
                    ts = node.path("timestamp").asText(Instant.now().toString());
                }
                String s3Key = s3KeyFromIso(ts);

                // buffer as JSONL line
                buffers.computeIfAbsent(s3Key, k -> new ArrayList<>()).add(json);

                // ddb counters
                String uid = node.path("userId").asText("unknown");
                String eventType = node.path("type").asText("UNKNOWN");
                ddbUpdateUser(uid, ts, eventType);

                // Auto-trigger notifications when the event includes delivery intent.
                // Preferred shape: { "notification": { "deliveryMode": "IMMEDIATE|OPTIMIZED", ... } }
                // Backward-compatible shape: top-level notificationType = "immediate|optimized".
                JsonNode notification = node.path("notification");
                String deliveryMode = deliveryMode(node, notification);
                if (deliveryMode != null && !deliveryMode.isBlank()) {
                    triggerNotification(uid, deliveryMode, node, notification, log);
                }
            }

            // flush per key as JSONL
            for (Map.Entry<String, List<String>> e : buffers.entrySet()) {
                String key = e.getKey();
                String body = String.join("\n", e.getValue()) + "\n";

                S3.putObject(
                        PutObjectRequest.builder()
                                .bucket(S3_BUCKET)
                                .key(key)
                                .contentType("application/json")
                                .build(),
                        software.amazon.awssdk.core.sync.RequestBody.fromString(body, StandardCharsets.UTF_8)
                );
                writtenKeys.add(key);
            }

            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("ok", true);
            resp.put("files", writtenKeys);
            return resp;

        } catch (Exception ex) {
            log.log("ERROR: " + ex);
            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("ok", false);
            resp.put("error", ex.toString());
            return resp;
        }
    }

    public static void ddbUpdateUser(String userId, String tsIso, String eventType) {
        if (userId == null || userId.isBlank()) userId = "unknown";
        if (tsIso == null || tsIso.isBlank()) tsIso = Instant.now().toString();
        if (eventType == null || eventType.isBlank()) eventType = "UNKNOWN";

        Map<String, AttributeValue> key = Map.of(
                "pk", AttributeValue.builder().s("USER#" + userId).build(),
                "sk", AttributeValue.builder().s("PROFILE").build()
        );

        // 1) Ensure counters map exists (create it only if it doesn't)
        Map<String, AttributeValue> ensureVals = Map.of(
                ":emptyMap", AttributeValue.builder().m(Map.of()).build()
        );

        UpdateItemRequest ensureCountersReq = UpdateItemRequest.builder()
                .tableName(USER_TABLE)
                .key(key)
                .updateExpression("SET counters = :emptyMap")
                .conditionExpression("attribute_not_exists(counters)")
                .expressionAttributeValues(ensureVals)
                .build();

        try {
            DDB.updateItem(ensureCountersReq);
            // created counters map (if it didn't exist). If it already existed, the conditional will fail.
        } catch (ConditionalCheckFailedException e) {
            // counters already exists — that's fine, proceed
        } catch (DynamoDbException e) {
            // handle unexpected errors (log/rethrow as needed)
            throw e;
        }

        // 2) Now increment appropriate counters based on event type
        // Treat PLAY_MOVIE as a "send" (user saw content, simulating notification sent)
        // Treat CLICK as a "click" (user clicked, simulating notification click)
        Map<String, AttributeValue> exprVals = Map.of(
                ":zero", AttributeValue.builder().n("0").build(),
                ":one", AttributeValue.builder().n("1").build(),
                ":ts", AttributeValue.builder().s(tsIso).build()
        );

        String updateExpression;
        if ("CLICK".equals(eventType)) {
            // Increment both events and clicks
            updateExpression = "SET counters.events = if_not_exists(counters.events, :zero) + :one, " +
                    "counters.clicks = if_not_exists(counters.clicks, :zero) + :one, lastSeenAt = :ts";
        } else if ("PLAY_MOVIE".equals(eventType)) {
            // Increment both events and sends (treat as notification sent)
            updateExpression = "SET counters.events = if_not_exists(counters.events, :zero) + :one, " +
                    "counters.sends = if_not_exists(counters.sends, :zero) + :one, lastSeenAt = :ts";
        } else {
            // Just increment events for other types
            updateExpression = "SET counters.events = if_not_exists(counters.events, :zero) + :one, lastSeenAt = :ts";
        }

        UpdateItemRequest incrementReq = UpdateItemRequest.builder()
                .tableName(USER_TABLE)
                .key(key)
                .updateExpression(updateExpression)
                .expressionAttributeValues(exprVals)
                .build();

        DDB.updateItem(incrementReq);
    }

    private static String s3KeyFromIso(String iso) {
        // Normalize to OffsetDateTime
        OffsetDateTime odt;
        if (iso.endsWith("Z")) {
            odt = OffsetDateTime.parse(iso).withOffsetSameInstant(ZoneOffset.UTC);
        } else {
            odt = OffsetDateTime.parse(
                    iso.replace(" ", "T") // lenient if space
            ).withOffsetSameInstant(ZoneOffset.UTC);
        }
        String dt = DATE.format(odt);
        String h  = HOUR.format(odt);
        return "raw/dt=%s/h=%s/events-%s.jsonl".formatted(dt, h, UUID.randomUUID());
    }

    /**
     * Auto-trigger notifications based on event metadata.
     *
     * deliveryMode values:
     * - "IMMEDIATE": Send notification right now
     * - "OPTIMIZED": Use ML + Attention Escrow to schedule at best time
     * - null/empty: No notification, analytics only
     *
     * The legacy top-level notificationType field still works for immediate/optimized,
     * but new integrations should use notification.deliveryMode.
     */
    private static void triggerNotification(
            String userId,
            String deliveryMode,
            JsonNode event,
            JsonNode notification,
            LambdaLogger log
    ) {
        try {
            if ("immediate".equalsIgnoreCase(deliveryMode)) {
                // Send notification immediately via Sender Lambda
                log.log(String.format("Triggering immediate notification for user: %s", userId));

                String payload = MAPPER.writeValueAsString(notificationPayload(userId, event, notification, false));

                InvokeRequest invokeReq = InvokeRequest.builder()
                    .functionName(SENDER_FUNCTION_ARN)
                    .payload(SdkBytes.fromUtf8String(payload))
                    .build();

                InvokeResponse response = LAMBDA.invoke(invokeReq);
                log.log("Sender invoked. Status: " + response.statusCode());

            } else if ("optimized".equalsIgnoreCase(deliveryMode)) {
                // Schedule notification via Decision Service (ML-optimized time)
                log.log(String.format("Triggering optimized notification for user: %s", userId));

                // Calculate delivery window. Category policy can narrow or widen this up to 48 hours.
                long nowEpoch = Instant.now().getEpochSecond();
                int maxDelayHours = maxDelayHours(notification, event);
                long endEpoch = nowEpoch + (maxDelayHours * 3600L);

                Map<String, Object> payloadMap = notificationPayload(userId, event, notification, true);
                payloadMap.put("windowStart", nowEpoch);
                payloadMap.put("windowEnd", endEpoch);
                payloadMap.put("schedule", true);
                String payload = MAPPER.writeValueAsString(apiGatewayPayload(payloadMap));

                InvokeRequest invokeReq = InvokeRequest.builder()
                    .functionName(DECISION_FUNCTION_ARN)
                    .payload(SdkBytes.fromUtf8String(payload))
                    .build();

                InvokeResponse response = LAMBDA.invoke(invokeReq);
                logInvokeResult("Decision service", response, log);
            }
        } catch (Exception e) {
            log.log("ERROR triggering notification: " + e.getMessage());
            // Don't fail the entire batch if notification trigger fails
        }
    }

    private static String deliveryMode(JsonNode event, JsonNode notification) {
        String mode = text(notification, "deliveryMode");
        if (mode == null || mode.isBlank()) {
            mode = text(event, "deliveryMode");
        }
        if (mode == null || mode.isBlank()) {
            mode = text(event, "notificationType");
        }
        return mode;
    }

    private static Map<String, Object> notificationPayload(
            String userId,
            JsonNode event,
            JsonNode notification,
            boolean includeAttentionFields
    ) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("userId", userId);
        putText(payload, "message", firstText(notification, event, "message"));
        putText(payload, "channel", firstText(notification, event, "channel"));

        JsonNode metadata = firstNode(notification, event, "metadata");
        if (metadata != null && metadata.isObject()) {
            payload.put("metadata", MAPPER.convertValue(metadata, Map.class));
        }

        if (includeAttentionFields) {
            putText(payload, "sourceId", firstText(notification, event, "sourceId"));
            putText(payload, "categoryId", firstText(notification, event, "categoryId"));
            putText(payload, "campaignId", firstText(notification, event, "campaignId"));
            putText(payload, "templateId", firstText(notification, event, "templateId"));
            putText(payload, "messageCategory", firstText(notification, event, "messageCategory"));
            putText(payload, "priorityClass", firstText(notification, event, "priorityClass"));
            putDouble(payload, "businessValue", firstNode(notification, event, "businessValue"));
            putDouble(payload, "urgency", firstNode(notification, event, "urgency"));
            putInt(payload, "maxDelayHours", firstNode(notification, event, "maxDelayHours"));
            putObject(payload, "categoryDefaults", firstNode(notification, event, "categoryDefaults"));
            putObject(payload, "effectivePolicy", firstNode(notification, event, "effectivePolicy"));
            putObject(payload, "policyOverrides", firstNode(notification, event, "policyOverrides"));
        }

        return payload;
    }

    private static Map<String, Object> apiGatewayPayload(Map<String, Object> body) throws Exception {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("version", "2.0");
        payload.put("routeKey", "$default");
        payload.put("rawPath", "/v1/decisions/schedule");
        payload.put("rawQueryString", "");
        payload.put("headers", Map.of("content-type", "application/json"));
        payload.put("requestContext", Map.of(
                "http", Map.of(
                        "method", "POST",
                        "path", "/v1/decisions/schedule",
                        "protocol", "HTTP/1.1",
                        "sourceIp", "events-consumer",
                        "userAgent", "events-consumer"
                )
        ));
        payload.put("isBase64Encoded", false);
        payload.put("body", MAPPER.writeValueAsString(body));
        return payload;
    }

    private static void logInvokeResult(String serviceName, InvokeResponse response, LambdaLogger log) {
        String responsePayload = response.payload() == null ? "" : response.payload().asUtf8String();
        log.log(String.format(
                "%s invoked. Status: %d FunctionError: %s Payload: %s",
                serviceName,
                response.statusCode(),
                response.functionError(),
                responsePayload
        ));
    }

    private static JsonNode firstNode(JsonNode preferred, JsonNode fallback, String field) {
        if (preferred != null && preferred.hasNonNull(field)) {
            return preferred.get(field);
        }
        if (fallback != null && fallback.hasNonNull(field)) {
            return fallback.get(field);
        }
        return null;
    }

    private static String firstText(JsonNode preferred, JsonNode fallback, String field) {
        String value = text(preferred, field);
        return value == null || value.isBlank() ? text(fallback, field) : value;
    }

    private static String text(JsonNode node, String field) {
        if (node == null || !node.hasNonNull(field)) {
            return null;
        }
        return node.get(field).asText(null);
    }

    private static void putText(Map<String, Object> payload, String field, String value) {
        if (value != null && !value.isBlank()) {
            payload.put(field, value);
        }
    }

    private static void putDouble(Map<String, Object> payload, String field, JsonNode value) {
        if (value != null && value.isNumber()) {
            payload.put(field, value.asDouble());
        }
    }

    private static void putInt(Map<String, Object> payload, String field, JsonNode value) {
        if (value != null && value.isInt()) {
            payload.put(field, value.asInt());
        }
    }

    private static void putObject(Map<String, Object> payload, String field, JsonNode value) {
        if (value != null && value.isObject()) {
            payload.put(field, MAPPER.convertValue(value, Map.class));
        }
    }

    private static int maxDelayHours(JsonNode notification, JsonNode event) {
        JsonNode value = firstNode(notification, event, "maxDelayHours");
        if (value == null || !value.isNumber()) {
            return 24;
        }
        return Math.max(1, Math.min(48, value.asInt()));
    }
}
