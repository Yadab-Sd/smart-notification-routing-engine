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
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.GetItemRequest;
import software.amazon.awssdk.services.dynamodb.model.UpdateItemRequest;
import software.amazon.awssdk.services.dynamodb.model.GetItemResponse;
import software.amazon.awssdk.regions.Region;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Map;


public class Handler implements RequestHandler<APIGatewayV2HTTPEvent, APIGatewayV2HTTPResponse> {
    private static final KinesisClient kinesis = KinesisClient.create();

    private static APIGatewayV2HTTPResponse ok(String body){
        return APIGatewayV2HTTPResponse.builder().withStatusCode(200).withBody(body).build();
    }
    private static APIGatewayV2HTTPResponse resp(int code, String body){
        return APIGatewayV2HTTPResponse.builder().withStatusCode(code).withBody(body).build();
    }
    private static APIGatewayV2HTTPResponse json(int code, String body){
        return APIGatewayV2HTTPResponse.builder()
                .withStatusCode(code)
                .withHeaders(Map.of("Content-Type","application/json"))
                .withBody(body)
                .build();
    }
    private static String table(){ return System.getenv("USER_TABLE"); }

    private final DynamoDbClient ddb = DynamoDbClient.builder()
            // .endpointOverride(URI.create("http://localhost:8000")) // uncomment for local testing
            .region(Region.of(System.getenv("AWS_REGION"))) // automatically picks region from Lambda
            .build();

    @Override public APIGatewayV2HTTPResponse handleRequest(APIGatewayV2HTTPEvent e, Context ctx){
        String path = e.getRequestContext().getHttp().getPath();
        String method = e.getRequestContext().getHttp().getMethod();

        // health check
        if ("/v1/health".equals(path)) return ok("ok");

        // ingest events -> kinesis
        if ("/v1/events".equals(path) && "POST".equals(method)){
            String stream = System.getenv("USER_EVENTS_STREAM");
            kinesis.putRecord(PutRecordRequest.builder()
                    .streamName(stream)
                    .partitionKey("p")
                    .data(SdkBytes.fromUtf8String(e.getBody()))
                    .build());
            return ok("queued");
        }


        // GET /v1/users/{id}
        if (path.matches("/v1/users/[^/]+") && "GET".equals(method)) {
            String userId = path.substring(path.lastIndexOf('/') + 1);
            Map<String, AttributeValue> key = Map.of(
                    "pk", AttributeValue.builder().s("USER#"+userId).build(),
                    "sk", AttributeValue.builder().s("PROFILE").build()
            );
            GetItemRequest req = GetItemRequest.builder().tableName(table()).key(key).build();
            GetItemResponse res = ddb.getItem(req);
            if (!res.hasItem() || res.item().isEmpty()) {
                return json(404, "{}");
            } else {
                try {
                    User user = User.fromItem(res.item());
                    String body = new ObjectMapper().writeValueAsString(user);
                    return json(200, body);
                } catch (Exception ex) {
                    return json(500, "{\"message\": \"" + ex.getMessage() + "\"}");
                }
            }
        }

        // PUT /v1/users/{id}/preferences
        if (path.matches("/v1/users/[^/]+/preferences") && "PUT".equals(method)) {
            String[] parts = path.split("/");
            String userId = parts[3]; // /v1/users/{id}/preferences
            String body = e.getBody();
            if (body == null) return resp(400, "empty body");

            Map<String, AttributeValue> key = Map.of(
                    "pk", AttributeValue.builder().s("USER#"+userId).build(),
                    "sk", AttributeValue.builder().s("PROFILE").build()
            );
            // Store prefs as raw JSON string in attribute "prefs" (simple approach) // later can JSOn -> Map conversion with schema
            Map<String, AttributeValue> exprVals = Map.of(":p", AttributeValue.builder().s(body).build());
            UpdateItemRequest upr = UpdateItemRequest.builder()
                    .tableName(table())
                    .key(key)
                    .updateExpression("SET prefs = :p")
                    .expressionAttributeValues(exprVals)
                    .build();
            ddb.updateItem(upr);
            return json(200, "{\"ok\": true}");
        }
        return resp(404, "not found");
    }
}