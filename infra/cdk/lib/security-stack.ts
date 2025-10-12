import {Stack, StackProps, aws_kms as kms} from 'aws-cdk-lib';
import {Construct} from 'constructs';


export class SecurityStack extends Stack {
    public readonly dataKey: kms.Key;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);
        this.dataKey = new kms.Key(this, 'DataKey', {enableKeyRotation: true});
    }
}