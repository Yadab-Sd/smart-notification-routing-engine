package com.yadab.sr.decision;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.GetItemRequest;
import software.amazon.awssdk.services.dynamodb.model.GetItemResponse;
import software.amazon.awssdk.services.dynamodb.model.PutItemRequest;
import software.amazon.awssdk.services.dynamodb.model.QueryRequest;
import software.amazon.awssdk.services.dynamodb.model.QueryResponse;
import software.amazon.awssdk.services.dynamodb.model.ScanRequest;
import software.amazon.awssdk.services.dynamodb.model.ScanResponse;
import software.amazon.awssdk.services.sagemakerruntime.SageMakerRuntimeClient;
import software.amazon.awssdk.services.sagemakerruntime.model.InvokeEndpointRequest;
import software.amazon.awssdk.services.sagemakerruntime.model.InvokeEndpointResponse;
import software.amazon.awssdk.services.scheduler.SchedulerClient;
import software.amazon.awssdk.services.scheduler.model.CreateScheduleRequest;
import software.amazon.awssdk.services.scheduler.model.FlexibleTimeWindow;
import software.amazon.awssdk.services.scheduler.model.FlexibleTimeWindowMode;
import software.amazon.awssdk.services.scheduler.model.Target;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Decision Lambda.
 *
 * Stage 1: existing SageMaker send-time model finds the best hour.
 * Stage 2: Attention Escrow gate decides whether that message deserves to spend attention now.
 */
public class Handler implements RequestHandler<APIGatewayV2HTTPEvent, APIGatewayV2HTTPResponse> {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final int MAX_WINDOW_HOURS = 48;

    private final DynamoDbClient dynamo;
    private final SageMakerRuntimeClient sageMaker;
    private final SchedulerClient scheduler;
    private final String userProfilesTable;
    private final String attentionTable;
    private final String sageMakerEndpoint;
    private final String senderFunctionArn;
    private final String schedulerRoleArn;

    public Handler() {
        Region region = Region.of(System.getenv("AWS_REGION"));
        this.dynamo = DynamoDbClient.builder().region(region).build();
        this.sageMaker = SageMakerRuntimeClient.builder().region(region).build();
        this.scheduler = SchedulerClient.builder().region(region).build();
        this.userProfilesTable = System.getenv("USER_PROFILES_TABLE");
        this.attentionTable = System.getenv("ATTENTION_TABLE");
        this.sageMakerEndpoint = System.getenv("SENDTIME_ENDPOINT");
        this.senderFunctionArn = System.getenv("SENDER_FUNCTION_ARN");
        this.schedulerRoleArn = System.getenv("SCHEDULER_ROLE_ARN");
    }

    @Override
    public APIGatewayV2HTTPResponse handleRequest(APIGatewayV2HTTPEvent event, Context context) {
        try {
            if (isAttentionSummaryRequest(event)) {
                return attentionSummary(event);
            }

            if (event.getBody() == null || event.getBody().isBlank()) {
                return response(400, "{\"error\":\"Empty request body\"}");
            }

            DecisionRequest req = MAPPER.readValue(event.getBody(), DecisionRequest.class);
            String validationError = validate(req);
            if (validationError != null) {
                return response(400, "{\"error\":\"" + validationError + "\"}");
            }

            Map<String, AttributeValue> userItem = fetchUser(req.getUserId());
            if (userItem == null || userItem.isEmpty()) {
                return response(404, "{\"error\":\"User profile not found\"}");
            }

            UserStats stats = extractStats(userItem);
            context.getLogger().log(String.format(
                    "User stats - Events: %d, Clicks: %d, Sends: %d, Click Rate: %.3f",
                    stats.totalEvents, stats.totalClicks, stats.totalSends, stats.clickRate()
            ));

            SendTimeResult sendTime = findBestSendTime(req, stats, context);
            AttentionDecision attention = evaluateAttention(req, stats, sendTime, context);
            String decisionId = recordAttentionDecision(req, stats, sendTime, attention, context);

            ObjectNode responseNode = MAPPER.createObjectNode();
            responseNode.put("userId", req.getUserId());
            responseNode.put("hour", sendTime.bestHour);
            responseNode.put("probability", round(sendTime.bestScore));
            responseNode.put("sendNowHour", sendTime.sendNowHour);
            responseNode.put("sendNowProbability", round(sendTime.sendNowScore));
            responseNode.put("recommendedSendTime", recommendedSendTime(sendTime.bestHour));
            responseNode.put("attentionDecision", attention.decision);
            responseNode.put("attentionCost", round(attention.cost));
            responseNode.put("attentionValue", round(attention.value));
            responseNode.put("attentionMargin", round(attention.margin));
            responseNode.put("attentionReason", attention.reason);
            responseNode.put("fatigueScore", round(attention.fatigueScore));
            responseNode.put("sourceTrustScore", round(attention.sourceTrustScore));
            responseNode.put("sourceId", attention.sourceId);
            responseNode.put("decisionId", decisionId);
            responseNode.put("scheduled", false);

            if (Boolean.TRUE.equals(req.getSchedule())) {
                if (!"SEND".equals(attention.decision)) {
                    responseNode.put("scheduleSkippedReason", attention.reason);
                } else if (sendTime.bestHour >= 0) {
                    ScheduleResult schedule = scheduleSend(req, sendTime, decisionId, attention);
                    responseNode.put("scheduled", true);
                    responseNode.put("scheduleId", schedule.scheduleName);
                    responseNode.put("scheduledTime", schedule.scheduledTime);
                }
            }

            return response(200, MAPPER.writeValueAsString(responseNode));
        } catch (Exception e) {
            context.getLogger().log("Error in decision handler: " + e.getMessage());
            e.printStackTrace();
            return response(500, "{\"error\":\"" + safeMessage(e.getMessage()) + "\"}");
        }
    }

