package com.yadab.sr.endpointdeployer;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.LambdaLogger;

import software.amazon.awssdk.services.sagemaker.SageMakerClient;
import software.amazon.awssdk.services.sagemaker.model.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Lambda handler to automatically deploy or update a SageMaker endpoint
 * after training completes. Invoked by Step Functions.
 */
public class Handler implements RequestHandler<Map<String, Object>, Map<String, Object>> {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String ENDPOINT_NAME = "send-time-v1";
    private static final String XGBOOST_IMAGE = "246618743249.dkr.ecr.us-west-2.amazonaws.com/sagemaker-xgboost:1.7-1";
    private static final String SAGEMAKER_ROLE_ARN = System.getenv("SAGEMAKER_ROLE_ARN");

    private static final SageMakerClient sagemaker = SageMakerClient.builder().build();

    @Override
    public Map<String, Object> handleRequest(Map<String, Object> event, Context ctx) {
        LambdaLogger log = ctx.getLogger();
        log.log("Event: " + event);

        try {
            // Validate environment variables
            if (SAGEMAKER_ROLE_ARN == null || SAGEMAKER_ROLE_ARN.isEmpty()) {
                throw new IllegalStateException("SAGEMAKER_ROLE_ARN environment variable is not set");
            }
            log.log("SageMaker Role ARN: " + SAGEMAKER_ROLE_ARN);

            // Extract model artifact path from training job output
            String trainingJobName = (String) event.get("TrainingJobName");

            @SuppressWarnings("unchecked")
            Map<String, Object> modelArtifacts = (Map<String, Object>) event.get("ModelArtifacts");
            String modelDataUrl = (String) modelArtifacts.get("S3ModelArtifacts");

            if (modelDataUrl == null || modelDataUrl.isEmpty()) {
                throw new IllegalArgumentException("ModelArtifacts.S3ModelArtifacts not found in event");
            }

            log.log("Training job: " + trainingJobName);
            log.log("Model artifact: " + modelDataUrl);

            // Generate unique names with timestamp
            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss"));
            String modelName = "send-time-model-" + timestamp;
            String endpointConfigName = "send-time-config-" + timestamp;

            // Create SageMaker Model
            log.log("Creating SageMaker model: " + modelName);
            createModel(modelName, modelDataUrl, log);

            // Create Endpoint Configuration
            log.log("Creating endpoint configuration: " + endpointConfigName);
            createEndpointConfig(endpointConfigName, modelName, log);

            // Check if endpoint exists
            boolean endpointExists = doesEndpointExist(ENDPOINT_NAME, log);

            // Create or Update Endpoint
            if (endpointExists) {
                log.log("Endpoint " + ENDPOINT_NAME + " exists, updating");
                updateEndpoint(ENDPOINT_NAME, endpointConfigName, log);
            } else {
                log.log("Endpoint " + ENDPOINT_NAME + " doesn't exist, creating");
                createEndpoint(ENDPOINT_NAME, endpointConfigName, log);
            }

            // Return result
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("EndpointName", ENDPOINT_NAME);
            result.put("EndpointConfigName", endpointConfigName);
            result.put("ModelName", modelName);
            result.put("Status", endpointExists ? "Updating" : "Creating");

            return result;

        } catch (Exception e) {
            log.log("ERROR: " + e.getClass().getName() + ": " + e.getMessage());
            if (e.getCause() != null) {
                log.log("CAUSE: " + e.getCause().getClass().getName() + ": " + e.getCause().getMessage());
            }
            e.printStackTrace();

            // Return error details for debugging
            Map<String, Object> errorResult = new LinkedHashMap<>();
            errorResult.put("error", e.getClass().getSimpleName());
            errorResult.put("message", e.getMessage());
            errorResult.put("cause", e.getCause() != null ? e.getCause().getMessage() : null);
            throw new RuntimeException("Failed to deploy endpoint: " + e.getMessage(), e);
        }
    }

    private void createModel(String modelName, String modelDataUrl, LambdaLogger log) {
        try {
            ContainerDefinition container = ContainerDefinition.builder()
                    .image(XGBOOST_IMAGE)
                    .modelDataUrl(modelDataUrl)
                    .build();

            CreateModelRequest request = CreateModelRequest.builder()
                    .modelName(modelName)
                    .executionRoleArn(SAGEMAKER_ROLE_ARN)
                    .primaryContainer(container)
                    .build();

            sagemaker.createModel(request);
            log.log("Model created: " + modelName);
        } catch (Exception e) {
            log.log("ERROR creating model: " + e.getMessage());
            throw new RuntimeException("Failed to create SageMaker model: " + e.getMessage(), e);
        }
    }

    private void createEndpointConfig(String endpointConfigName, String modelName, LambdaLogger log) {
        try {
            ProductionVariant variant = ProductionVariant.builder()
                    .variantName("main")
                    .modelName(modelName)
                    .initialInstanceCount(1)
                    .instanceType("ml.m5.large")
                    .initialVariantWeight(1.0f)
                    .build();

            CreateEndpointConfigRequest request = CreateEndpointConfigRequest.builder()
                    .endpointConfigName(endpointConfigName)
                    .productionVariants(variant)
                    .build();

            sagemaker.createEndpointConfig(request);
            log.log("Endpoint config created: " + endpointConfigName);
        } catch (Exception e) {
            log.log("ERROR creating endpoint config: " + e.getMessage());
            throw new RuntimeException("Failed to create endpoint config: " + e.getMessage(), e);
        }
    }

    private boolean doesEndpointExist(String endpointName, LambdaLogger log) {
        try {
            log.log("Checking if endpoint exists: " + endpointName);
            DescribeEndpointRequest request = DescribeEndpointRequest.builder()
                    .endpointName(endpointName)
                    .build();
            DescribeEndpointResponse response = sagemaker.describeEndpoint(request);
            log.log("Endpoint exists with status: " + response.endpointStatus());
            return true;
        } catch (ResourceNotFoundException e) {
            log.log("Endpoint does not exist (ResourceNotFoundException)");
            return false;
        } catch (Exception e) {
            log.log("Unexpected error checking endpoint: " + e.getClass().getName() + ": " + e.getMessage());
            // Treat any other error as endpoint not existing
            return false;
        }
    }

    private void createEndpoint(String endpointName, String endpointConfigName, LambdaLogger log) {
        try {
            CreateEndpointRequest request = CreateEndpointRequest.builder()
                    .endpointName(endpointName)
                    .endpointConfigName(endpointConfigName)
                    .build();

            sagemaker.createEndpoint(request);
            log.log("Endpoint creation initiated: " + endpointName);
        } catch (Exception e) {
            log.log("ERROR creating endpoint: " + e.getMessage());
            throw new RuntimeException("Failed to create endpoint: " + e.getMessage(), e);
        }
    }

    private void updateEndpoint(String endpointName, String endpointConfigName, LambdaLogger log) {
        try {
            UpdateEndpointRequest request = UpdateEndpointRequest.builder()
                    .endpointName(endpointName)
                    .endpointConfigName(endpointConfigName)
                    .build();

            sagemaker.updateEndpoint(request);
            log.log("Endpoint update initiated: " + endpointName);
        } catch (Exception e) {
            log.log("ERROR updating endpoint: " + e.getMessage());
            throw new RuntimeException("Failed to update endpoint: " + e.getMessage(), e);
        }
    }
}
