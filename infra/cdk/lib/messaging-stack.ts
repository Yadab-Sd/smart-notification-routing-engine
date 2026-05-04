import * as cdk from 'aws-cdk-lib';
import {
    aws_pinpoint as pinpoint, type StackProps
} from 'aws-cdk-lib';
import {Construct} from "constructs";

export class MessagingStack extends cdk.Stack {
    public readonly pinpointAppId: string;

    constructor(scope: Construct, id: string, props: StackProps) {
        super(scope, id, props);

        // Pinpoint app (project) - ONLY for transactional messaging (SendMessages API)
        // NOTE: AWS is deprecating Pinpoint engagement features (campaigns, segments, analytics) on Oct 30, 2026
        // We only use Pinpoint for transactional email sending, which should still be supported
        const ppApp = new pinpoint.CfnApp(this, 'PinpointApp', {name: 'SR-Pinpoint-app'});

        // Export Pinpoint App ID for use by other stacks
        this.pinpointAppId = ppApp.ref;

        // NOTE: The following Pinpoint analytics features are being deprecated and have been removed:
        // - Kinesis Stream for Pinpoint events (analytics)
        // - PinpointEventStream (deprecated analytics feature)
        // - Kinesis Firehose (was for streaming Pinpoint analytics to S3)
        //
        // We've simplified this stack to only include:
        // - Pinpoint App (for transactional messaging via SendMessages API)
        //
        // If you need delivery/bounce tracking, consider:
        // - Amazon SES Configuration Sets
        // - CloudWatch Logs
        // - SNS topics for bounce/complaint notifications

        // output for app id
        new cdk.CfnOutput(this, 'PinpointAppId', {value: ppApp.ref});


    }
}