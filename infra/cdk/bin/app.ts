import 'source-map-support/register';
import {App} from 'aws-cdk-lib';
import {NetworkStack} from '../lib/network-stack';
import {SecurityStack} from '../lib/security-stack';
import {DataStack} from '../lib/data-stack';
import {IdentityStack} from '../lib/identity-stack';
import {ComputeStack} from '../lib/compute-stack';

import dotenv from "dotenv";
import {MlStack} from "../lib/ml-stack";
dotenv.config();

console.log("env: ", process.env);

const app = new App();
const env = {account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION};


const network = new NetworkStack(app, 'SR-Network', {env});
const identity = new IdentityStack(app, 'SR-Identity', {env});
const security = new SecurityStack(app, 'SR-Security', {env});
const data = new DataStack(app, 'SR-Data', {env, kmsKey: security.dataKey});
new ComputeStack(app, 'SR-Compute', {env, vpc: network.vpc, kmsKey: security.dataKey, data, identity});
// after creating DataStack (named `data`) and IdentityStack...
new MlStack(app, 'SR-ML', {
    env,
    data,
    kmsKey: security.dataKey
});