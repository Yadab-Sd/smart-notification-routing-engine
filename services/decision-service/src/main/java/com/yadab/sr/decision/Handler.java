package com.yadab.sr.decision;

import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPResponse;

import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.GetItemRequest;
import software.amazon.awssdk.services.dynamodb.model.GetItemResponse;
import software.amazon.awssdk.services.sagemakerruntime.SageMakerRuntimeClient;
import software.amazon.awssdk.services.sagemakerruntime.model.InvokeEndpointRequest;
import software.amazon.awssdk.services.sagemakerruntime.model.InvokeEndpointResponse;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.services.scheduler.SchedulerClient;
import software.amazon.awssdk.services.scheduler.model.CreateScheduleRequest;
import software.amazon.awssdk.services.scheduler.model.Target;
import software.amazon.awssdk.services.scheduler.model.FlexibleTimeWindow;
import software.amazon.awssdk.services.scheduler.model.FlexibleTimeWindowMode;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.time.Duration;
import java.time.ZonedDateTime;
import java.time.ZoneOffset;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;

public class Handler implements RequestHandler<APIGatewayV2HTTPEvent, APIGatewayV2HTTPResponse> {
    private final DynamoDbClient dynamo;
    private final SageMakerRuntimeClient sageMaker;
    private final SchedulerClient scheduler;
    private final String userProfilesTable;
    private final String sageMakerEndpoint;
    private final String senderFunctionArn;
    private final String schedulerRoleArn;
    private final Region region;

    public Handler() {
        Region region = Region.of(System.getenv("AWS_REGION"));  // region for all clients
        this.region = region;
        this.dynamo = DynamoDbClient.builder().region(region).build();
        this.sageMaker = SageMakerRuntimeClient.builder().region(region).build();
        this.scheduler = SchedulerClient.builder().region(region).build();
        this.userProfilesTable = System.getenv("USER_PROFILES_TABLE");      // DynamoDB table name
        this.sageMakerEndpoint = System.getenv("SENDTIME_ENDPOINT");        // SageMaker endpoint name
        this.senderFunctionArn = System.getenv("SENDER_FUNCTION_ARN");      // ARN of sender Lambda
        this.schedulerRoleArn = System.getenv("SCHEDULER_ROLE_ARN");        // IAM role ARN for EventBridge Scheduler
    }

