import {Stack, StackProps, aws_ec2 as ec2} from 'aws-cdk-lib';
import {Construct} from 'constructs';


export class NetworkStack extends Stack {
    public readonly vpc: ec2.Vpc;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);
        this.vpc = new ec2.Vpc(this, 'Vpc', {maxAzs: 2, natGateways: 1});
        const endpoints = ['s3', 'dynamodb', 'kinesis-streams', 'logs', 'secretsmanager', 'events']; // reserved names
        endpoints.forEach(svc => this.vpc.addInterfaceEndpoint(`EP-${svc}`, {
            service: new ec2.InterfaceVpcEndpointService(`com.amazonaws.${this.region}.${svc}`, 443)
        }));
        this.vpc.addGatewayEndpoint('EP-S3-GW', {service: ec2.GatewayVpcEndpointAwsService.S3});
    }
}