import { Stack, StackProps, aws_cognito as cognito } from 'aws-cdk-lib';
import { Construct } from 'constructs';


export class IdentityStack extends Stack {
    public readonly userPool: cognito.UserPool;
    public readonly userPoolClient: cognito.UserPoolClient;
    constructor(scope: Construct, id: string, props?: StackProps){
        super(scope,id,props);
        this.userPool = new cognito.UserPool(this,'AdminUsers',{ selfSignUpEnabled:true, signInAliases:{ email:true }, standardAttributes:{ email:{ required:true, mutable:false } }});
        this.userPool.addDomain('HostedDomain',{ cognitoDomain:{ domainPrefix:`sr-admin-${this.account.slice(-6)}` }});
        this.userPoolClient = this.userPool.addClient('WebClient',{ authFlows:{ userPassword:true, userSrp:true }, oAuth:{ flows:{ authorizationCodeGrant:true }, scopes:[cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL]} });
    }
}