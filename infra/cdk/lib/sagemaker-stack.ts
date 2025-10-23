// SageMakerStack.ts
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
        const modelDataUrl = 's3://sr-data-modelsc55d3500-p76bdxaj5h8s/training-output/send-time-d96d3a88-84ed-4574-9cd2-da9740d90ffb/output/model.tar.gz'; // TODO: Check if the subderectory can change
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
