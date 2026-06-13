import { Stack,
    type StackProps, aws_apigatewayv2 as apigwv2, aws_apigatewayv2_integrations as apigwInt, aws_cognito as cognito, aws_lambda as lambda, aws_lambda_nodejs as lnode, aws_iam as iam, aws_events as events, aws_events_targets as targets, aws_kms as kms, aws_ec2 as ec2 } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';

import { Construct } from 'constructs';
import { DataStack } from './data-stack';
import { MessagingStack } from './messaging-stack';
import {HttpJwtAuthorizer} from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import {HttpLambdaIntegration} from "aws-cdk-lib/aws-apigatewayv2-integrations";


interface Props extends StackProps { vpc: ec2.IVpc, kmsKey: kms.IKey, data: DataStack, identity: any, messaging?: MessagingStack }

export class ComputeStack extends Stack {
    constructor(scope: Construct, id: string, { vpc, kmsKey, data, identity, messaging, ...props }: Props){
        super(scope,id,props);

        // Lambda: controlPlane (Java zip you will build at services/control-plane)
        const controlPlane = new lambda.Function(this,'ControlPlaneFn',{
            runtime: lambda.Runtime.JAVA_21,
            handler: 'com.yadab.sr.controlplane.Handler::handleRequest',
            code: lambda.Code.fromAsset('../../services/control-plane/target/control-plane.jar'),
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
            code: lambda.Code.fromAsset('../../services/events-consumer/target/events-consumer.jar'),
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
        // Get sender email from environment variable or use a placeholder
        const senderEmail = process.env.SENDER_EMAIL || 'CHANGE_ME@example.com';

        const senderFn = new lambda.Function(this,'SenderFn',{
            runtime: lambda.Runtime.JAVA_21,
            handler: 'com.yadab.sr.sender.Handler::handleRequest',
            code: lambda.Code.fromAsset('../../services/sender-service/target/sender-service.jar'),
            memorySize: 1024, timeout: cdk.Duration.seconds(20), vpc,
            environment: {
                USER_PROFILES_TABLE: data.profilesTable.tableName,
                CURATED_BUCKET: data.curatedBucket.bucketName,
                PINPOINT_APP_ID: messaging?.pinpointAppId || 'PLACEHOLDER', // Automatically from MessagingStack, or placeholder if not deployed yet
                DEFAULT_FROM_ADDRESS: senderEmail // Configurable via SENDER_EMAIL environment variable
            }
        });
        data.curatedBucket.grantRead(senderFn); // templates
        data.profilesTable.grantReadData(senderFn); // read user profiles

        // Multi-channel permissions: SES + SNS + Pinpoint (legacy)
        senderFn.addToRolePolicy(new iam.PolicyStatement({
            actions:[
                'ses:SendEmail',           // SES v2 email sending
                'ses:SendRawEmail',
                'sns:Publish',             // SNS SMS sending
                'mobiletargeting:SendMessages'  // Pinpoint (legacy, optional)
            ],
            resources:['*'] // Can be narrowed to specific SES identities and SNS topics
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
            code: lambda.Code.fromAsset('../../services/decision-service/target/decision-service.jar'),
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
        // EventBridge Scheduler permissions for Decision Lambda to create schedules
        decisionFn.addToRolePolicy(new iam.PolicyStatement({
            actions:[
                'scheduler:CreateSchedule',
                'scheduler:GetSchedule',
                'scheduler:DeleteSchedule',
                'scheduler:UpdateSchedule'
            ],
            resources:['*'] // or arn:aws:scheduler:region:account:schedule/default/*
        }));
        // Allow Decision Lambda to pass the scheduler role to EventBridge Scheduler
        decisionFn.addToRolePolicy(new iam.PolicyStatement({
            actions:['iam:PassRole'],
            resources:[schedulerRole.roleArn]
        }));

        // Update Events Consumer with Lambda ARNs for auto-triggering notifications
        eventsConsumer.addEnvironment('SENDER_FUNCTION_ARN', senderFn.functionArn);
        eventsConsumer.addEnvironment('DECISION_FUNCTION_ARN', decisionFn.functionArn);
        senderFn.grantInvoke(eventsConsumer);
        decisionFn.grantInvoke(eventsConsumer);


        // Common
        // (Optional) decisionFn wired later; for sprint 1 we only need health + events

        // API HTTP API with CORS configuration
        const httpApi = new apigwv2.HttpApi(this,'HttpApi',{
            corsPreflight: {
                allowOrigins: [
                    'http://localhost:5173', // Vite dev server
                    'http://localhost:3000', // Alternative dev port
                    // CloudFront URL will be added after deployment
                ],
                allowMethods: [
                    apigwv2.CorsHttpMethod.GET,
                    apigwv2.CorsHttpMethod.POST,
                    apigwv2.CorsHttpMethod.PUT,
                    apigwv2.CorsHttpMethod.DELETE,
                    apigwv2.CorsHttpMethod.OPTIONS,
                ],
                allowHeaders: [
                    'Content-Type',
                    'Authorization',
                    'X-Amz-Date',
                    'X-Api-Key',
                    'X-Amz-Security-Token',
                ],
                allowCredentials: true,
                maxAge: cdk.Duration.days(1),
            }
        });


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


        // User Management Routes
        new apigwv2.HttpRoute(this, 'CreateUserRoute', {
            httpApi,
            routeKey: apigwv2.HttpRouteKey.with('/v1/users', apigwv2.HttpMethod.POST),
            integration: integ,
            authorizer: jwtAuth,
        });

        new apigwv2.HttpRoute(this, 'GetUserRoute', {
            httpApi,
            routeKey: apigwv2.HttpRouteKey.with('/v1/users/{id}', apigwv2.HttpMethod.GET),
            integration: integ,
            authorizer: jwtAuth,
        });

        new apigwv2.HttpRoute(this, 'UpdateUserRoute', {
            httpApi,
            routeKey: apigwv2.HttpRouteKey.with('/v1/users/{id}', apigwv2.HttpMethod.PUT),
            integration: integ,
            authorizer: jwtAuth,
        });

        new apigwv2.HttpRoute(this, 'DeleteUserRoute', {
            httpApi,
            routeKey: apigwv2.HttpRouteKey.with('/v1/users/{id}', apigwv2.HttpMethod.DELETE),
            integration: integ,
            authorizer: jwtAuth,
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

        // Analytics Lambda functions ================================================
        const analyticsMetricsFn = new lambda.Function(this, 'AnalyticsMetricsFn', {
            runtime: lambda.Runtime.JAVA_21,
            handler: 'com.yadab.sr.analytics.MetricsHandler::handleRequest',
            code: lambda.Code.fromAsset('../../services/analytics-service/target/analytics-service.jar'),
            memorySize: 1024,
            timeout: cdk.Duration.seconds(15),
            vpc,
            environment: {
                USERS_TABLE_NAME: data.profilesTable.tableName,
            }
        });
        data.profilesTable.grantReadData(analyticsMetricsFn);

        const analyticsHealthFn = new lambda.Function(this, 'AnalyticsHealthFn', {
            runtime: lambda.Runtime.JAVA_21,
            handler: 'com.yadab.sr.analytics.SystemHealthHandler::handleRequest',
            code: lambda.Code.fromAsset('../../services/analytics-service/target/analytics-service.jar'),
            memorySize: 1024,
            timeout: cdk.Duration.seconds(15),
            vpc,
            environment: {
                API_ID: httpApi.apiId,
                KINESIS_STREAM_NAME: data.userEvents.streamName,
                SAGEMAKER_ENDPOINT_NAME: 'send-time-v1',
                SENDER_FUNCTION_NAME: senderFn.functionName,
            }
        });
        // Grant CloudWatch read permissions
        analyticsHealthFn.addToRolePolicy(new iam.PolicyStatement({
            actions: [
                'cloudwatch:GetMetricStatistics',
                'cloudwatch:ListMetrics',
            ],
            resources: ['*']
        }));

        // Analytics API routes
        const analyticsMetricsInteg = new apigwInt.HttpLambdaIntegration('AnalyticsMetricsInteg', analyticsMetricsFn);
        const analyticsHealthInteg = new apigwInt.HttpLambdaIntegration('AnalyticsHealthInteg', analyticsHealthFn);

        new apigwv2.HttpRoute(this, 'AnalyticsMetricsRoute', {
            httpApi,
            routeKey: apigwv2.HttpRouteKey.with('/v1/analytics/metrics', apigwv2.HttpMethod.GET),
            integration: analyticsMetricsInteg,
            authorizer: jwtAuth
        });

        new apigwv2.HttpRoute(this, 'AnalyticsHealthRoute', {
            httpApi,
            routeKey: apigwv2.HttpRouteKey.with('/v1/analytics/system-health', apigwv2.HttpMethod.GET),
            integration: analyticsHealthInteg,
            authorizer: jwtAuth
        });

        new cdk.CfnOutput(this, 'ApiUrl', { value: httpApi.apiEndpoint });
        new cdk.CfnOutput(this, 'SenderEmailAddress', { value: senderEmail, description: 'Email address used for sending notifications (must be verified in SES)' });
    }
}