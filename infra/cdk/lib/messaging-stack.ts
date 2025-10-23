import * as cdk from 'aws-cdk-lib';
import {
    aws_pinpoint as pinpoint, aws_kinesis as kinesis,
    aws_kinesisfirehose as firehose, type StackProps, aws_ec2 as ec2,
    aws_apigatewayv2_integrations as apigwInt, aws_apigatewayv2 as apigwv2,
} from 'aws-cdk-lib';
import {Construct} from "constructs";
import {DataStack} from "./data-stack";

import { aws_lambda as lambda, aws_iam as iam } from 'aws-cdk-lib';

interface MessagingStackProps extends StackProps {
    data: DataStack;
    vpc: ec2.IVpc;
}

export class MessagingStack extends cdk.Stack {
    constructor(scope: Construct, id: string, {data, vpc, ...props}: MessagingStackProps) {
        super(scope, id, props);

        // Stream for Pinpoint events
        const ppStream = new kinesis.Stream(this, 'PinpointEvents', {shardCount: 1});

        // Pinpoint app (project)
        const ppApp = new pinpoint.CfnApp(this, 'PinpointApp', {name: 'SR-Pinpoint-app'});

        // Role for Pinpoint → Kinesis
        const ppToKinesisRole = new iam.Role(this, 'PinpointToKinesisRole', {
            assumedBy: new iam.ServicePrincipal('pinpoint.amazonaws.com'),
        });
        ppToKinesisRole.addToPolicy(new iam.PolicyStatement({
            actions: ['kinesis:PutRecord', 'kinesis:PutRecords', 'kinesis:DescribeStream'],
            resources: [ppStream.streamArn]
        }));

        new pinpoint.CfnEventStream(this, 'PinpointEventStream', {
            applicationId: ppApp.ref,
            destinationStreamArn: ppStream.streamArn,
            roleArn: ppToKinesisRole.roleArn
        });

        // Firehose → S3 deliveries bucket
        const fhRole = new iam.Role(this, 'FirehoseRole', {
            assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com'),
        });
        ppStream.grantRead(fhRole);
        data.deliveriesBucket.grantWrite(fhRole);

        new firehose.CfnDeliveryStream(this, 'PinpointToS3', {
            deliveryStreamType: 'KinesisStreamAsSource',
            kinesisStreamSourceConfiguration: {kinesisStreamArn: ppStream.streamArn, roleArn: fhRole.roleArn},
            s3DestinationConfiguration: {
                bucketArn: data.deliveriesBucket.bucketArn,
                roleArn: fhRole.roleArn,
                prefix: 'pinpoint/dt=!{timestamp:yyyy-MM-dd}/',
                bufferingHints: {intervalInSeconds: 60, sizeInMBs: 5},
                compressionFormat: 'GZIP'
            }
        });

        // output for app id
        new cdk.CfnOutput(this, 'PinpointAppId', {value: ppApp.ref});


    }
}