import * as cdk from 'aws-cdk-lib';
import { Duration, RemovalPolicy, Stack,
    type StackProps, aws_dynamodb as ddb, aws_kinesis as kinesis, aws_s3 as s3, aws_glue as glue, aws_kms as kms, aws_iam as iam } from 'aws-cdk-lib';
import { Construct } from 'constructs';


interface Props extends StackProps { kmsKey: kms.IKey }

export class DataStack extends Stack {
    public readonly eventsBucket: s3.Bucket;
    public readonly deliveriesBucket: s3.Bucket;
    public readonly curatedBucket: s3.Bucket;
    public readonly modelsBucket: s3.Bucket;
    public readonly auditBucket: s3.Bucket;
    public readonly userEvents: kinesis.Stream;
    public readonly profilesTable: ddb.Table;
    public readonly attentionTable: ddb.Table;
    public readonly glueDb: glue.CfnDatabase;
    constructor(scope: Construct, id: string, { kmsKey, ...props }: Props){
        super(scope,id,props);
        const enc = { encryption: s3.BucketEncryption.KMS, encryptionKey: kmsKey };
        // Store events we create through /events, kinesis -> lambda
        this.eventsBucket = new s3.Bucket(this,'EventsRaw',{...enc, blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, versioned:true});
        this.deliveriesBucket= new s3.Bucket(this,'DeliveriesRaw',{...enc, blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, versioned:true});
        this.curatedBucket = new s3.Bucket(this,'Curated',{...enc});
        this.modelsBucket = new s3.Bucket(this,'Models',{...enc});
        this.auditBucket = new s3.Bucket(this,'Audit',{...enc});

        // Try with default encryption first (AWS managed key)
        // If this works, we can switch to customer-managed KMS later
        this.userEvents = new kinesis.Stream(this,'UserEvents',{
            shardCount:1,
            encryption: kinesis.StreamEncryption.MANAGED
        });

        this.profilesTable = new ddb.Table(this,'UserProfiles',{
            partitionKey:{ name:'pk', type: ddb.AttributeType.STRING },
            sortKey:{ name:'sk', type: ddb.AttributeType.STRING },
            billingMode: ddb.BillingMode.PAY_PER_REQUEST,
            encryption: ddb.TableEncryption.CUSTOMER_MANAGED,
            encryptionKey: kmsKey,
            pointInTimeRecoverySpecification: {
                pointInTimeRecoveryEnabled: true,
            },
            removalPolicy: RemovalPolicy.RETAIN
        });

        this.attentionTable = new ddb.Table(this,'AttentionLedger',{
            partitionKey:{ name:'pk', type: ddb.AttributeType.STRING },
            sortKey:{ name:'sk', type: ddb.AttributeType.STRING },
            billingMode: ddb.BillingMode.PAY_PER_REQUEST,
            encryption: ddb.TableEncryption.CUSTOMER_MANAGED,
            encryptionKey: kmsKey,
            pointInTimeRecoverySpecification: {
                pointInTimeRecoveryEnabled: true,
            },
            removalPolicy: RemovalPolicy.RETAIN
        });

        this.attentionTable.addGlobalSecondaryIndex({
            indexName: 'source-index',
            partitionKey: { name: 'sourceId', type: ddb.AttributeType.STRING },
            sortKey: { name: 'createdAt', type: ddb.AttributeType.STRING },
            projectionType: ddb.ProjectionType.ALL
        });


        this.glueDb = new glue.CfnDatabase(this,'GlueDb',{ catalogId: this.account, databaseInput:{ name:'sr_datacatalog' }});

        // Outputs - expose important resource identifiers
        new cdk.CfnOutput(this, 'EventsBucketName', {
            value: this.eventsBucket.bucketName,
            description: 'S3 bucket for raw events data',
            exportName: `${this.stackName}-EventsBucketName`
        });

        new cdk.CfnOutput(this, 'ModelsBucketName', {
            value: this.modelsBucket.bucketName,
            description: 'S3 bucket for ML models and Glue scripts',
            exportName: `${this.stackName}-ModelsBucketName`
        });

        new cdk.CfnOutput(this, 'CuratedBucketName', {
            value: this.curatedBucket.bucketName,
            description: 'S3 bucket for curated/processed data',
            exportName: `${this.stackName}-CuratedBucketName`
        });

        new cdk.CfnOutput(this, 'UserEventsStreamName', {
            value: this.userEvents.streamName,
            description: 'Kinesis stream for user events',
            exportName: `${this.stackName}-UserEventsStreamName`
        });

        new cdk.CfnOutput(this, 'UserProfilesTableName', {
            value: this.profilesTable.tableName,
            description: 'DynamoDB table for user profiles',
            exportName: `${this.stackName}-UserProfilesTableName`
        });

        new cdk.CfnOutput(this, 'AttentionLedgerTableName', {
            value: this.attentionTable.tableName,
            description: 'DynamoDB table for attention escrow decisions and trust signals',
            exportName: `${this.stackName}-AttentionLedgerTableName`
        });
    }
}
