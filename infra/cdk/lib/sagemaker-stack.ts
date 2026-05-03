// SageMakerStack.ts
//
// ⚠️ DEPRECATED: This stack is no longer actively used
//
// Endpoint deployment is now automated via the ML pipeline (SR-ML stack)
// After training completes, the endpoint-deployer Lambda automatically creates/updates
// the endpoint with the newly trained model.
//
// This stack is kept for optional manual deployments (e.g., rollbacks, specific model versions)
// To use: Uncomment in bin/app.ts and deploy with:
//   cdk deploy SR-SageMaker -c modelPath=training-output/send-time-xxx/output/model.tar.gz
//
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sagemaker from 'aws-cdk-lib/aws-sagemaker';
import {MlStack} from "./ml-stack";
import {DataStack} from "./data-stack";

export interface SageMakerStackProps extends StackProps {
    data: DataStack;
    ml: MlStack;
}

export class SageMakerStack extends Stack {
    constructor(scope: Construct, id: string, {data, ml, ...props}: SageMakerStackProps) {
        super(scope, id, props);

        // CDK Tip: If deploying to a new AWS account/region, run `cdk bootstrap` first to prepare the environment.
        const region = Stack.of(this).region;

        // Get model path from CDK context or use default
        // To deploy with a specific model: cdk deploy SR-SageMaker -c modelPath=training-output/send-time-xxx/output/model.tar.gz
        const modelPath = this.node.tryGetContext('modelPath') || 'training-output/REPLACE_WITH_YOUR_MODEL_PATH/output/model.tar.gz';
        const modelDataUrl = `s3://${data.modelsBucket.bucketName}/${modelPath}`;

        console.log(`Deploying SageMaker endpoint with model: ${modelDataUrl}`);

        const imageUri =  '246618743249.dkr.ecr.us-west-2.amazonaws.com/sagemaker-xgboost:1.7-1'

        // Generate unique names for the model and endpoint config using a timestamp suffix
        const timestamp = Date.now().toString();
        const modelName = `send-time-model-${timestamp}`;
        const endpointConfigName = `send-time-config-${timestamp}`;
        const endpointName = 'send-time-v1';

        // Create SageMaker Model resource
        const model = new sagemaker.CfnModel(this, 'SageMakerModel', {
            modelName: modelName,
            executionRoleArn: ml.sagemakerRole.roleArn,
            primaryContainer: {
                image: imageUri,
                modelDataUrl: modelDataUrl
            }
        });

        // Create SageMaker Endpoint Configuration resource with one production variant
        const endpointConfig = new sagemaker.CfnEndpointConfig(this, 'SageMakerEndpointConfig', {
            endpointConfigName: endpointConfigName,
            productionVariants: [{
                modelName: modelName,
                variantName: 'main',
                initialInstanceCount: 1,
                instanceType: 'ml.m5.large',
                initialVariantWeight: 1.0
            }]
        });
        // Ensure the EndpointConfig is created after the Model
        endpointConfig.node.addDependency(model);

        // Create SageMaker Endpoint resource (named endpoint)
        const endpoint = new sagemaker.CfnEndpoint(this, 'SageMakerEndpoint', {
            endpointName: endpointName,
            endpointConfigName: endpointConfig.attrEndpointConfigName
        });
        // Ensure the Endpoint is created after the EndpointConfig
        endpoint.node.addDependency(endpointConfig);
    }
}
