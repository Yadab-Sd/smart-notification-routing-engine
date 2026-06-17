import * as cdk from 'aws-cdk-lib';
import {
    aws_pinpoint as pinpoint,
    aws_sns as sns,
    aws_sns_subscriptions as subscriptions,
    aws_lambda as lambda,
    aws_dynamodb as dynamodb,
    aws_iam as iam,
    type StackProps
} from 'aws-cdk-lib';
import {Construct} from "constructs";
import {SESConfiguration} from './ses-configuration';

export class MessagingStack extends cdk.Stack {
    public readonly pinpointAppId: string;
    public readonly sesBounceTopic: sns.Topic;
    public readonly sesComplaintTopic: sns.Topic;
    public readonly suppressionTable: dynamodb.Table;
    public readonly sesEventsTable: dynamodb.Table;

    constructor(scope: Construct, id: string, props: StackProps) {
        super(scope, id, props);

        // ============================================================
        // SES BOUNCE AND COMPLAINT HANDLING (Required for Production)
        // ============================================================

        // 1. SNS Topics for SES notifications
        this.sesBounceTopic = new sns.Topic(this, 'SESBounceTopic', {
            displayName: 'SES Bounce Notifications',
            topicName: 'ses-bounces'
        });

        this.sesComplaintTopic = new sns.Topic(this, 'SESComplaintTopic', {
            displayName: 'SES Complaint (Spam) Notifications',
            topicName: 'ses-complaints'
        });

        // 2. DynamoDB table for email suppression list
        this.suppressionTable = new dynamodb.Table(this, 'EmailSuppressionList', {
            tableName: 'email-suppression-list',
            partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            timeToLiveAttribute: 'ttl', // Auto-delete old entries
            removalPolicy: cdk.RemovalPolicy.RETAIN, // Don't delete on stack destroy
            pointInTimeRecovery: true, // Backup/restore capability
        });

        // Global Secondary Index for querying by reason
        this.suppressionTable.addGlobalSecondaryIndex({
            indexName: 'reason-index',
            partitionKey: { name: 'reason', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'suppressedAt', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL
        });

        // 3. DynamoDB table for SES event logs (compliance)
        this.sesEventsTable = new dynamodb.Table(this, 'SESEventLogs', {
            tableName: 'ses-event-logs',
            partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            timeToLiveAttribute: 'ttl', // Auto-delete old logs
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES // For analytics
        });

        // 4. Lambda function to process bounces and complaints
        const sesEventProcessor = new lambda.Function(this, 'SESEventProcessor', {
            runtime: lambda.Runtime.JAVA_21,
            handler: 'com.yadab.sr.sesevent.Handler::handleRequest',
            code: lambda.Code.fromAsset('../../services/ses-event-processor/target/ses-event-processor.jar'),
            timeout: cdk.Duration.seconds(30),
            memorySize: 512,
            environment: {
                SUPPRESSION_TABLE: this.suppressionTable.tableName,
                SES_EVENTS_TABLE: this.sesEventsTable.tableName,
                USER_PROFILES_TABLE: '{{USER_PROFILES_TABLE}}' // Will be updated by compute stack
            },
            description: 'Processes SES bounce and complaint notifications'
        });

        // Grant permissions
        this.suppressionTable.grantReadWriteData(sesEventProcessor);
        this.sesEventsTable.grantReadWriteData(sesEventProcessor);

        // 5. Subscribe Lambda to SNS topics
        this.sesBounceTopic.addSubscription(new subscriptions.LambdaSubscription(sesEventProcessor));
        this.sesComplaintTopic.addSubscription(new subscriptions.LambdaSubscription(sesEventProcessor));

        // 6. Allow SNS to invoke Lambda
        sesEventProcessor.addPermission('AllowSNSInvoke', {
            principal: new iam.ServicePrincipal('sns.amazonaws.com'),
            sourceArn: this.sesBounceTopic.topicArn
        });

        sesEventProcessor.addPermission('AllowSNSInvokeComplaints', {
            principal: new iam.ServicePrincipal('sns.amazonaws.com'),
            sourceArn: this.sesComplaintTopic.topicArn
        });

        // 7. Create SES Configuration Set with event destinations
        new SESConfiguration(this, 'SESConfig', this);

        // ============================================================
        // PINPOINT (Optional - for legacy multi-channel support)
        // ============================================================

        // Pinpoint app (project) - ONLY for transactional messaging (SendMessages API)
        // NOTE: AWS is deprecating Pinpoint engagement features (campaigns, segments, analytics) on Oct 30, 2026
        // We only use Pinpoint for transactional email sending, which should still be supported
        const ppApp = new pinpoint.CfnApp(this, 'PinpointApp', {name: 'SR-Pinpoint-app'});

        // Export Pinpoint App ID for use by other stacks
        this.pinpointAppId = ppApp.ref;

        // ============================================================
        // OUTPUTS
        // ============================================================

        new cdk.CfnOutput(this, 'PinpointAppId', {
            value: ppApp.ref,
            description: 'Pinpoint Application ID (legacy)'
        });

        new cdk.CfnOutput(this, 'BounceTopicArn', {
            value: this.sesBounceTopic.topicArn,
            description: 'SNS topic ARN for SES bounces',
            exportName: 'SES-BounceTopicArn'
        });

        new cdk.CfnOutput(this, 'ComplaintTopicArn', {
            value: this.sesComplaintTopic.topicArn,
            description: 'SNS topic ARN for SES complaints',
            exportName: 'SES-ComplaintTopicArn'
        });

        new cdk.CfnOutput(this, 'SuppressionTableName', {
            value: this.suppressionTable.tableName,
            description: 'DynamoDB table for email suppression list',
            exportName: 'SES-SuppressionTableName'
        });

        new cdk.CfnOutput(this, 'SESEventProcessorArn', {
            value: sesEventProcessor.functionArn,
            description: 'Lambda function ARN for SES event processing'
        });
    }
}