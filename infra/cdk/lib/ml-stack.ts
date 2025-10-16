// infra/cdk/lib/ml-stack.ts
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_iam as iam, aws_glue as glue, aws_s3 as s3, aws_ec2 as ec2,  aws_logs as logs } from 'aws-cdk-lib';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import {DataStack} from "./data-stack";
import {InputMode} from "aws-cdk-lib/aws-stepfunctions-tasks";

interface MlStackProps extends cdk.StackProps {
    data: DataStack;
}

export class MlStack extends cdk.Stack {
    constructor(scope: Construct, id: string, {data, ...props}: MlStackProps) {
        super(scope, id, props);

        const glueScriptS3Path = `s3://${data.modelsBucket.bucketName}/scripts/build_hourly_features.py`;
        const trainingImageUri = '683313688378.dkr.ecr.us-west-2.amazonaws.com/sagemaker-xgboost:1.7-1'; // example for us-west-2

        // 1) Glue Service Role
        const glueRole = new iam.Role(this, 'GlueServiceRole', {
            assumedBy: new iam.ServicePrincipal('glue.amazonaws.com'),
            description: 'Role for Glue jobs to access S3 / DynamoDB',
        });
        data.eventsBucket.grantRead(glueRole);
        data.curatedBucket.grantReadWrite(glueRole);

        // Add DynamoDB read permission if needed (profiles snapshot)
        glueRole.addToPolicy(new iam.PolicyStatement({
            actions: ['dynamodb:GetItem', 'dynamodb:Query', 'dynamodb:Scan'],
            resources: [data.profilesTable.tableArn],
        }));

        // 2) SageMaker execution role (used by Step Functions to start a training job)
        const sagemakerRole = new iam.Role(this, 'SageMakerExecutionRole', {
            assumedBy: new iam.ServicePrincipal('sagemaker.amazonaws.com'),
            description: 'Role used by SageMaker training jobs',
        });
        data.curatedBucket.grantRead(sagemakerRole);
        data.modelsBucket.grantReadWrite(sagemakerRole);

        // 3) Glue Job (CfnJob) - points at script in S3 (script must be uploaded first)
        const glueJob = new glue.CfnJob(this, 'BuildHourlyFeaturesJob', {
            name: `${this.stackName}-build-hourly-features`,
            role: glueRole.roleArn,
            command: {
                name: 'glueetl',
                pythonVersion: '3',
                scriptLocation: glueScriptS3Path.replace('s3://', 's3://') // use S3 path
            },
            defaultArguments: {
                '--TempDir': `s3://${data.curatedBucket.bucketName}/glue-temp/`,
                '--additional-python-modules': 'pyarrow==9.0.0,pandas==2.0.1' // adjust versions as needed
            },
            maxRetries: 1,
            executionProperty: { maxConcurrentRuns: 1 }
        });

        // 4) Step Functions: Start Glue Job -> Wait -> Start SageMaker Training Job
        // a) Start Glue Job task (StartJobRun)
        // --- Start Glue job using GlueStartJobRun task (waits until Glue job completes) ---
        const startGlue = new tasks.GlueStartJobRun(this, 'StartGlueJob', {
            glueJobName: glueJob.name as string,          // glueJob created earlier (CfnJob)
            integrationPattern: sfn.IntegrationPattern.RUN_JOB, // RUN_JOB here is supported by GlueStartJobRun
        });

        // ---------------------------
        // SageMaker training task (use concrete container image & concrete S3 URI from props)
        // ---------------------------
        // NOTE: Provide the training container image URI and training data S3 URI when instantiating the stack.
        // Example image for XGBoost in us-west-2: "683313688378.dkr.ecr.us-west-2.amazonaws.com/sagemaker-xgboost:1.7-1"
        // Provide them via props.trainingImageUri and props.trainingDataS3Uri (strings)
        const trainingImage = tasks.DockerImage.fromRegistry(trainingImageUri);


        // b) (Optional) Wait state - you can wait a fixed time, or use RUN_JOB pattern above (RUN_JOB waits)
        // c) SageMaker CreateTrainingJob task using CallAwsService
        // We'll provide a parameterized training job that expects training data at S3 path provided at runtime/open.
        // --- SageMaker training task (use the high-level SageMaker task) ---
        // The SageMaker task expects properly typed enums & values (no JsonPath for these fields)

        const sageMakerTrain = new tasks.SageMakerCreateTrainingJob(this, 'StartSageMakerTraining', {
            // trainingJobName: cdk.PhysicalName.GENERATE_IF_NEEDED,
            trainingJobName: sfn.JsonPath.stringAt('$.State.UUID'),
            algorithmSpecification: {
                trainingImage: trainingImage,
                trainingInputMode: InputMode.FILE,
            },
            role: sagemakerRole,
            inputDataConfig: [
                {
                    channelName: 'train',
                    dataSource: {
                        s3DataSource: {
                            s3Location: tasks.S3Location.fromBucket(data.curatedBucket, 'features/'),
                        },
                    },
                    contentType: 'application/x-parquet',
                },
            ],
            outputDataConfig: {
                s3OutputLocation: tasks.S3Location.fromBucket(data.modelsBucket, 'training-output/'),
                // optional: encryptionKey: myKmsKey
            },
            resourceConfig: {
                instanceCount: 1,
                // enum from aws-stepfunctions-tasks
                instanceType: ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.XLARGE),
                volumeSize: cdk.Size.gibibytes(30),
            },
            stoppingCondition: {
                maxRuntime: cdk.Duration.hours(3),
            },
            integrationPattern: sfn.IntegrationPattern.RUN_JOB,
        });

        // d) State Machine
        // --- Chain them: start glue, then start SageMaker training ---
        const definition = startGlue.next(sageMakerTrain);

        const logGroup = new logs.LogGroup(this, 'MlOrchestratorLogGroup', {
            // REMOVE 'logGroupName' property entirely.
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        const sm = new sfn.StateMachine(this, 'MlOrchestrator', {
            // stateMachineName: cdk.PhysicalName.GENERATE_IF_NEEDED,
            definition, // see deprecation note below
            logs: {
                destination: logGroup,
                level: sfn.LogLevel.ALL
            },
            stateMachineType: sfn.StateMachineType.STANDARD
        });

        // output names
        new cdk.CfnOutput(this, 'GlueJobName', { value: glueJob.name as string });
        new cdk.CfnOutput(this, 'StateMachineArn', { value: sm.stateMachineArn });
        new cdk.CfnOutput(this, 'SageMakerRoleArn', { value: sagemakerRole.roleArn });
    }
}
