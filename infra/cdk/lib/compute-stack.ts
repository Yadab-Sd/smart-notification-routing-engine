import { Stack,
    type StackProps, aws_apigatewayv2 as apigwv2, aws_apigatewayv2_integrations as apigwInt, aws_cognito as cognito, aws_lambda as lambda, aws_lambda_nodejs as lnode, aws_iam as iam, aws_events as events, aws_events_targets as targets, aws_kms as kms, aws_ec2 as ec2 } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';

import { Construct } from 'constructs';
import { DataStack } from './data-stack';
import {HttpJwtAuthorizer} from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import {HttpLambdaIntegration} from "aws-cdk-lib/aws-apigatewayv2-integrations";


interface Props extends StackProps { vpc: ec2.IVpc, kmsKey: kms.IKey, data: DataStack, identity: any }

export class ComputeStack extends Stack {
    constructor(scope: Construct, id: string, { vpc, kmsKey, data, identity, ...props }: Props){
        super(scope,id,props);

        // Lambda: controlPlane (Java zip you will build at services/control-plane)
        const controlPlane = new lambda.Function(this,'ControlPlaneFn',{
            runtime: lambda.Runtime.JAVA_21,
            handler: 'com.yadab.sr.controlplane.Handler::handleRequest',
            code: lambda.Code.fromAsset('../../services/control-plane/target/control-plane.zip'),
            timeout: cdk.Duration.seconds(15),
            memorySize: 1024,
            environment: { USER_EVENTS_STREAM: data.userEvents.streamName },
            snapStart: lambda.SnapStartConf.ON_PUBLISHED_VERSIONS, // <-- fix
            vpc
        });
        // Permissions
        data.userEvents.grantWrite(controlPlane);
        data.profilesTable.grantReadWriteData(controlPlane);
        controlPlane.addEnvironment('USER_TABLE', data.profilesTable.tableName);

        // Lambda: eventsConsumer (Java zip you will build at services/events-consumer)
        const eventsConsumer = new lambda.Function(this,'EventsConsumerFn',{
            runtime: lambda.Runtime.JAVA_21,
            handler: 'com.yadab.sr.eventsconsumer.Handler::handleRequest',
            code: lambda.Code.fromAsset('../../services/events-consumer/target/events-consumer.zip'),
            timeout: cdk.Duration.seconds(30),
            memorySize: 512,
            environment: {
                EVENTS_BUCKET: data.eventsBucket.bucketName,
                USER_TABLE: data.profilesTable.tableName,
            }, vpc
        });
        // Permissions
        data.userEvents.grantRead(eventsConsumer);
        data.eventsBucket.grantPut(eventsConsumer);
        data.profilesTable.grantReadWriteData(eventsConsumer);
        // Subscribe to Kinesis stream
        new lambda.EventSourceMapping(this,'EventsConsumerESM',{
            target: eventsConsumer,
            eventSourceArn: data.userEvents.streamArn,
            startingPosition: lambda.StartingPosition.LATEST,
            batchSize: 100,
            enabled: true
        });


        // Sender Lambda - render S3 template, send via Pinpoint ==========================================
        const senderFn = new lambda.Function(this,'SenderFn',{
            runtime: lambda.Runtime.JAVA_21,
            handler: 'com.yadab.sr.sender.Handler::handleRequest',
            code: lambda.Code.fromAsset('../../services/sender-service/target/sender.zip'),
            memorySize: 1024, timeout: cdk.Duration.seconds(20), vpc
        });
        data.curatedBucket.grantRead(senderFn); // templates
        senderFn.addToRolePolicy(new iam.PolicyStatement({
            actions:['mobiletargeting:SendMessages'],
            resources:['*'] // or restrict to your Pinpoint app ARN
        }));

        // Role that EventBridge Scheduler assumes to invoke senderFn
        const schedulerRole = new iam.Role(this,'SchedulerInvokeSender',{
            assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com')
        });
        senderFn.grantInvoke(schedulerRole);
        new cdk.CfnOutput(this,'SchedulerRoleArn',{ value: schedulerRole.roleArn });
        new cdk.CfnOutput(this,'SenderFnArn',{ value: senderFn.functionArn });


        //     3) Decision Lambda (Java 21) — preview & schedule ================================================
        const decisionFn = new lambda.Function(this,'DecisionFn',{
            runtime: lambda.Runtime.JAVA_21,
            handler: 'com.yadab.sr.decision.Handler::handleRequest',
            code: lambda.Code.fromAsset('../../services/decision-service/target/decision.zip'),
            memorySize: 1024, timeout: cdk.Duration.seconds(20), vpc,
            environment: {
                USER_PROFILES_TABLE: data.profilesTable.tableName,
                SENDTIME_ENDPOINT: 'send-time-v1', // your SageMaker endpoint name from Sprint 3
                SENDER_FUNCTION_ARN: senderFn.functionArn,
                SCHEDULER_ROLE_ARN: schedulerRole.roleArn
            }
        });
        data.profilesTable.grantReadData(decisionFn);
        decisionFn.addToRolePolicy(new iam.PolicyStatement({
            actions:['sagemaker:InvokeEndpoint'], resources:['*'] // narrow later
        }));



        // Common
        // (Optional) decisionFn wired later; for sprint 1 we only need health + events

        // API HTTP API
        const httpApi = new apigwv2.HttpApi(this,'HttpApi');


        // Cognito authorizer
        const authorizer = new apigwv2.CfnAuthorizer(this,'JwtAuth',{
            apiId: httpApi.apiId,
            authorizerType:'JWT',
            identitySource:['$request.header.Authorization'],
            name:'CognitoJWT',
            jwtConfiguration:{ audience:[identity.userPoolClient.userPoolClientId], issuer:`https://cognito-idp.${this.region}.amazonaws.com/${identity.userPool.userPoolId}` }
        });

        // L2 Cognito JWT authorizer
        const issuer = `https://cognito-idp.${this.region}.amazonaws.com/${identity.userPool.userPoolId}`;
        const audience = [identity.userPoolClient.userPoolClientId];
        const jwtAuth = new HttpJwtAuthorizer('CognitoJWT', issuer, { jwtAudience: audience });

        const integ = new HttpLambdaIntegration('CP-Integration', controlPlane);
        const decisionInteg = new apigwInt.HttpLambdaIntegration('DecisionInteg', decisionFn);

        new apigwv2.HttpRoute(this, 'HealthRoute', {
            httpApi,
            routeKey: apigwv2.HttpRouteKey.with('/v1/health', apigwv2.HttpMethod.GET),
            integration: integ, // public route
        });

        new apigwv2.HttpRoute(this, 'EventsRoute', {
            httpApi,
            routeKey: apigwv2.HttpRouteKey.with('/v1/events', apigwv2.HttpMethod.POST),
            integration: integ,
            authorizer: jwtAuth, // ✅ L2 authorizer (has .bind)
        });


        new apigwv2.HttpRoute(this,'GetUserRoute',{
            httpApi,
            routeKey: apigwv2.HttpRouteKey.with('/v1/users/{id}', apigwv2.HttpMethod.GET),
            integration: integ,
            authorizer: jwtAuth, // ✅ L2 authorizer (has .bind)
        });
        new apigwv2.HttpRoute(this,'PutPrefsRoute',{
            httpApi,
            routeKey: apigwv2.HttpRouteKey.with('/v1/users/{id}/preferences', apigwv2.HttpMethod.PUT),
            integration: integ,
            authorizer: jwtAuth, // ✅ L2 authorizer (has .bind)
        });

        // Add API routes (JWT auth same authorizer as before) -
        new apigwv2.HttpRoute(this,'DecisionPreview',{
            httpApi,
            routeKey: apigwv2.HttpRouteKey.with('/v1/decisions/preview', apigwv2.HttpMethod.POST),
            integration: decisionInteg,
            authorizer: jwtAuth
        });
        new apigwv2.HttpRoute(this,'DecisionSchedule',{
            httpApi,
            routeKey: apigwv2.HttpRouteKey.with('/v1/decisions/schedule', apigwv2.HttpMethod.POST),
            integration: decisionInteg,
            authorizer: jwtAuth
        });

        new cdk.CfnOutput(this, 'ApiUrl', { value: httpApi.apiEndpoint });
    }
}