import 'source-map-support/register'
import { App } from 'aws-cdk-lib'
import { NetworkStack } from '../lib/network-stack'
import { SecurityStack } from '../lib/security-stack'
import { DataStack } from '../lib/data-stack'
import { IdentityStack } from '../lib/identity-stack'
import { ComputeStack } from '../lib/compute-stack'
import { FrontendStack } from '../lib/frontend-stack'

import dotenv from 'dotenv'
import { MlStack } from '../lib/ml-stack'
import { MessagingStack } from '../lib/messaging-stack'
// SageMakerStack is no longer needed - endpoint deployment is now automated via ML pipeline
// import {SageMakerStack} from "../lib/sagemaker-stack";

dotenv.config()

const app = new App()
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
}

const network = new NetworkStack(app, 'SR-Network', { env })
const identity = new IdentityStack(app, 'SR-Identity', { env })
const security = new SecurityStack(app, 'SR-Security', { env })
const data = new DataStack(app, 'SR-Data', { env, kmsKey: security.dataKey })

// Create MessagingStack BEFORE ComputeStack so we can pass Pinpoint App ID
const messaging = new MessagingStack(app, 'SR-Messaging', {
  env,
  profilesTable: data.profilesTable,
})

// Now ComputeStack can reference the Pinpoint App ID from MessagingStack
new ComputeStack(app, 'SR-Compute', {
  env,
  vpc: network.vpc,
  kmsKey: security.dataKey,
  data,
  identity,
  messaging,
})

// after creating DataStack (named `data`) and IdentityStack...
const ml = new MlStack(app, 'SR-ML', {
  env,
  data,
  kmsKey: security.dataKey,
})

// Frontend hosting (S3 + CloudFront)
const frontend = new FrontendStack(app, 'SR-Frontend', { env })

// NOTE: SR-SageMaker stack is deprecated and no longer used
// The endpoint is now automatically deployed by the ML pipeline (SR-ML)
// after training completes via the endpoint-deployer Lambda function
//
// To manually deploy a specific model version (optional):
// Uncomment the lines below and run: cdk deploy SR-SageMaker -c modelPath=training-output/send-time-xxx/output/model.tar.gz
//
// new SageMakerStack(app, 'SR-SageMaker', {
//     env,
//     data,
//     ml
// });
