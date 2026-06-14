package com.yadab.sr.controlplane;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPResponse;

import com.yadab.sr.models.User;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.services.kinesis.KinesisClient;
import software.amazon.awssdk.services.kinesis.model.PutRecordRequest;

import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.*;
import software.amazon.awssdk.regions.Region;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.Map;
import java.util.HashMap;
import java.util.List;
import java.util.ArrayList;

/**
 * Control Plane API Handler
 * Manages user lifecycle and event ingestion
 *
 * Endpoints:
 * - POST /v1/users - Create user
 * - POST /v1/users/bulk - Bulk import users
 * - GET /v1/users/{id} - Get user
 * - GET /v1/users/stats - Get user creation statistics
 * - PUT /v1/users/{id} - Update user
 * - DELETE /v1/users/{id} - Delete user
 * - POST /v1/events - Ingest events (auto-creates user if not exists)
 * - GET /v1/health - Health check
 */
public class Handler implements RequestHandler<APIGatewayV2HTTPEvent, APIGatewayV2HTTPResponse> {
    private static final KinesisClient kinesis = KinesisClient.create();
    private static final ObjectMapper mapper = new ObjectMapper();

    private static APIGatewayV2HTTPResponse ok(String body) {
        return APIGatewayV2HTTPResponse.builder().withStatusCode(200).withBody(body).build();
    }

    private static APIGatewayV2HTTPResponse resp(int code, String body) {
        return APIGatewayV2HTTPResponse.builder().withStatusCode(code).withBody(body).build();
    }

    private static APIGatewayV2HTTPResponse json(int code, String body) {
        return APIGatewayV2HTTPResponse.builder()
                .withStatusCode(code)
                .withHeaders(Map.of("Content-Type", "application/json"))
                .withBody(body)
                .build();
    }

    private static String table() {
        return System.getenv("USER_TABLE");
    }

    private final DynamoDbClient ddb = DynamoDbClient.builder()
            .region(Region.of(System.getenv("AWS_REGION")))
            .build();

    @Override
    public APIGatewayV2HTTPResponse handleRequest(APIGatewayV2HTTPEvent e, Context ctx) {
        String path = e.getRequestContext().getHttp().getPath();
        String method = e.getRequestContext().getHttp().getMethod();

        ctx.getLogger().log("Request: " + method + " " + path);

        try {
            // Health check
            if ("/v1/health".equals(path)) {
                return ok("{\"status\":\"ok\"}");
            }

            // User Management Endpoints
            if (path.equals("/v1/users") && "POST".equals(method)) {
                return createUser(e, ctx);
            }

            if (path.equals("/v1/users/bulk") && "POST".equals(method)) {
                return bulkCreateUsers(e, ctx);
            }

            if (path.matches("/v1/users/[^/]+") && "GET".equals(method)) {
                String userId = extractUserId(path);
                return getUser(userId, ctx);
            }

            if (path.matches("/v1/users/[^/]+") && "PUT".equals(method)) {
                String userId = extractUserId(path);
                return updateUser(userId, e, ctx);
            }

            if (path.matches("/v1/users/[^/]+") && "DELETE".equals(method)) {
                String userId = extractUserId(path);
                return deleteUser(userId, ctx);
            }

            // Event Ingestion (validates user exists)
            if ("/v1/events".equals(path) && "POST".equals(method)) {
                return ingestEvent(e, ctx);
            }

            // User statistics
            if ("/v1/users/stats".equals(path) && "GET".equals(method)) {
                return getUserStats(ctx);
            }

            return json(404, "{\"error\":\"Not found\"}");

        } catch (ValidationException ex) {
            ctx.getLogger().log("Validation error: " + ex.getMessage());
            return json(400, "{\"error\":\"" + ex.getMessage() + "\"}");
        } catch (ResourceNotFoundException ex) {
            ctx.getLogger().log("Resource not found: " + ex.getMessage());
            return json(404, "{\"error\":\"" + ex.getMessage() + "\"}");
        } catch (ConflictException ex) {
            ctx.getLogger().log("Conflict: " + ex.getMessage());
            return json(409, "{\"error\":\"" + ex.getMessage() + "\"}");
        } catch (Exception ex) {
            ctx.getLogger().log("Error: " + ex.getMessage());
            ex.printStackTrace();
            return json(500, "{\"error\":\"Internal server error\"}");
        }
    }

