package com.yadab.sr.controlplane;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPResponse;

import com.yadab.sr.models.User;
import com.yadab.sr.models.NotificationCategory;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.services.kinesis.KinesisClient;
import software.amazon.awssdk.services.kinesis.model.PutRecordRequest;

import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.*;
import software.amazon.awssdk.regions.Region;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

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
 * - GET /v1/users - List all users (with pagination)
 * - POST /v1/users/bulk - Bulk import users
 * - GET /v1/users/stats - Get user creation statistics
 * - GET /v1/users/{id} - Get user
 * - PUT /v1/users/{id} - Update user
 * - DELETE /v1/users/{id} - Delete user
 * - POST /v1/categories - Create notification category policy
 * - GET /v1/categories - List notification categories
 * - GET /v1/categories/{id} - Get notification category
 * - PUT /v1/categories/{id} - Update notification category
 * - DELETE /v1/categories/{id} - Delete notification category
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

    private static String categoryTable() {
        return System.getenv("CATEGORY_TABLE");
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

            if (path.equals("/v1/users") && "GET".equals(method)) {
                return listUsers(e, ctx);
            }

            if (path.equals("/v1/users/bulk") && "POST".equals(method)) {
                return bulkCreateUsers(e, ctx);
            }

            // User statistics - must come BEFORE wildcard /v1/users/{id}
            if ("/v1/users/stats".equals(path) && "GET".equals(method)) {
                return getUserStats(ctx);
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

            // Notification Category Configuration Endpoints
            if (path.equals("/v1/categories") && "POST".equals(method)) {
                return createCategory(e, ctx);
            }

            if (path.equals("/v1/categories") && "GET".equals(method)) {
                return listCategories(e, ctx);
            }

            if (path.matches("/v1/categories/[^/]+") && "GET".equals(method)) {
                String categoryId = extractPathId(path);
                return getCategory(categoryId, e, ctx);
            }

            if (path.matches("/v1/categories/[^/]+") && "PUT".equals(method)) {
                String categoryId = extractPathId(path);
                return updateCategory(categoryId, e, ctx);
            }

            if (path.matches("/v1/categories/[^/]+") && "DELETE".equals(method)) {
                String categoryId = extractPathId(path);
                return deleteCategory(categoryId, e, ctx);
            }

            // Event Ingestion (validates user exists)
            if ("/v1/events".equals(path) && "POST".equals(method)) {
                return ingestEvent(e, ctx);
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
     * POST /v1/categories - Create notification category configuration.
     */
    private APIGatewayV2HTTPResponse createCategory(APIGatewayV2HTTPEvent e, Context ctx) throws Exception {
        String body = e.getBody();
        if (body == null || body.isEmpty()) {
            throw new ValidationException("Request body required");
        }

        NotificationCategory category = mapper.readValue(body, NotificationCategory.class);
        category.organizationId = organizationId(e);
        validateCategory(category);

        if (categoryExists(category.organizationId, category.categoryId)) {
            throw new ConflictException("Category already exists: " + category.categoryId);
        }

        applyCategoryDefaults(category);
        validateCategoryEnums(category);
        String now = Instant.now().toString();
        category.createdAt = now;
        category.updatedAt = now;

        ddb.putItem(PutItemRequest.builder()
                .tableName(categoryTable())
                .item(category.toItem())
                .build());

        ctx.getLogger().log("Category created: " + category.categoryId);
        return json(201, mapper.writeValueAsString(category));
    }

    /**
     * GET /v1/categories - List notification category configurations.
     */
    private APIGatewayV2HTTPResponse listCategories(APIGatewayV2HTTPEvent e, Context ctx) throws Exception {
        String organizationId = organizationId(e);
        Map<String, AttributeValue> expressionValues = Map.of(
                ":pk", AttributeValue.builder().s("ORG#" + organizationId).build()
        );

        QueryResponse queryRes = ddb.query(QueryRequest.builder()
                .tableName(categoryTable())
                .keyConditionExpression("pk = :pk")
                .expressionAttributeValues(expressionValues)
                .build());

        List<NotificationCategory> categories = new ArrayList<>();
        for (Map<String, AttributeValue> item : queryRes.items()) {
            NotificationCategory category = NotificationCategory.fromItem(item);
            if (category != null && category.categoryId != null) {
                categories.add(category);
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("organizationId", organizationId);
        response.put("categories", categories);
        response.put("count", categories.size());

        ctx.getLogger().log(String.format("Listed %d categories", categories.size()));
        return json(200, mapper.writeValueAsString(response));
    }

    /**
     * GET /v1/categories/{id} - Get notification category configuration.
     */
    private APIGatewayV2HTTPResponse getCategory(String categoryId, APIGatewayV2HTTPEvent e, Context ctx) throws Exception {
        NotificationCategory category = fetchCategory(organizationId(e), categoryId);
        if (category == null) {
            throw new ResourceNotFoundException("Category not found: " + categoryId);
        }
        return json(200, mapper.writeValueAsString(category));
    }

    /**
     * PUT /v1/categories/{id} - Replace notification category configuration.
     */
    private APIGatewayV2HTTPResponse updateCategory(String categoryId, APIGatewayV2HTTPEvent e, Context ctx) throws Exception {
        String body = e.getBody();
        if (body == null || body.isEmpty()) {
            throw new ValidationException("Request body required");
        }

        String organizationId = organizationId(e);
        NotificationCategory existing = fetchCategory(organizationId, categoryId);
        if (existing == null) {
            throw new ResourceNotFoundException("Category not found: " + categoryId);
        }

        NotificationCategory category = mapper.readValue(body, NotificationCategory.class);
        category.organizationId = organizationId;
        category.categoryId = categoryId;
        validateCategory(category);
        applyCategoryDefaults(category);
        validateCategoryEnums(category);
        category.createdAt = existing.createdAt;
        category.updatedAt = Instant.now().toString();

        ddb.putItem(PutItemRequest.builder()
                .tableName(categoryTable())
                .item(category.toItem())
                .build());

        ctx.getLogger().log("Category updated: " + category.categoryId);
        return json(200, mapper.writeValueAsString(category));
    }

    /**
     * DELETE /v1/categories/{id} - Delete notification category configuration.
     */
    private APIGatewayV2HTTPResponse deleteCategory(String categoryId, APIGatewayV2HTTPEvent e, Context ctx) throws Exception {
        String organizationId = organizationId(e);
        if (!categoryExists(organizationId, categoryId)) {
            throw new ResourceNotFoundException("Category not found: " + categoryId);
        }

        ddb.deleteItem(DeleteItemRequest.builder()
                .tableName(categoryTable())
                .key(categoryKey(organizationId, categoryId))
                .build());

        ctx.getLogger().log("Category deleted: " + categoryId);
        return json(200, mapper.writeValueAsString(Map.of("organizationId", organizationId, "categoryId", categoryId, "deleted", true)));
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

        String enrichedBody = enrichEventWithCategoryDefaults(event, body);

        // User exists (or just created) - send event to Kinesis
        String stream = System.getenv("USER_EVENTS_STREAM");
        kinesis.putRecord(PutRecordRequest.builder()
                .streamName(stream)
                .partitionKey(userId)
                .data(SdkBytes.fromUtf8String(enrichedBody))
                .build());

        ctx.getLogger().log("Event queued for user: " + userId);

        Map<String, Object> response = new HashMap<>();
        response.put("userId", userId);
        response.put("status", "queued");

        return json(200, mapper.writeValueAsString(response));
    }

    /**
     * Apply organization-defined category defaults to a notification payload.
     *
     * Category config is advisory by default: request fields win, category fields fill gaps.
     */
    private String enrichEventWithCategoryDefaults(JsonNode event, String originalBody) throws Exception {
        JsonNode notificationNode = event.path("notification");
        if (!notificationNode.isObject()) {
            return originalBody;
        }

        String categoryId = text(notificationNode, "categoryId");
        if (categoryId == null || categoryId.isBlank()) {
            categoryId = text(event, "categoryId");
        }
        if (categoryId == null || categoryId.isBlank()) {
            return originalBody;
        }

        NotificationCategory category = fetchCategory(organizationIdFromEvent(event), categoryId);
        if (category == null) {
            throw new ValidationException("Category not found: " + categoryId);
        }
        if (!category.isActive()) {
            throw new ValidationException("Category is inactive: " + categoryId);
        }

        ObjectNode enrichedEvent = event.deepCopy();
        putMissing(enrichedEvent, "organizationId", category.organizationId);
        ObjectNode notification = (ObjectNode) enrichedEvent.get("notification");
        ObjectNode originalNotification = notification.deepCopy();
        putMissing(notification, "categoryId", category.categoryId);
        putMissing(notification, "deliveryMode", category.defaultDeliveryMode);
        putMissing(notification, "messageCategory", category.messageCategory);
        putMissing(notification, "priorityClass", category.priorityClass);
        putMissing(notification, "businessValue", category.businessValue);
        putMissing(notification, "urgency", category.urgency);
        putMissing(notification, "riskClass", category.riskClass);
        putMissing(notification, "maxDelayHours", category.maxDelayHours);
        putMissing(notification, "quietHoursRespect", category.quietHoursRespect);

        if (!notification.hasNonNull("channel") && category.allowedChannels != null && category.allowedChannels.size() == 1) {
            notification.put("channel", category.allowedChannels.get(0));
        }

        String requestedChannel = text(notification, "channel");
        if (requestedChannel != null && category.allowedChannels != null && !category.allowedChannels.isEmpty()) {
            boolean allowed = category.allowedChannels.stream()
                    .anyMatch(channel -> channel.equalsIgnoreCase(requestedChannel));
            if (!allowed) {
                throw new ValidationException("Channel " + requestedChannel + " is not allowed for category " + categoryId);
            }
        }

        notification.set("categoryDefaults", categoryDefaultsNode(category));
        notification.set("effectivePolicy", effectivePolicyNode(notification));
        notification.set("policyOverrides", policyOverridesNode(originalNotification, category, notification));

        return mapper.writeValueAsString(enrichedEvent);
    }

    private ObjectNode categoryDefaultsNode(NotificationCategory category) {
        ObjectNode defaults = mapper.createObjectNode();
        putIfPresent(defaults, "categoryId", category.categoryId);
        putIfPresent(defaults, "deliveryMode", category.defaultDeliveryMode);
        putIfPresent(defaults, "messageCategory", category.messageCategory);
        putIfPresent(defaults, "priorityClass", category.priorityClass);
        putIfPresent(defaults, "businessValue", category.businessValue);
        putIfPresent(defaults, "urgency", category.urgency);
        putIfPresent(defaults, "riskClass", category.riskClass);
        putIfPresent(defaults, "maxDelayHours", category.maxDelayHours);
        putIfPresent(defaults, "quietHoursRespect", category.quietHoursRespect);
        if (category.allowedChannels != null && !category.allowedChannels.isEmpty()) {
            defaults.putPOJO("allowedChannels", category.allowedChannels);
        }
        return defaults;
    }

    private ObjectNode effectivePolicyNode(ObjectNode notification) {
        ObjectNode effective = mapper.createObjectNode();
        copyIfPresent(notification, effective, "categoryId");
        copyIfPresent(notification, effective, "deliveryMode");
        copyIfPresent(notification, effective, "channel");
        copyIfPresent(notification, effective, "messageCategory");
        copyIfPresent(notification, effective, "priorityClass");
        copyIfPresent(notification, effective, "businessValue");
        copyIfPresent(notification, effective, "urgency");
        copyIfPresent(notification, effective, "riskClass");
        copyIfPresent(notification, effective, "maxDelayHours");
        copyIfPresent(notification, effective, "quietHoursRespect");
        return effective;
    }

    private ObjectNode policyOverridesNode(ObjectNode originalNotification, NotificationCategory category, ObjectNode notification) {
        ObjectNode overrides = mapper.createObjectNode();
        markOverride(overrides, originalNotification, "deliveryMode", category.defaultDeliveryMode);
        markOverride(overrides, originalNotification, "messageCategory", category.messageCategory);
        markOverride(overrides, originalNotification, "priorityClass", category.priorityClass);
        markOverride(overrides, originalNotification, "businessValue", category.businessValue);
        markOverride(overrides, originalNotification, "urgency", category.urgency);
        markOverride(overrides, originalNotification, "riskClass", category.riskClass);
        markOverride(overrides, originalNotification, "maxDelayHours", category.maxDelayHours);
        markOverride(overrides, originalNotification, "quietHoursRespect", category.quietHoursRespect);

        if (originalNotification.hasNonNull("channel")) {
            boolean explicitChannelOverridesDefault = category.allowedChannels != null
                    && category.allowedChannels.size() == 1
                    && !category.allowedChannels.get(0).equalsIgnoreCase(text(notification, "channel"));
            overrides.put("channel", explicitChannelOverridesDefault);
        }

        return overrides;
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
     * GET /v1/users - List all users with pagination
     */
    private APIGatewayV2HTTPResponse listUsers(APIGatewayV2HTTPEvent e, Context ctx) throws Exception {
        // Get query parameters for pagination
        Map<String, String> queryParams = e.getQueryStringParameters();
        int limit = 100; // Default limit
        String lastKey = null;

        if (queryParams != null) {
            if (queryParams.containsKey("limit")) {
                try {
                    limit = Integer.parseInt(queryParams.get("limit"));
                    limit = Math.min(limit, 500); // Max 500 items
                } catch (NumberFormatException ex) {
                    throw new ValidationException("Invalid limit parameter");
                }
            }
            lastKey = queryParams.get("lastKey");
        }

        // Scan DynamoDB for all user profiles
        Map<String, AttributeValue> expressionValues = Map.of(
                ":profile", AttributeValue.builder().s("PROFILE").build()
        );

        ScanRequest.Builder scanBuilder = ScanRequest.builder()
                .tableName(table())
                .filterExpression("sk = :profile")
                .expressionAttributeValues(expressionValues)
                .limit(limit);

        // Add pagination if lastKey provided
        if (lastKey != null && !lastKey.isEmpty()) {
            Map<String, AttributeValue> exclusiveStartKey = Map.of(
                    "pk", AttributeValue.builder().s(lastKey).build(),
                    "sk", AttributeValue.builder().s("PROFILE").build()
            );
            scanBuilder.exclusiveStartKey(exclusiveStartKey);
        }

        ScanResponse scanRes = ddb.scan(scanBuilder.build());

        // Convert items to User objects
        List<User> users = new ArrayList<>();
        for (Map<String, AttributeValue> item : scanRes.items()) {
            User user = User.fromItem(item);
            users.add(user);
        }

        // Build response with pagination info
        Map<String, Object> response = new HashMap<>();
        response.put("users", users);
        response.put("count", users.size());

        if (scanRes.lastEvaluatedKey() != null && !scanRes.lastEvaluatedKey().isEmpty()) {
            String nextKey = scanRes.lastEvaluatedKey().get("pk").s();
            response.put("nextKey", nextKey);
        }

        ctx.getLogger().log(String.format("Listed %d users", users.size()));

        return json(200, mapper.writeValueAsString(response));
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

    private boolean categoryExists(String organizationId, String categoryId) {
        return fetchCategory(organizationId, categoryId) != null;
    }

    private NotificationCategory fetchCategory(String organizationId, String categoryId) {
        if (categoryId == null || categoryId.isBlank()) {
            return null;
        }

        GetItemResponse res = ddb.getItem(GetItemRequest.builder()
                .tableName(categoryTable())
                .key(categoryKey(organizationId, categoryId))
                .build());

        if (!res.hasItem() || res.item().isEmpty()) {
            return null;
        }
        return NotificationCategory.fromItem(res.item());
    }

    private Map<String, AttributeValue> categoryKey(String organizationId, String categoryId) {
        return Map.of(
                "pk", AttributeValue.builder().s("ORG#" + organizationId).build(),
                "sk", AttributeValue.builder().s("CATEGORY#" + categoryId).build()
        );
    }

    private void validateCategory(NotificationCategory category) throws ValidationException {
        if (category.categoryId == null || category.categoryId.isBlank()) {
            throw new ValidationException("categoryId is required");
        }
        if (category.organizationId == null || category.organizationId.isBlank()) {
            throw new ValidationException("organizationId is required");
        }
        if (!category.categoryId.matches("^[A-Za-z0-9_.:-]{1,80}$")) {
            throw new ValidationException("categoryId may contain letters, numbers, _, ., :, or - and must be 1-80 characters");
        }
        if (!category.organizationId.matches("^[A-Za-z0-9_.:-]{1,80}$")) {
            throw new ValidationException("organizationId may contain letters, numbers, _, ., :, or - and must be 1-80 characters");
        }
        if (category.displayName == null || category.displayName.isBlank()) {
            throw new ValidationException("displayName is required");
        }
        if (category.businessValue != null && (category.businessValue < 0.0 || category.businessValue > 10.0)) {
            throw new ValidationException("businessValue must be between 0.0 and 10.0");
        }
        if (category.urgency != null && (category.urgency < 0.0 || category.urgency > 1.0)) {
            throw new ValidationException("urgency must be between 0.0 and 1.0");
        }
        if (category.maxDelayHours != null && (category.maxDelayHours < 0 || category.maxDelayHours > 48)) {
            throw new ValidationException("maxDelayHours must be between 0 and 48");
        }
        if (category.allowedChannels != null) {
            for (String channel : category.allowedChannels) {
                if (channel == null || channel.isBlank()) {
                    throw new ValidationException("allowedChannels cannot contain blank values");
                }
                if (!List.of("AUTO", "EMAIL", "SMS", "PUSH").contains(channel.trim().toUpperCase())) {
                    throw new ValidationException("Unsupported channel in allowedChannels: " + channel);
                }
            }
        }
    }

    private void validateCategoryEnums(NotificationCategory category) throws ValidationException {
        requireOneOf("defaultDeliveryMode", category.defaultDeliveryMode, List.of("IMMEDIATE", "OPTIMIZED"));
        requireOneOf("messageCategory", category.messageCategory, List.of(
                "GENERAL", "MARKETING", "PROMOTION", "NEWSLETTER", "TRANSACTIONAL", "SECURITY", "EMERGENCY"
        ));
        requireOneOf("priorityClass", category.priorityClass, List.of(
                "LOW", "STANDARD", "HIGH", "URGENT", "CRITICAL", "EMERGENCY"
        ));
        requireOneOf("riskClass", category.riskClass, List.of("LOW", "MEDIUM", "HIGH", "CRITICAL", "REGULATED"));
    }

    private void requireOneOf(String field, String value, List<String> allowed) throws ValidationException {
        if (value == null || !allowed.contains(value.trim().toUpperCase())) {
            throw new ValidationException(field + " must be one of: " + String.join(", ", allowed));
        }
    }

    private void applyCategoryDefaults(NotificationCategory category) {
        if (category.defaultDeliveryMode == null || category.defaultDeliveryMode.isBlank()) {
            category.defaultDeliveryMode = "OPTIMIZED";
        } else {
            category.defaultDeliveryMode = category.defaultDeliveryMode.trim().toUpperCase();
        }

        if (category.messageCategory == null || category.messageCategory.isBlank()) {
            category.messageCategory = "GENERAL";
        } else {
            category.messageCategory = category.messageCategory.trim().toUpperCase();
        }

        if (category.priorityClass == null || category.priorityClass.isBlank()) {
            category.priorityClass = "STANDARD";
        } else {
            category.priorityClass = category.priorityClass.trim().toUpperCase();
        }

        if (category.riskClass == null || category.riskClass.isBlank()) {
            category.riskClass = "LOW";
        } else {
            category.riskClass = category.riskClass.trim().toUpperCase();
        }

        if (category.allowedChannels != null) {
            category.allowedChannels = category.allowedChannels.stream()
                    .filter(channel -> channel != null && !channel.isBlank())
                    .map(channel -> channel.trim().toUpperCase())
                    .distinct()
                    .toList();
        }

        if (category.businessValue == null) {
            category.businessValue = 5.0;
        }
        if (category.urgency == null) {
            category.urgency = 0.4;
        }
        if (category.maxDelayHours == null) {
            category.maxDelayHours = 24;
        }
        if (category.quietHoursRespect == null) {
            category.quietHoursRespect = true;
        }
        if (category.active == null) {
            category.active = true;
        }
    }

    private String organizationId(APIGatewayV2HTTPEvent event) {
        if (event != null && event.getHeaders() != null) {
            String header = event.getHeaders().get("x-organization-id");
            if (header == null) {
                header = event.getHeaders().get("X-Organization-Id");
            }
            if (header != null && !header.isBlank()) {
                return header.trim();
            }
        }
        return "default";
    }

    private String organizationIdFromEvent(JsonNode event) {
        String organizationId = text(event, "organizationId");
        return organizationId == null || organizationId.isBlank() ? "default" : organizationId.trim();
    }

    private String text(JsonNode node, String field) {
        if (node == null || !node.hasNonNull(field)) {
            return null;
        }
        return node.get(field).asText(null);
    }

    private void putMissing(ObjectNode node, String field, String value) {
        if (!node.hasNonNull(field) && value != null && !value.isBlank()) {
            node.put(field, value);
        }
    }

    private void putMissing(ObjectNode node, String field, Double value) {
        if (!node.hasNonNull(field) && value != null) {
            node.put(field, value);
        }
    }

    private void putMissing(ObjectNode node, String field, Integer value) {
        if (!node.hasNonNull(field) && value != null) {
            node.put(field, value);
        }
    }

    private void putMissing(ObjectNode node, String field, Boolean value) {
        if (!node.hasNonNull(field) && value != null) {
            node.put(field, value);
        }
    }

    private void putIfPresent(ObjectNode node, String field, String value) {
        if (value != null && !value.isBlank()) {
            node.put(field, value);
        }
    }

    private void putIfPresent(ObjectNode node, String field, Double value) {
        if (value != null) {
            node.put(field, value);
        }
    }

    private void putIfPresent(ObjectNode node, String field, Integer value) {
        if (value != null) {
            node.put(field, value);
        }
    }

    private void putIfPresent(ObjectNode node, String field, Boolean value) {
        if (value != null) {
            node.put(field, value);
        }
    }

    private void copyIfPresent(ObjectNode source, ObjectNode target, String field) {
        if (source.hasNonNull(field)) {
            target.set(field, source.get(field));
        }
    }

    private void markOverride(ObjectNode overrides, ObjectNode originalNotification, String field, String defaultValue) {
        if (originalNotification.hasNonNull(field)) {
            String requested = originalNotification.get(field).asText("");
            overrides.put(field, defaultValue == null || !requested.equalsIgnoreCase(defaultValue));
        }
    }

    private void markOverride(ObjectNode overrides, ObjectNode originalNotification, String field, Double defaultValue) {
        if (originalNotification.hasNonNull(field)) {
            double requested = originalNotification.get(field).asDouble();
            overrides.put(field, defaultValue == null || Math.abs(requested - defaultValue) > 0.0001);
        }
    }

    private void markOverride(ObjectNode overrides, ObjectNode originalNotification, String field, Integer defaultValue) {
        if (originalNotification.hasNonNull(field)) {
            int requested = originalNotification.get(field).asInt();
            overrides.put(field, defaultValue == null || requested != defaultValue);
        }
    }

    private void markOverride(ObjectNode overrides, ObjectNode originalNotification, String field, Boolean defaultValue) {
        if (originalNotification.hasNonNull(field)) {
            boolean requested = originalNotification.get(field).asBoolean();
            overrides.put(field, defaultValue == null || requested != defaultValue);
        }
    }

    /**
     * Extract userId from path like /v1/users/{userId}
     */
    private String extractUserId(String path) {
        return path.substring(path.lastIndexOf('/') + 1);
    }

    private String extractPathId(String path) {
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