    private boolean isAttentionSummaryRequest(APIGatewayV2HTTPEvent event) {
        String method = event.getRequestContext() != null && event.getRequestContext().getHttp() != null
                ? event.getRequestContext().getHttp().getMethod()
                : "";
        return "GET".equalsIgnoreCase(method) && "/v1/attention/summary".equals(event.getRawPath());
    }

    private APIGatewayV2HTTPResponse attentionSummary(APIGatewayV2HTTPEvent event) throws Exception {
        if (attentionTable == null || attentionTable.isBlank()) {
            return response(500, "{\"error\":\"ATTENTION_TABLE is not configured\"}");
        }

        Map<String, String> query = event.getQueryStringParameters() == null
                ? Map.of()
                : event.getQueryStringParameters();
        String sourceId = trimToNull(query.get("sourceId"));
        String userId = trimToNull(query.get("userId"));
        int limit = parseLimit(query.get("limit"), 200);

        List<Map<String, AttributeValue>> items = fetchAttentionDecisionItems(sourceId, userId, limit);
        SummaryStats stats = summarize(items);

        ObjectNode body = MAPPER.createObjectNode();
        ObjectNode scope = body.putObject("scope");
        scope.put("sourceId", sourceId == null ? "ALL" : sourceId);
        scope.put("userId", userId == null ? "ALL" : userId);
        scope.put("limit", limit);

        body.put("totalDecisions", stats.total);
        body.put("sendDecisions", stats.sendCount);
        body.put("deferredDecisions", stats.deferCount);
        body.put("sendRate", round(stats.rate(stats.sendCount)));
        body.put("deferRate", round(stats.rate(stats.deferCount)));
        body.put("avgAttentionCost", round(stats.avg(stats.costSum)));
        body.put("avgAttentionValue", round(stats.avg(stats.valueSum)));
        body.put("avgFatigueScore", round(stats.avg(stats.fatigueSum)));
        body.put("avgSourceTrustScore", round(stats.avg(stats.trustSum)));
        body.put("attentionProtected", stats.deferCount);
        body.put("estimatedAttentionSaved", round(stats.deferredCostSum));
        body.put("recommendation", stats.recommendation());

        ArrayNode sources = body.putArray("topSources");
        stats.sourceCounts.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .limit(5)
                .forEach(entry -> {
                    ObjectNode node = sources.addObject();
                    node.put("sourceId", entry.getKey());
                    node.put("decisions", entry.getValue());
                });

        ArrayNode recent = body.putArray("recentDecisions");
        items.stream()
                .sorted(Comparator.comparing(item -> stringAttr(item, "createdAt"), Comparator.reverseOrder()))
                .limit(50)
                .forEach(item -> recent.add(decisionNode(item)));

        return response(200, MAPPER.writeValueAsString(body));
    }