    /**
     * POST /v1/users - Create new user
     */
    private APIGatewayV2HTTPResponse createUser(APIGatewayV2HTTPEvent e, Context ctx) throws Exception {
        String body = e.getBody();
        if (body == null || body.isEmpty()) {
            throw new ValidationException("Request body required");
        }

        User user = mapper.readValue(body, User.class);

        // Validate required fields
        if (user.userId == null || user.userId.isEmpty()) {
            throw new ValidationException("userId is required");
        }

        // Validate at least one contact method
        if (!user.hasContactInfo()) {
            throw new ValidationException("At least one contact method required (email or phone)");
        }

        // Validate phone format if provided
        if (user.phone != null && !user.phone.isEmpty() && !user.phone.matches("^\\+[1-9]\\d{1,14}$")) {
            throw new ValidationException("Phone must be in E.164 format (+1XXXXXXXXXX)");
        }

        // Check if user already exists
        if (userExists(user.userId)) {
            throw new ConflictException("User already exists: " + user.userId);
        }

        // Initialize counters and timestamps
        if (user.counters == null) {
            user.counters = new User.Counters();
        }
        String now = Instant.now().toString();
        user.createdAt = now;
        user.lastSeenAt = now;
        user.createdBy = "API";

        // Save to DynamoDB
        PutItemRequest putReq = PutItemRequest.builder()
                .tableName(table())
                .item(user.toItem())
                .build();

        ddb.putItem(putReq);

        ctx.getLogger().log("User created: " + user.userId);

        Map<String, Object> response = new HashMap<>();
        response.put("userId", user.userId);
        response.put("created", true);

        return json(201, mapper.writeValueAsString(response));
    }

    /**
     * POST /v1/users/bulk - Bulk import users
     */
    private APIGatewayV2HTTPResponse bulkCreateUsers(APIGatewayV2HTTPEvent e, Context ctx) throws Exception {
        String body = e.getBody();
        if (body == null || body.isEmpty()) {
            throw new ValidationException("Request body required");
        }

        JsonNode users = mapper.readTree(body);

        if (!users.isArray()) {
            throw new ValidationException("Request body must be array of users");
        }

        int created = 0;
        int skipped = 0;
        List<String> errors = new ArrayList<>();

        for (JsonNode userNode : users) {
            try {
                User user = mapper.treeToValue(userNode, User.class);

                // Validate required fields
                if (user.userId == null || user.userId.isEmpty()) {
                    errors.add("userId is required");
                    continue;
                }

                // Validate at least one contact method
                if (!user.hasContactInfo()) {
                    errors.add("User " + user.userId + ": at least one contact method required");
                    continue;
                }

                // Validate phone format if provided
                if (user.phone != null && !user.phone.isEmpty() && !user.phone.matches("^\\+[1-9]\\d{1,14}$")) {
                    errors.add("User " + user.userId + ": phone must be in E.164 format");
                    continue;
                }

                // Skip if user already exists
                if (userExists(user.userId)) {
                    skipped++;
                    continue;
                }

                // Initialize counters and timestamp
                if (user.counters == null) {
                    user.counters = new User.Counters();
                }
                user.lastSeenAt = Instant.now().toString();

                // Save to DynamoDB
                PutItemRequest putReq = PutItemRequest.builder()
                        .tableName(table())
                        .item(user.toItem())
                        .build();

                ddb.putItem(putReq);
                created++;

            } catch (Exception ex) {
                errors.add(ex.getMessage());
            }
        }

        ctx.getLogger().log(String.format("Bulk import: %d created, %d skipped, %d errors", created, skipped, errors.size()));

        Map<String, Object> response = new HashMap<>();
        response.put("created", created);
        response.put("skipped", skipped);
        response.put("errors", errors);

        return json(200, mapper.writeValueAsString(response));
    }

    /**
     * GET /v1/users/{id} - Get user profile
     */
    private APIGatewayV2HTTPResponse getUser(String userId, Context ctx) throws Exception {
        Map<String, AttributeValue> key = Map.of(
                "pk", AttributeValue.builder().s("USER#" + userId).build(),
                "sk", AttributeValue.builder().s("PROFILE").build()
        );

        GetItemRequest req = GetItemRequest.builder()
                .tableName(table())
                .key(key)
                .build();

        GetItemResponse res = ddb.getItem(req);

        if (!res.hasItem() || res.item().isEmpty()) {
            throw new ResourceNotFoundException("User not found: " + userId);
        }

        User user = User.fromItem(res.item());
        String responseBody = mapper.writeValueAsString(user);

        return json(200, responseBody);
    }

