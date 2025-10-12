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

    private static final S3Client S3 = S3Client.create();
    private static final DynamoDbClient DDB = DynamoDbClient.create();

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
                String json = StandardCharsets.UTF_8.decode(bb).toString();

                JsonNode node = MAPPER.readTree(json);

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
                ddbUpdateUser(uid, ts);
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

    public static void ddbUpdateUser(String userId, String tsIso) {
        if (userId == null || userId.isBlank()) userId = "unknown";
        if (tsIso == null || tsIso.isBlank()) tsIso = Instant.now().toString();

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

        // 2) Now increment counters.events and set lastSeenAt
        Map<String, AttributeValue> exprVals = Map.of(
                ":zero", AttributeValue.builder().n("0").build(),
                ":one", AttributeValue.builder().n("1").build(),
                ":ts", AttributeValue.builder().s(tsIso).build()
        );

        UpdateItemRequest incrementReq = UpdateItemRequest.builder()
                .tableName(USER_TABLE)
                .key(key)
                .updateExpression("SET counters.events = if_not_exists(counters.events, :zero) + :one, lastSeenAt = :ts")
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
}