    private List<Map<String, AttributeValue>> fetchAttentionDecisionItems(String sourceId, String userId, int limit) {
        Map<String, AttributeValue> values = new HashMap<>();
        values.put(":decision", AttributeValue.builder().s("ATTENTION_DECISION").build());

        if (userId != null) {
            values.put(":pk", AttributeValue.builder().s("USER#" + userId).build());
            QueryResponse response = dynamo.query(QueryRequest.builder()
                    .tableName(attentionTable)
                    .keyConditionExpression("pk = :pk")
                    .filterExpression("recordType = :decision")
                    .expressionAttributeValues(values)
                    .scanIndexForward(false)
                    .limit(limit)
                    .build());
            return response.items();
        }

        if (sourceId != null) {
            values.put(":sourceId", AttributeValue.builder().s(sourceId).build());
            QueryResponse response = dynamo.query(QueryRequest.builder()
                    .tableName(attentionTable)
                    .indexName("source-index")
                    .keyConditionExpression("sourceId = :sourceId")
                    .filterExpression("recordType = :decision")
                    .expressionAttributeValues(values)
                    .scanIndexForward(false)
                    .limit(limit)
                    .build());
            return response.items();
        }

        ScanResponse response = dynamo.scan(ScanRequest.builder()
                .tableName(attentionTable)
                .filterExpression("recordType = :decision")
                .expressionAttributeValues(values)
                .limit(limit)
                .build());
        return response.items();
    }

    private SummaryStats summarize(List<Map<String, AttributeValue>> items) {
        SummaryStats stats = new SummaryStats();
        for (Map<String, AttributeValue> item : items) {
            stats.total++;
            String decision = stringAttr(item, "attentionDecision");
            if ("SEND".equals(decision)) {
                stats.sendCount++;
            } else if ("DEFER".equals(decision)) {
                stats.deferCount++;
                stats.deferredCostSum += numberAttr(item, "attentionCost");
            }
            stats.costSum += numberAttr(item, "attentionCost");
            stats.valueSum += numberAttr(item, "attentionValue");
            stats.fatigueSum += numberAttr(item, "fatigueScore");
            stats.trustSum += numberAttr(item, "sourceTrustScore");

            String sourceId = stringAttr(item, "sourceId");
            if (sourceId != null && !sourceId.isBlank()) {
                stats.sourceCounts.merge(sourceId, 1, Integer::sum);
            }
        }
        return stats;
    }

    private ObjectNode decisionNode(Map<String, AttributeValue> item) {
        ObjectNode node = MAPPER.createObjectNode();
        putString(node, "decisionId", item, "decisionId");
        putString(node, "userId", item, "userId");
        putString(node, "sourceId", item, "sourceId");
        putString(node, "channel", item, "channel");
        putString(node, "messageCategory", item, "messageCategory");
        putString(node, "priorityClass", item, "priorityClass");
        putString(node, "attentionDecision", item, "attentionDecision");
        putString(node, "reason", item, "reason");
        putString(node, "createdAt", item, "createdAt");
        putNumber(node, "attentionCost", item, "attentionCost");
        putNumber(node, "attentionValue", item, "attentionValue");
        putNumber(node, "fatigueScore", item, "fatigueScore");
        putNumber(node, "sourceTrustScore", item, "sourceTrustScore");
        return node;
    }

    private String validate(DecisionRequest req) {
        if (req.getUserId() == null || req.getUserId().isBlank()) {
            return "userId is required";
        }
        if (req.getWindowStart() <= 0 || req.getWindowEnd() <= 0) {
            return "windowStart and windowEnd must be Unix epoch seconds";
        }
        if (req.getWindowEnd() <= req.getWindowStart()) {
            return "windowEnd must be after windowStart";
        }
        long hours = ChronoUnit.HOURS.between(
                Instant.ofEpochSecond(req.getWindowStart()),
                Instant.ofEpochSecond(req.getWindowEnd())
        );
        if (hours > MAX_WINDOW_HOURS) {
            return "Window too large - max 48 hours";
        }
        return null;
    }

    private Map<String, AttributeValue> fetchUser(String userId) {
        GetItemResponse response = dynamo.getItem(GetItemRequest.builder()
                .tableName(userProfilesTable)
                .key(Map.of(
                        "pk", AttributeValue.builder().s("USER#" + userId).build(),
                        "sk", AttributeValue.builder().s("PROFILE").build()
                ))
                .build());
        return response.item();
    }

    private UserStats extractStats(Map<String, AttributeValue> item) {
        UserStats stats = new UserStats();
        if (item.containsKey("counters") && item.get("counters").hasM()) {
            Map<String, AttributeValue> counters = item.get("counters").m();
            stats.totalEvents = number(counters.get("events"));
            stats.totalClicks = number(counters.get("clicks"));
            stats.totalSends = number(counters.get("sends"));
        }
        return stats;
    }