    /**
     * PUT /v1/users/{id} - Update user profile
     */
    private APIGatewayV2HTTPResponse updateUser(String userId, APIGatewayV2HTTPEvent e, Context ctx) throws Exception {
        String body = e.getBody();
        if (body == null || body.isEmpty()) {
            throw new ValidationException("Request body required");
        }

        // Check if user exists
        if (!userExists(userId)) {
            throw new ResourceNotFoundException("User not found: " + userId);
        }

        // Parse update request
        JsonNode updates = mapper.readTree(body);

        // Build update expression
        StringBuilder updateExpr = new StringBuilder("SET ");
        Map<String, AttributeValue> exprValues = new HashMap<>();
        int updateCount = 0;

        // Update email
        if (updates.has("email")) {
            if (updateCount > 0) updateExpr.append(", ");
            updateExpr.append("email = :email");
            exprValues.put(":email", AttributeValue.builder().s(updates.get("email").asText()).build());
            updateCount++;
        }

        // Update phone
        if (updates.has("phone")) {
            String phone = updates.get("phone").asText();
            if (!phone.isEmpty() && !phone.matches("^\\+[1-9]\\d{1,14}$")) {
                throw new ValidationException("Phone must be in E.164 format (+1XXXXXXXXXX)");
            }
            if (updateCount > 0) updateExpr.append(", ");
            updateExpr.append("phone = :phone");
            exprValues.put(":phone", AttributeValue.builder().s(phone).build());
            updateCount++;
        }

        // Update preferences
        if (updates.has("prefs")) {
            JsonNode prefs = updates.get("prefs");
            Map<String, AttributeValue> prefsMap = new HashMap<>();
            if (prefs.has("channel")) {
                prefsMap.put("channel", AttributeValue.builder().s(prefs.get("channel").asText()).build());
            }
            if (updateCount > 0) updateExpr.append(", ");
            updateExpr.append("prefs = :prefs");
            exprValues.put(":prefs", AttributeValue.builder().m(prefsMap).build());
            updateCount++;
        }

        // Update lastSeenAt
        if (updateCount > 0) updateExpr.append(", ");
        updateExpr.append("lastSeenAt = :lastSeenAt");
        exprValues.put(":lastSeenAt", AttributeValue.builder().s(Instant.now().toString()).build());

        if (updateCount == 0) {
            throw new ValidationException("No valid fields to update");
        }

        Map<String, AttributeValue> key = Map.of(
                "pk", AttributeValue.builder().s("USER#" + userId).build(),
                "sk", AttributeValue.builder().s("PROFILE").build()
        );

        UpdateItemRequest updateReq = UpdateItemRequest.builder()
                .tableName(table())
                .key(key)
                .updateExpression(updateExpr.toString())
                .expressionAttributeValues(exprValues)
                .build();

        ddb.updateItem(updateReq);

        ctx.getLogger().log("User updated: " + userId);

        Map<String, Object> response = new HashMap<>();
        response.put("userId", userId);
        response.put("updated", true);

        return json(200, mapper.writeValueAsString(response));
    }

    /**
     * DELETE /v1/users/{id} - Delete user
     */
    private APIGatewayV2HTTPResponse deleteUser(String userId, Context ctx) throws Exception {
        // Check if user exists
        if (!userExists(userId)) {
            throw new ResourceNotFoundException("User not found: " + userId);
        }

        Map<String, AttributeValue> key = Map.of(
                "pk", AttributeValue.builder().s("USER#" + userId).build(),
                "sk", AttributeValue.builder().s("PROFILE").build()
        );

        DeleteItemRequest deleteReq = DeleteItemRequest.builder()
                .tableName(table())
                .key(key)
                .build();

        ddb.deleteItem(deleteReq);

        ctx.getLogger().log("User deleted: " + userId);

        Map<String, Object> response = new HashMap<>();
        response.put("userId", userId);
        response.put("deleted", true);

        return json(200, mapper.writeValueAsString(response));
    }

