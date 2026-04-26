import {Stack, StackProps, aws_kms as kms, aws_iam as iam} from 'aws-cdk-lib';
import {Construct} from 'constructs';


export class SecurityStack extends Stack {
    public readonly dataKey: kms.Key;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);
        this.dataKey = new kms.Key(this, 'DataKey', {
            enableKeyRotation: true,
            description: 'KMS key for encrypting data at rest (S3, DynamoDB, Kinesis)',
        });

        // Grant Kinesis service permission to use this key
        this.dataKey.addToResourcePolicy(new iam.PolicyStatement({
            sid: 'Allow Kinesis to use the key',
            effect: iam.Effect.ALLOW,
            principals: [new iam.ServicePrincipal('kinesis.amazonaws.com')],
            actions: [
                'kms:Decrypt',
                'kms:GenerateDataKey',
            ],
            resources: ['*'],
            conditions: {
                StringEquals: {
                    'kms:ViaService': `kinesis.${this.region}.amazonaws.com`,
                },
            },
        }));
    }
}