    private SendTimeResult findBestSendTime(DecisionRequest req, UserStats stats, Context context) throws Exception {
        Instant startTs = Instant.ofEpochSecond(req.getWindowStart());
        Instant endTs = Instant.ofEpochSecond(req.getWindowEnd());

        int sendNowHour = startTs.atZone(ZoneOffset.UTC).getHour();
        double sendNowScore = 0.0;
        boolean sendNowCaptured = false;
        int bestHour = -1;
        double bestScore = -1.0;

        for (Instant ts = startTs; !ts.isAfter(endTs); ts = ts.plus(1, ChronoUnit.HOURS)) {
            int hour = ts.atZone(ZoneOffset.UTC).getHour();
            int sendsCountHour = Math.max(0, stats.totalSends / 24);
            String csvRow = String.format("%d,%.4f,%d", hour, stats.clickRate(), sendsCountHour);

            context.getLogger().log("SageMaker Input: " + csvRow);
            InvokeEndpointResponse invokeRes = sageMaker.invokeEndpoint(InvokeEndpointRequest.builder()
                    .endpointName(sageMakerEndpoint)
                    .contentType("text/csv")
                    .body(SdkBytes.fromUtf8String(csvRow))
                    .build());

            double score = parseScore(invokeRes.body().asUtf8String());
            context.getLogger().log("Score: " + score);

            if (!sendNowCaptured) {
                sendNowScore = score;
                sendNowCaptured = true;
            }

            if (score > bestScore) {
                bestScore = score;
                bestHour = hour;
            }
        }

        return new SendTimeResult(bestHour, Math.max(0.0, bestScore), sendNowHour, Math.max(0.0, sendNowScore));
    }

    private double parseScore(String resultStr) throws Exception {
        try {
            return Double.parseDouble(resultStr.trim());
        } catch (NumberFormatException nfe) {
            JsonNode resultJson = MAPPER.readTree(resultStr);
            if (resultJson.isNumber()) {
                return resultJson.doubleValue();
            }
            if (resultJson.has("score")) {
                return resultJson.get("score").asDouble();
            }
            return 0.0;
        }
    }

    private AttentionDecision evaluateAttention(
            DecisionRequest req,
            UserStats stats,
            SendTimeResult sendTime,
            Context context
    ) {
        PriorityClass priority = PriorityClass.from(req.getPriorityClass());
        MessageCategory messageCategory = messageCategory(req);
        Channel channel = Channel.from(req.getChannel());
        String sourceId = sourceId(req);
        double sourceTrust = fetchSourceTrust(req.getUserId(), sourceId, context);

        double fatigueScore = fatigueScore(stats);
        double channelCost = channelCost(channel);
        double priorityUrgency = priorityUrgency(priority, req.getUrgency());
        double businessValue = clamp(req.getBusinessValue() == null ? 1.0 : req.getBusinessValue(), 0.0, 10.0) / 10.0;

        double cost = 1.0
                + (fatigueScore * 3.0)
                + ((1.0 - sourceTrust) * 2.0)
                + channelCost
                + categoryPenalty(messageCategory);

        double value = (sendTime.bestScore * 6.0)
                + (priorityUrgency * 2.0)
                + (businessValue * 2.0)
                + priorityBoost(priority);

        double margin = safetyMargin(priority, messageCategory);
        DecisionOutcome decision;
        String reason;

        if (isBypassPriority(priority)) {
            decision = DecisionOutcome.SEND;
            reason = "Priority class bypasses attention budget";
        } else if (value >= cost + margin) {
            decision = DecisionOutcome.SEND;
            reason = "Predicted value exceeds attention cost";
        } else if (messageCategory == MessageCategory.MARKETING || messageCategory == MessageCategory.PROMOTION) {
            decision = DecisionOutcome.DEFER;
            reason = "Marketing message deferred because attention cost is higher than value";
        } else {
            decision = DecisionOutcome.DEFER;
            reason = "Attention cost is higher than predicted value";
        }

        return new AttentionDecision(decision.name(), cost, value, margin, reason, fatigueScore, sourceTrust, sourceId);
    }