    @Override
    public APIGatewayV2HTTPResponse handleRequest(APIGatewayV2HTTPEvent event, Context context) {
        try {
            String body = event.getBody();
            if (body == null || body.isEmpty()) {
                return APIGatewayV2HTTPResponse.builder()
                        .withStatusCode(400)
                        .withHeaders(Map.of("Content-Type", "application/json"))
                        .withBody("{\"error\":\"Empty request body\"}")
                        .build();
            }
            ObjectMapper json = new ObjectMapper();
            DecisionRequest req = json.readValue(body, DecisionRequest.class);

            // Fetch user profile from DynamoDB
            GetItemRequest getReq = GetItemRequest.builder()
                    .tableName(userProfilesTable)
                    .key(Map.of(
                            "pk", AttributeValue.builder().s("USER#" + req.getUserId()).build(),
                            "sk", AttributeValue.builder().s("PROFILE").build())
                    )
                    .build();
            GetItemResponse getResp = dynamo.getItem(getReq);
            Map<String, AttributeValue> item = getResp.item();
            if (item == null || item.isEmpty()) {
                return APIGatewayV2HTTPResponse.builder()
                        .withStatusCode(404)
                        .withHeaders(Map.of("Content-Type", "application/json"))
                        .withBody("{\"error\":\"User profile not found\"}")
                        .build();
            }

            // Iterate through the specified hour window to find the best send hour
            int bestHour = -1;
            double bestScore = -1.0;
            ObjectMapper mapper = new ObjectMapper();

            Instant startTs = Instant.ofEpochSecond(req.getWindowStart());
            Instant endTs = Instant.ofEpochSecond(req.getWindowEnd());

            int MAX_WINDOW_HOURS = 48;
            long hours = ChronoUnit.HOURS.between(startTs, endTs);
            if (hours > MAX_WINDOW_HOURS) {
                return APIGatewayV2HTTPResponse.builder()
                        .withStatusCode(400)
                        .withHeaders(Map.of("Content-Type", "application/json"))
                        .withBody("{\"error\":\"Window too large — max 48 hours\"}")
                        .build();
            }

            for (Instant ts = startTs; !ts.isAfter(endTs); ts = ts.plus(1, ChronoUnit.HOURS)) {
                int hour = ts.atZone(ZoneOffset.UTC).getHour();  // 0–23

                // Extract other features like day-of-week, recency, etc.
                int dow = ts.atZone(ZoneOffset.UTC).getDayOfWeek().getValue();
                String lastSeenAt = item.get("lastSeenAt").s();// 1=Mon to 7=Sun
                long daysSinceLastSeen = Duration.between(Instant.parse(lastSeenAt), ts).toDays();

                // CSV row for SageMaker
                String csvRow = String.format("%d,%d,%d\n", hour, dow, daysSinceLastSeen);

                context.getLogger().log("SageMaker Input: " + csvRow);
                InvokeEndpointRequest invokeReq = InvokeEndpointRequest.builder()
                        .endpointName(sageMakerEndpoint)
                        .contentType("text/csv")
//                        .body(SdkBytes.fromUtf8String(payload))
                        .body(SdkBytes.fromUtf8String(csvRow))
                        .build();
                InvokeEndpointResponse invokeRes = sageMaker.invokeEndpoint(invokeReq);

                // Parse the returned score
                String resultStr = invokeRes.body().asUtf8String();
                context.getLogger().log("Score: " + resultStr);
                double score;
                try {
                    score = Double.parseDouble(resultStr);
                } catch (NumberFormatException nfe) {
                    // If response is JSON, extract a numeric field
                    JsonNode resultJson = mapper.readTree(resultStr);
                    if (resultJson.isNumber()) {
                        score = resultJson.doubleValue();
                    } else if (resultJson.has("score")) {
                        score = resultJson.get("score").asDouble();
                    } else {
                        score = 0.0;
                    }
                }
                // Track the highest score and corresponding hour
                if (score > bestScore) {
                    bestScore = score;
                    bestHour = hour;
                }
            }

            // Prepare response object with best hour and probability
            ObjectNode responseNode = mapper.createObjectNode();
            responseNode.put("hour", bestHour);
            responseNode.put("probability", bestScore);

            // If scheduling is requested, create an EventBridge schedule for sender
            if (Boolean.TRUE.equals(req.getSchedule()) && bestHour >= 0) {
                // Determine the next execution time at the best hour (UTC today or next day)
                ZonedDateTime nowUtc = ZonedDateTime.now(ZoneOffset.UTC);
                ZonedDateTime targetTime = nowUtc.withHour(bestHour).withMinute(0).withSecond(0).withNano(0);
                if (!targetTime.isAfter(nowUtc)) {
                    targetTime = targetTime.plusDays(1);  // if time already passed today, schedule for next day
                }
                Instant runAt = targetTime.toInstant();
                String scheduleExpression = "at(" + runAt.toString() + ")";

                // Build the scheduler target and request:contentReference[oaicite:14]{index=14}:contentReference[oaicite:15]{index=15}
                // Input to sender could include necessary data (here just userId for example)
                String schedulerInput = "{\"userId\":\"" + req.getUserId() + "\"}";
                Target target = Target.builder()
                        .arn(senderFunctionArn)
                        .roleArn(schedulerRoleArn)
                        .input(schedulerInput)
                        .build();
                String scheduleName = "send-email-" + UUID.randomUUID();
                CreateScheduleRequest scheduleReq = CreateScheduleRequest.builder()
                        .name(scheduleName)
                        .scheduleExpression(scheduleExpression)
                        .flexibleTimeWindow(FlexibleTimeWindow.builder()
                                .mode(FlexibleTimeWindowMode.OFF)  // no flexibility in timing
                                .build())
                        .target(target)
//                        .actionAfterCompletion("DELETE")  // auto-delete schedule after execution
                        .build();
                scheduler.createSchedule(scheduleReq);
                responseNode.put("scheduled", true);
            }

            // Return the result as JSON response
            String responseJson = mapper.writeValueAsString(responseNode);
            return APIGatewayV2HTTPResponse.builder()
                    .withStatusCode(200)
                    .withHeaders(Map.of("Content-Type", "application/json"))
                    .withBody(responseJson)
                    .build();
        } catch (Exception e) {
            context.getLogger().log("Error in decision handler: " + e.getMessage());
            return APIGatewayV2HTTPResponse.builder()
                    .withStatusCode(500)
                    .withHeaders(Map.of("Content-Type", "application/json"))
                    .withBody("{\"error\":\"" + e.getMessage() + "\"}")
                    .build();
        }
    }

    // Helper class to model the decision request payload
    public static class DecisionRequest {
        private String userId;
        private int windowStart;
        private int windowEnd;
        private Boolean schedule;
        // Getters and setters
        public String getUserId() { return userId; }
        public void setUserId(String userId) { this.userId = userId; }
        public int getWindowStart() { return windowStart; }
        public void setWindowStart(int windowStart) { this.windowStart = windowStart; }
        public int getWindowEnd() { return windowEnd; }
        public void setWindowEnd(int windowEnd) { this.windowEnd = windowEnd; }
        public Boolean getSchedule() { return schedule; }
        public void setSchedule(Boolean schedule) { this.schedule = schedule; }
    }
}
