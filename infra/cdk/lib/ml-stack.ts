// infra/cdk/lib/ml-stack.ts
import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {
    aws_iam as iam,
    aws_glue as glue,
    aws_s3 as s3,
    aws_ec2 as ec2,
    aws_logs as logs,
    aws_kms as kms
} from 'aws-cdk-lib';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import {DataStack} from "./data-stack";
import {InputMode} from "aws-cdk-lib/aws-stepfunctions-tasks";
import {SecurityStack} from "./security-stack";
import * as sagemaker from 'aws-cdk-lib/aws-sagemaker';

interface MlStackProps extends cdk.StackProps {
    data: DataStack;
    kmsKey: kms.Key;
}

export class MlStack extends cdk.Stack {
    public readonly sagemakerRole: iam.Role;

    constructor(scope: Construct, id: string, {data, kmsKey, ...props}: MlStackProps) {
        super(scope, id, props);

        const glueScriptS3Path = `s3://${data.modelsBucket.bucketName}/scripts/build_hourly_features.py`;
        const trainingImageUri = '246618743249.dkr.ecr.us-west-2.amazonaws.com/sagemaker-xgboost:1.7-1'

        // 1) Glue Service Role
        // import by ARN
        const glueRole = iam.Role.fromRoleArn(this, 'GlueExecRole', 'arn:aws:iam::196177110614:role/GlueExecutionRole');
        data.eventsBucket.grantRead(glueRole);
        data.curatedBucket.grantReadWrite(glueRole);
        kmsKey.grantDecrypt(glueRole);

        // 2) SageMaker execution role (used by Step Functions to start a training job)
        this.sagemakerRole = new iam.Role(this, 'SageMakerExecutionRole', {
            assumedBy: new iam.ServicePrincipal('sagemaker.amazonaws.com'),
            description: 'Role used by SageMaker training jobs',
        });
        data.curatedBucket.grantRead(this.sagemakerRole);
        data.modelsBucket.grantReadWrite(this.sagemakerRole);
        this.sagemakerRole.addToPolicy(new iam.PolicyStatement({
            actions: ['ecr:GetAuthorizationToken', 'ecr:GetDownloadUrlForLayer',
                'ecr:BatchGetImage', 'ecr:BatchCheckLayerAvailability'],
            resources: ['*'],
        }));
        this.sagemakerRole.addToPolicy(new iam.PolicyStatement({
            actions: ['ecr:BatchGetImage', 'ecr:GetDownloadUrlForLayer'],
            resources: ['arn:aws:ecr:us-west-2:246618743249:repository/sagemaker-xgboost'],
        }));

        // 3) Glue Job (CfnJob) - points at script in S3 (script must be uploaded first)
        const glueJob = new glue.CfnJob(this, 'BuildHourlyFeaturesJob', {
            name: `${this.stackName}-build-hourly-features`,
            role: glueRole.roleArn,
            command: {
                name: 'glueetl',           // Glue ETL with Spark
                pythonVersion: '3',        // Python 3
                scriptLocation: glueScriptS3Path, // s3://.../scripts/build_hourly_features.py
            },

            // ✅ Use a modern Glue runtime
            glueVersion: '4.0',

            // ✅ Use worker model (not legacy DPUs)
            workerType: 'G.1X',          // or 'G.2X' depending on size
            numberOfWorkers: 2,          // adjust as needed

            // ✅ Pass all script args your code expects
            defaultArguments: {
                '--job-language': 'python',
                '--enable-metrics': 'true',
                '--TempDir': `s3://${data.curatedBucket.bucketName}/glue-temp/`,

                // your script requires these:
                '--EVENTS_BUCKET': data.eventsBucket.bucketName,
                '--CURATED_BUCKET': data.curatedBucket.bucketName,

                // optional: bookmark, etc.
                // '--job-bookmark-option': 'job-bookmark-enable',
                // '--enable-glue-datacatalog': 'true',
                // extra libs if you really need them (4.0 already has recent Spark/Arrow):
                // '--additional-python-modules': 'pyarrow==9.0.0,pandas==2.0.1',
            },

            maxRetries: 1,
            executionProperty: {maxConcurrentRuns: 1},
        });

        data.modelsBucket.grantRead(glueRole);

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
            trainingJobName: sfn.JsonPath.format('send-time-{}', sfn.JsonPath.uuid()),
            algorithmSpecification: {
                trainingImage: trainingImage,                 // xgboost:1.7-1
                trainingInputMode: tasks.InputMode.FILE,
            },
            role: this.sagemakerRole,
            inputDataConfig: [{
                channelName: 'train',
                dataSource: {
                    s3DataSource: {
                        s3Location: tasks.S3Location.fromBucket(data.curatedBucket, 'features-csv/'), // must contain CSV files
                        // s3DataDistributionType: tasks.S3DataDistributionType.SHARDED_BY_S3_KEY,
                    },
                },
                contentType: 'text/csv',
                compressionType: tasks.CompressionType.NONE,
                recordWrapperType: tasks.RecordWrapperType.NONE,
            }],
            hyperparameters: {
                num_round: '200',
                objective: 'binary:logistic',
                eval_metric: 'auc',
            },
            outputDataConfig: {
                s3OutputLocation: tasks.S3Location.fromBucket(data.modelsBucket, 'training-output/'),
            },
            resourceConfig: {
                instanceCount: 1,
                instanceType: ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.XLARGE),
                volumeSize: cdk.Size.gibibytes(30),
            },
            stoppingCondition: {maxRuntime: cdk.Duration.hours(3)},
            integrationPattern: sfn.IntegrationPattern.RUN_JOB,
        });

        // d) State Machine
        // --- Chain them: start glue, then start SageMaker training ---
        const definition = startGlue.next(sageMakerTrain);

        const logGroup = new logs.LogGroup(this, 'MlOrchestratorLogGroup');
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
        new cdk.CfnOutput(this, 'GlueJobName', {value: glueJob.name as string});
        new cdk.CfnOutput(this, 'StateMachineArn', {value: sm.stateMachineArn});
        new cdk.CfnOutput(this, 'SageMakerRoleArn', {value: this.sagemakerRole.roleArn});
    }
}