    private double fetchSourceTrust(String userId, String sourceId, Context context) {
        if (attentionTable == null || attentionTable.isBlank()) {
            return 0.75;
        }
        try {
            GetItemResponse response = dynamo.getItem(GetItemRequest.builder()
                    .tableName(attentionTable)
                    .key(Map.of(
                            "pk", AttributeValue.builder().s("USER#" + userId).build(),
                            "sk", AttributeValue.builder().s("SOURCE#" + sourceId).build()
                    ))
                    .build());
            if (response.hasItem() && response.item().containsKey("trustScore")) {
                return clamp(Double.parseDouble(response.item().get("trustScore").n()), 0.0, 1.0);
            }
        } catch (Exception e) {
            context.getLogger().log("Could not read source trust score: " + e.getMessage());
        }
        return 0.75;
    }

    private String recordAttentionDecision(
            DecisionRequest req,
            UserStats stats,
            SendTimeResult sendTime,
            AttentionDecision attention,
            Context context
    ) {
        String decisionId = "attn_" + UUID.randomUUID();
        if (attentionTable == null || attentionTable.isBlank()) {
            return decisionId;
        }

        try {
            String now = Instant.now().toString();
            Map<String, AttributeValue> item = new HashMap<>();
            item.put("pk", AttributeValue.builder().s("USER#" + req.getUserId()).build());
            item.put("sk", AttributeValue.builder().s("DECISION#" + decisionId).build());
            item.put("decisionId", AttributeValue.builder().s(decisionId).build());
            item.put("recordType", AttributeValue.builder().s("ATTENTION_DECISION").build());
            item.put("userId", AttributeValue.builder().s(req.getUserId()).build());
            item.put("sourceId", AttributeValue.builder().s(attention.sourceId).build());
            item.put("attentionDecision", AttributeValue.builder().s(attention.decision).build());
            item.put("attentionCost", AttributeValue.builder().n(String.format("%.4f", attention.cost)).build());
            item.put("attentionValue", AttributeValue.builder().n(String.format("%.4f", attention.value)).build());
            item.put("attentionMargin", AttributeValue.builder().n(String.format("%.4f", attention.margin)).build());
            item.put("fatigueScore", AttributeValue.builder().n(String.format("%.4f", attention.fatigueScore)).build());
            item.put("sourceTrustScore", AttributeValue.builder().n(String.format("%.4f", attention.sourceTrustScore)).build());
            item.put("bestHour", AttributeValue.builder().n(String.valueOf(sendTime.bestHour)).build());
            item.put("probability", AttributeValue.builder().n(String.format("%.4f", sendTime.bestScore)).build());
            item.put("scheduleRequested", AttributeValue.builder().bool(Boolean.TRUE.equals(req.getSchedule())).build());
            item.put("createdAt", AttributeValue.builder().s(now).build());
            item.put("windowStart", AttributeValue.builder().n(String.valueOf(req.getWindowStart())).build());
            item.put("windowEnd", AttributeValue.builder().n(String.valueOf(req.getWindowEnd())).build());
            item.put("totalEvents", AttributeValue.builder().n(String.valueOf(stats.totalEvents)).build());
            item.put("totalClicks", AttributeValue.builder().n(String.valueOf(stats.totalClicks)).build());
            item.put("totalSends", AttributeValue.builder().n(String.valueOf(stats.totalSends)).build());
            item.put("messageCategory", AttributeValue.builder().s(messageCategory(req).name()).build());
            if (req.getNotificationType() != null && !req.getNotificationType().isBlank()) {
                item.put("notificationType", AttributeValue.builder().s(req.getNotificationType()).build());
            }
            item.put("priorityClass", AttributeValue.builder().s(PriorityClass.from(req.getPriorityClass()).name()).build());
            item.put("channel", AttributeValue.builder().s(Channel.from(req.getChannel()).name()).build());
            item.put("reason", AttributeValue.builder().s(attention.reason).build());

            dynamo.putItem(PutItemRequest.builder()
                    .tableName(attentionTable)
                    .item(item)
                    .build());
        } catch (Exception e) {
            context.getLogger().log("Could not record attention decision: " + e.getMessage());
        }

        return decisionId;
    }

    private ScheduleResult scheduleSend(DecisionRequest req, SendTimeResult sendTime, String decisionId, AttentionDecision attention) throws Exception {
        ZonedDateTime targetTime = nextUtcHour(sendTime.bestHour);

        String scheduleExpression = "at(" + targetTime.format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss")) + ")";
        String scheduleName = "send-" + UUID.randomUUID();

