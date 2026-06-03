package com.yadab.sr.analytics;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yadab.sr.analytics.model.MetricsOverviewResponse;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.ScanRequest;
import software.amazon.awssdk.services.dynamodb.model.ScanResponse;

import java.util.HashMap;
import java.util.Map;

/**
 * Handler for GET /v1/analytics/metrics
 * Returns overall KPI metrics: total events, active users, engagement rate, model AUC
 */
public class MetricsHandler implements RequestHandler<APIGatewayV2HTTPEvent, APIGatewayV2HTTPResponse> {
    private final DynamoDbClient dynamoDb;
    private final ObjectMapper objectMapper;
    private final String usersTableName;

    public MetricsHandler() {
        this.dynamoDb = DynamoDbClient.builder().build();
        this.objectMapper = new ObjectMapper();
        this.usersTableName = System.getenv("USERS_TABLE_NAME");
    }

    @Override
    public APIGatewayV2HTTPResponse handleRequest(APIGatewayV2HTTPEvent event, Context context) {
        try {
            context.getLogger().log("Fetching analytics metrics from DynamoDB");

            // Scan users table to get aggregate stats
            ScanRequest scanRequest = ScanRequest.builder()
                    .tableName(usersTableName)
                    .build();

            ScanResponse scanResponse = dynamoDb.scan(scanRequest);

            long activeUsers = scanResponse.count();
            long totalEvents = 0;
            long totalClicks = 0;
            long totalSends = 0;

            // Aggregate counters from all users
            for (var item : scanResponse.items()) {
                if (item.containsKey("eventCounter")) {
                    totalEvents += Long.parseLong(item.get("eventCounter").n());
                }
                if (item.containsKey("clickCounter")) {
                    totalClicks += Long.parseLong(item.get("clickCounter").n());
                }
                if (item.containsKey("sendCounter")) {
                    totalSends += Long.parseLong(item.get("sendCounter").n());
                }
            }

            // Calculate engagement rate
            double avgEngagementRate = totalSends > 0
                ? (totalClicks * 100.0 / totalSends)
                : 0.0;

            // Model AUC - this would come from S3 model metadata in production
            // For now, using a reasonable value based on XGBoost training
            double modelAUC = 0.78;

            MetricsOverviewResponse response = new MetricsOverviewResponse(
                    totalEvents,
                    activeUsers,
                    Math.round(avgEngagementRate * 100.0) / 100.0, // Round to 2 decimals
                    modelAUC
            );

            return APIGatewayV2HTTPResponse.builder()
                    .withStatusCode(200)
                    .withHeaders(getCorsHeaders())
                    .withBody(objectMapper.writeValueAsString(response))
                    .build();

        } catch (Exception e) {
            context.getLogger().log("Error fetching metrics: " + e.getMessage());
            return APIGatewayV2HTTPResponse.builder()
                    .withStatusCode(500)
                    .withHeaders(getCorsHeaders())
                    .withBody("{\"error\":\"Failed to fetch metrics\"}")
                    .build();
        }
    }

    private Map<String, String> getCorsHeaders() {
        Map<String, String> headers = new HashMap<>();
        headers.put("Content-Type", "application/json");
        headers.put("Access-Control-Allow-Origin", "*");
        headers.put("Access-Control-Allow-Methods", "GET,OPTIONS");
        headers.put("Access-Control-Allow-Headers", "Content-Type,Authorization");
        return headers;
    }
}