    /**
     * POST /v1/events - Ingest event (auto-creates user if not exists)
     */
    private APIGatewayV2HTTPResponse ingestEvent(APIGatewayV2HTTPEvent e, Context ctx) throws Exception {
        String body = e.getBody();
        if (body == null || body.isEmpty()) {
            throw new ValidationException("Request body required");
        }

        // Parse event to extract userId and contact info
        JsonNode event = mapper.readTree(body);
        if (!event.has("userId")) {
            throw new ValidationException("userId is required in event");
        }

        String userId = event.get("userId").asText();

        // Auto-create user if doesn't exist
        if (!userExists(userId)) {
            ctx.getLogger().log("User not found, auto-creating: " + userId);

            // Extract contact info from event if provided
            String email = event.has("email") ? event.get("email").asText() : null;
            String phone = event.has("phone") ? event.get("phone").asText() : null;

            // Validate at least one contact method
            if ((email == null || email.isEmpty()) && (phone == null || phone.isEmpty())) {
                throw new ValidationException("User not found and no contact info (email/phone) provided in event");
            }

            // Validate phone format if provided
            if (phone != null && !phone.isEmpty() && !phone.matches("^\\+[1-9]\\d{1,14}$")) {
                throw new ValidationException("Phone must be in E.164 format (+1XXXXXXXXXX)");
            }

            // Create user profile
            User newUser = new User();
            newUser.userId = userId;
            newUser.email = email;
            newUser.phone = phone;
            newUser.counters = new User.Counters();
            String now = Instant.now().toString();
            newUser.createdAt = now;
            newUser.lastSeenAt = now;
            newUser.createdBy = "AUTO_EVENT";

            PutItemRequest putReq = PutItemRequest.builder()
                    .tableName(table())
                    .item(newUser.toItem())
                    .build();

            ddb.putItem(putReq);
            ctx.getLogger().log("Auto-created user: " + userId);
        }

        // User exists (or just created) - send event to Kinesis
        String stream = System.getenv("USER_EVENTS_STREAM");
        kinesis.putRecord(PutRecordRequest.builder()
                .streamName(stream)
                .partitionKey(userId)
                .data(SdkBytes.fromUtf8String(body))
                .build());

        ctx.getLogger().log("Event queued for user: " + userId);

        Map<String, Object> response = new HashMap<>();
        response.put("userId", userId);
        response.put("status", "queued");

        return json(200, mapper.writeValueAsString(response));
    }

    /**
     * GET /v1/users/stats - Get user creation statistics
     */
    private APIGatewayV2HTTPResponse getUserStats(Context ctx) throws Exception {
        // Scan DynamoDB to count users by createdBy field
        Map<String, AttributeValue> expressionValues = Map.of(
                ":profile", AttributeValue.builder().s("PROFILE").build()
        );

        ScanRequest scanReq = ScanRequest.builder()
                .tableName(table())
                .filterExpression("sk = :profile")
                .expressionAttributeValues(expressionValues)
                .build();

        ScanResponse scanRes = ddb.scan(scanReq);

        int totalUsers = 0;
        int apiCreated = 0;
        int autoCreated = 0;
        int unknownSource = 0;

        for (Map<String, AttributeValue> item : scanRes.items()) {
            totalUsers++;

            if (item.containsKey("createdBy") && item.get("createdBy").s() != null) {
                String createdBy = item.get("createdBy").s();
                if ("API".equals(createdBy)) {
                    apiCreated++;
                } else if ("AUTO_EVENT".equals(createdBy)) {
                    autoCreated++;
                } else {
                    unknownSource++;
                }
            } else {
                unknownSource++; // Users created before this feature was added
            }
        }

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalUsers", totalUsers);
        stats.put("apiCreated", apiCreated);
        stats.put("autoCreated", autoCreated);
        stats.put("unknownSource", unknownSource);
        stats.put("autoCreatedPercentage", totalUsers > 0 ? (autoCreated * 100.0 / totalUsers) : 0);

        ctx.getLogger().log(String.format("User stats: %d total, %d API, %d auto-event", totalUsers, apiCreated, autoCreated));

        return json(200, mapper.writeValueAsString(stats));
    }

    /**
     * Check if user exists in DynamoDB.
     */
    private boolean userExists(String userId) {
        Map<String, AttributeValue> key = Map.of(
                "pk", AttributeValue.builder().s("USER#" + userId).build(),
                "sk", AttributeValue.builder().s("PROFILE").build()
        );

        GetItemRequest req = GetItemRequest.builder()
                .tableName(table())
                .key(key)
                .build();

        GetItemResponse res = ddb.getItem(req);
        return res.hasItem() && !res.item().isEmpty();
    }

    /**
     * Extract userId from path like /v1/users/{userId}
     */
    private String extractUserId(String path) {
        return path.substring(path.lastIndexOf('/') + 1);
    }

    // Custom exceptions
    private static class ValidationException extends Exception {
        public ValidationException(String message) {
            super(message);
        }
    }

    private static class ResourceNotFoundException extends Exception {
        public ResourceNotFoundException(String message) {
            super(message);
        }
    }

    private static class ConflictException extends Exception {
        public ConflictException(String message) {
            super(message);
        }
    }
}
