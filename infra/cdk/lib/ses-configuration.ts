import * as cdk from 'aws-cdk-lib';
import { aws_ses as ses, aws_iam as iam } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { MessagingStack } from './messaging-stack';

/**
 * SES Configuration Set with bounce/complaint tracking
 *
 * This is REQUIRED for AWS SES production access approval.
 *
 * Creates:
 * - Configuration set that tracks bounces and complaints
 * - Event destinations that publish to SNS topics
 * - IAM role for SES to publish to SNS
 */
export class SESConfiguration extends Construct {
    constructor(scope: Construct, id: string, messaging: MessagingStack) {
        super(scope, id);

        // Create IAM role for SES to publish to SNS
        const sesPublishRole = new iam.Role(this, 'SESPublishToSNSRole', {
            assumedBy: new iam.ServicePrincipal('ses.amazonaws.com'),
            description: 'Allows SES to publish bounce/complaint events to SNS'
        });

        // Grant SES permission to publish to both SNS topics
        messaging.sesBounceTopic.grantPublish(sesPublishRole);
        messaging.sesComplaintTopic.grantPublish(sesPublishRole);

        // Create SES Configuration Set
        const configSet = new ses.CfnConfigurationSet(this, 'SNREConfigurationSet', {
            name: 'snre-production',

            // Track engagement (opens, clicks)
            trackingOptions: {
                customRedirectDomain: undefined // Use default SES tracking domain
            },

            // Enable reputation metrics
            reputationOptions: {
                reputationMetricsEnabled: true
            },

            // Send to dedicated IP pool (if you have one)
            sendingOptions: {
                sendingEnabled: true
            }
        });

        // Event destination for BOUNCES → SNS
        new ses.CfnConfigurationSetEventDestination(this, 'BounceDestination', {
            configurationSetName: configSet.name!,
            eventDestination: {
                name: 'bounce-to-sns',
                enabled: true,
                matchingEventTypes: ['bounce'],
                snsDestination: {
                    topicArn: messaging.sesBounceTopic.topicArn
                }
            }
        });

        // Event destination for COMPLAINTS → SNS
        new ses.CfnConfigurationSetEventDestination(this, 'ComplaintDestination', {
            configurationSetName: configSet.name!,
            eventDestination: {
                name: 'complaint-to-sns',
                enabled: true,
                matchingEventTypes: ['complaint'],
                snsDestination: {
                    topicArn: messaging.sesComplaintTopic.topicArn
                }
            }
        });

        // Event destination for DELIVERY (optional - for analytics)
        new ses.CfnConfigurationSetEventDestination(this, 'DeliveryDestination', {
            configurationSetName: configSet.name!,
            eventDestination: {
                name: 'delivery-events',
                enabled: true,
                matchingEventTypes: ['send', 'delivery', 'reject'],
                // Send to CloudWatch Logs for analytics
                cloudWatchDestination: {
                    dimensionConfigurations: [
                        {
                            dimensionName: 'ses:configuration-set',
                            dimensionValueSource: 'emailHeader',
                            defaultDimensionValue: 'snre-production'
                        },
                        {
                            dimensionName: 'ses:from-domain',
                            dimensionValueSource: 'emailHeader',
                            defaultDimensionValue: 'unknown'
                        }
                    ]
                }
            }
        });

        // Output configuration set name
        new cdk.CfnOutput(this, 'SESConfigurationSetName', {
            value: configSet.name!,
            description: 'SES Configuration Set name to use in SendEmail API calls',
            exportName: 'SES-ConfigurationSetName'
        });
    }
}