        Map<String, Object> schedulerPayload = new LinkedHashMap<>();
        schedulerPayload.put("userId", req.getUserId());
        schedulerPayload.put("channel", req.getChannel());
        schedulerPayload.put("message", req.getMessage());
        schedulerPayload.put("metadata", req.getMetadata());
        schedulerPayload.put("attentionDecisionId", decisionId);
        schedulerPayload.put("sourceId", attention.sourceId);
        schedulerPayload.put("notificationType", req.getNotificationType());
        schedulerPayload.put("messageCategory", messageCategory(req).name());
        schedulerPayload.put("priorityClass", req.getPriorityClass());

        Target target = Target.builder()
                .arn(senderFunctionArn)
                .roleArn(schedulerRoleArn)
                .input(MAPPER.writeValueAsString(schedulerPayload))
                .build();

        scheduler.createSchedule(CreateScheduleRequest.builder()
                .name(scheduleName)
                .scheduleExpression(scheduleExpression)
                .flexibleTimeWindow(FlexibleTimeWindow.builder()
                        .mode(FlexibleTimeWindowMode.OFF)
                        .build())
                .target(target)
                .build());

        return new ScheduleResult(scheduleName, targetTime.toString());
    }

    private String recommendedSendTime(int bestHour) {
        if (bestHour < 0) {
            return null;
        }
        return nextUtcHour(bestHour).toString();
    }

    private ZonedDateTime nextUtcHour(int hour) {
        ZonedDateTime nowUtc = ZonedDateTime.now(ZoneOffset.UTC);
        ZonedDateTime targetTime = nowUtc.withHour(hour).withMinute(0).withSecond(0).withNano(0);
        if (!targetTime.isAfter(nowUtc)) {
            targetTime = targetTime.plusDays(1);
        }
        return targetTime;
    }

    private double fatigueScore(UserStats stats) {
        double volume = Math.min(1.0, stats.totalSends / 30.0);
        double ignoreRatio = stats.totalSends > 0
                ? clamp((stats.totalSends - stats.totalClicks) / (double) stats.totalSends, 0.0, 1.0)
                : 0.0;
        return clamp((volume * 0.45) + (ignoreRatio * 0.55), 0.0, 1.0);
    }

    private double channelCost(Channel channel) {
        return switch (channel) {
            case SMS -> 0.9;
            case PUSH -> 0.7;
            case EMAIL -> 0.4;
            case AUTO -> 0.6;
        };
    }

    private double categoryPenalty(MessageCategory messageCategory) {
        return switch (messageCategory) {
            case MARKETING, PROMOTION -> 1.2;
            case NEWSLETTER -> 0.8;
            case TRANSACTIONAL -> -0.4;
            case SECURITY, EMERGENCY -> -1.0;
            case GENERAL -> 0.0;
        };
    }

    private double priorityUrgency(PriorityClass priority, Double requestedUrgency) {
        if (requestedUrgency != null) {
            return clamp(requestedUrgency, 0.0, 1.0);
        }
        return switch (priority) {
            case EMERGENCY, SECURITY -> 1.0;
            case TRANSACTIONAL, HIGH -> 0.8;
            case STANDARD -> 0.45;
            case LOW -> 0.2;
        };
    }

    private double priorityBoost(PriorityClass priority) {
        return switch (priority) {
            case EMERGENCY -> 4.0;
            case SECURITY -> 3.0;
            case TRANSACTIONAL, HIGH -> 1.4;
            case LOW -> -0.5;
            case STANDARD -> 0.0;
        };
    }

    private double safetyMargin(PriorityClass priority, MessageCategory messageCategory) {
        if (priority == PriorityClass.LOW
                || messageCategory == MessageCategory.MARKETING
                || messageCategory == MessageCategory.PROMOTION) {
            return 1.0;
        }
        if (isBypassPriority(priority)) {
            return 0.0;
        }
        return 0.5;
    }

    private boolean isBypassPriority(PriorityClass priority) {
        return priority == PriorityClass.EMERGENCY
                || priority == PriorityClass.SECURITY
                || priority == PriorityClass.TRANSACTIONAL;
    }

    private String sourceId(DecisionRequest req) {
        if (req.getSourceId() != null && !req.getSourceId().isBlank()) {
            return req.getSourceId();
        }
        if (req.getCampaignId() != null && !req.getCampaignId().isBlank()) {
            return "campaign:" + req.getCampaignId();
        }
        if (req.getTemplateId() != null && !req.getTemplateId().isBlank()) {
            return "template:" + req.getTemplateId();
        }
        return "category:" + messageCategory(req).name();
    }

    private MessageCategory messageCategory(DecisionRequest req) {
        if (req.getMessageCategory() != null && !req.getMessageCategory().isBlank()) {
            return MessageCategory.from(req.getMessageCategory());
        }

        // Backward-compatible fallback only for direct decision API callers.
        // Existing event ingestion uses notificationType as routing mode: immediate/optimized.
        String legacyNotificationType = normalize(req.getNotificationType(), "");
        if (!legacyNotificationType.isBlank()
                && !"IMMEDIATE".equals(legacyNotificationType)
                && !"OPTIMIZED".equals(legacyNotificationType)) {
            return MessageCategory.from(legacyNotificationType);
        }

        return MessageCategory.GENERAL;
    }

    private static APIGatewayV2HTTPResponse response(int statusCode, String body) {
        return APIGatewayV2HTTPResponse.builder()
                .withStatusCode(statusCode)
                .withHeaders(corsHeaders())
                .withBody(body)
                .build();
    }

    private static Map<String, String> corsHeaders() {
        return Map.of(
                "Content-Type", "application/json",
                "Access-Control-Allow-Origin", "*",
                "Access-Control-Allow-Methods", "POST,OPTIONS",
                "Access-Control-Allow-Headers", "Content-Type,Authorization"
        );
    }

    private static int number(AttributeValue value) {
        return value != null && value.n() != null ? Integer.parseInt(value.n()) : 0;
    }

    private static double numberAttr(Map<String, AttributeValue> item, String key) {
        AttributeValue value = item.get(key);
        return value != null && value.n() != null ? Double.parseDouble(value.n()) : 0.0;
    }

    private static String stringAttr(Map<String, AttributeValue> item, String key) {
        AttributeValue value = item.get(key);
        return value != null && value.s() != null ? value.s() : "";
    }

    private static void putString(ObjectNode node, String outKey, Map<String, AttributeValue> item, String itemKey) {
        String value = stringAttr(item, itemKey);
        if (!value.isBlank()) {
            node.put(outKey, value);
        }
    }

    private static void putNumber(ObjectNode node, String outKey, Map<String, AttributeValue> item, String itemKey) {
        AttributeValue value = item.get(itemKey);
        if (value != null && value.n() != null) {
            node.put(outKey, Double.parseDouble(value.n()));
        }
    }

    private static String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private static int parseLimit(String value, int fallback) {
        try {
            return Math.max(1, Math.min(500, Integer.parseInt(value)));
        } catch (Exception ignored) {
            return fallback;
        }
    }

    private static double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    private static double round(double value) {
        return Math.round(value * 10000.0) / 10000.0;
    }

    private static String normalize(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim().toUpperCase();
    }

    private static String safeMessage(String value) {
        return value == null ? "Internal server error" : value.replace("\"", "'");
    }

    private record SendTimeResult(int bestHour, double bestScore, int sendNowHour, double sendNowScore) {}

    private record ScheduleResult(String scheduleName, String scheduledTime) {}

    private record AttentionDecision(
            String decision,
            double cost,
            double value,
            double margin,
            String reason,
            double fatigueScore,
            double sourceTrustScore,
            String sourceId
    ) {}

    private enum DecisionOutcome {
        SEND,   // Attention value cleared the gate; schedule or send the notification.
        DEFER   // Attention cost is too high; do not schedule this non-critical message now.
    }

    private enum Channel {
        AUTO,   // Let Sender Service choose the best available channel from user preferences.
        EMAIL,  // Email delivery; lower interruption cost, but slower response expectations.
        SMS,    // SMS delivery; higher interruption cost and usually higher business urgency.
        PUSH;   // Push notification delivery; medium interruption cost.

        static Channel from(String value) {
            return enumValue(value, Channel.class, AUTO);
        }
    }

    private enum MessageCategory {
        GENERAL,       // Default informational message when no specific business category is supplied.
        MARKETING,     // Revenue or re-engagement message; requires stronger value to spend attention.
        PROMOTION,     // Discount, offer, or campaign message; treated like marketing.
        NEWSLETTER,    // Recurring content update; less urgent than transactional messages.
        TRANSACTIONAL, // User-requested or account-related update; gets lower attention penalty.
        SECURITY,      // Security-sensitive alert; bypasses the normal attention budget.
        EMERGENCY;     // Emergency or safety alert; bypasses the normal attention budget.

        static MessageCategory from(String value) {
            return enumValue(value, MessageCategory.class, GENERAL);
        }
    }

    private enum PriorityClass {
        LOW,           // Nice-to-have message; requires a wider value-over-cost margin.
        STANDARD,      // Normal message; default priority when caller does not specify one.
        HIGH,          // Important but not mandatory; receives urgency and value boost.
        TRANSACTIONAL, // Must-reach user-requested update; bypasses the attention budget.
        SECURITY,      // Security-critical alert; bypasses the attention budget.
        EMERGENCY;     // Emergency or safety alert; bypasses the attention budget.

        static PriorityClass from(String value) {
            return enumValue(value, PriorityClass.class, STANDARD);
        }
    }

    private static class SummaryStats {
        private int total;
        private int sendCount;
        private int deferCount;
        private double costSum;
        private double valueSum;
        private double fatigueSum;
        private double trustSum;
        private double deferredCostSum;
        private final Map<String, Integer> sourceCounts = new HashMap<>();

        private double avg(double sum) {
            return total == 0 ? 0.0 : sum / total;
        }

        private double rate(int count) {
            return total == 0 ? 0.0 : (double) count / total;
        }

        private String recommendation() {
            if (total == 0) {
                return "No Attention Escrow decisions found for this scope yet.";
            }
            if (rate(deferCount) > 0.45 && avg(valueSum) <= avg(costSum) + 1.0) {
                return "High defer rate: review targeting, content value, or send frequency before scaling this source.";
            }
            if (avg(fatigueSum) > 0.55) {
                return "User fatigue is elevated: consider digesting low-priority messages or lowering campaign frequency.";
            }
            if (rate(sendCount) > 0.75 && avg(valueSum) > avg(costSum)) {
                return "Healthy source: most messages clear the attention gate with value above cost.";
            }
            return "Mixed performance: compare message categories, priority classes, and source trust before increasing volume.";
        }
    }

    private static <T extends Enum<T>> T enumValue(String value, Class<T> enumType, T fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        try {
            return Enum.valueOf(enumType, value.trim().toUpperCase());
        } catch (IllegalArgumentException ignored) {
            return fallback;
        }
    }

    private static class UserStats {
        private int totalEvents;
        private int totalClicks;
        private int totalSends;

        private double clickRate() {
            return totalSends > 0 ? (double) totalClicks / totalSends : 0.0;
        }
    }

    public static class DecisionRequest {
        private String userId;
        private long windowStart;
        private long windowEnd;
        private Boolean schedule;
        private String channel;
        private String sourceId;
        private String campaignId;
        private String templateId;
        private String notificationType;
        private String messageCategory;
        private String priorityClass;
        private Double businessValue;
        private Double urgency;
        private String message;
        private Map<String, Object> metadata;

        public String getUserId() { return userId; }
        public void setUserId(String userId) { this.userId = userId; }
        public long getWindowStart() { return windowStart; }
        public void setWindowStart(long windowStart) { this.windowStart = windowStart; }
        public long getWindowEnd() { return windowEnd; }
        public void setWindowEnd(long windowEnd) { this.windowEnd = windowEnd; }
        public Boolean getSchedule() { return schedule; }
        public void setSchedule(Boolean schedule) { this.schedule = schedule; }
        public String getChannel() { return channel; }
        public void setChannel(String channel) { this.channel = channel; }
        public String getSourceId() { return sourceId; }
        public void setSourceId(String sourceId) { this.sourceId = sourceId; }
        public String getCampaignId() { return campaignId; }
        public void setCampaignId(String campaignId) { this.campaignId = campaignId; }
        public String getTemplateId() { return templateId; }
        public void setTemplateId(String templateId) { this.templateId = templateId; }
        public String getNotificationType() { return notificationType; }
        public void setNotificationType(String notificationType) { this.notificationType = notificationType; }
        public String getMessageCategory() { return messageCategory; }
        public void setMessageCategory(String messageCategory) { this.messageCategory = messageCategory; }
        public String getPriorityClass() { return priorityClass; }
        public void setPriorityClass(String priorityClass) { this.priorityClass = priorityClass; }
        public Double getBusinessValue() { return businessValue; }
        public void setBusinessValue(Double businessValue) { this.businessValue = businessValue; }
        public Double getUrgency() { return urgency; }
        public void setUrgency(Double urgency) { this.urgency = urgency; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
        public Map<String, Object> getMetadata() { return metadata; }
        public void setMetadata(Map<String, Object> metadata) { this.metadata = metadata; }
    }
}
