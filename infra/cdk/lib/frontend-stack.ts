import {
  Stack,
  StackProps,
  RemovalPolicy,
  CfnOutput,
  Duration,
} from 'aws-cdk-lib'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import { Construct } from 'constructs'

export class FrontendStack extends Stack {
  public readonly distributionUrl: string
  public readonly bucketName: string

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    // S3 bucket for CloudFront origin (SPA routing handled by CloudFront error responses)
    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      bucketName: `sr-frontend-${this.account}-${this.region}`,
      publicReadAccess: false, // CloudFront only
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY, // Dev only - use RETAIN for prod
      autoDeleteObjects: true, // Dev only
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: false,
    })

    // CloudFront Origin Access Identity (OAI)
    const oai = new cloudfront.OriginAccessIdentity(this, 'OAI', {
      comment: 'OAI for SR frontend bucket',
    })
    websiteBucket.grantRead(oai)

    // SSL Certificate for custom domain (optional, must be in us-east-1)
    // To use custom domain:
    // 1. Request ACM certificate: aws acm request-certificate --domain-name yourdomain.com --validation-method DNS --region us-east-1
    // 2. Set environment variables before deployment:
    //    export CERTIFICATE_ARN=arn:aws:acm:us-east-1:ACCOUNT:certificate/CERT_ID
    //    export CUSTOM_DOMAIN=yourdomain.com
    // 3. Deploy: pnpm exec cdk deploy SR-Frontend
    // If not set, CloudFront will use default *.cloudfront.net domain
    const certificateArn = process.env.CERTIFICATE_ARN
    const customDomain = process.env.CUSTOM_DOMAIN

    const distributionConfig: cloudfront.DistributionProps = {
      defaultBehavior: {
        origin: new origins.S3Origin(websiteBucket, {
          originAccessIdentity: oai,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: new cloudfront.CachePolicy(this, 'CachePolicy', {
          cachePolicyName: `SR-Frontend-Cache-${this.region}`,
          defaultTtl: Duration.hours(1),
          maxTtl: Duration.days(1),
          minTtl: Duration.seconds(0),
          enableAcceptEncodingGzip: true,
          enableAcceptEncodingBrotli: true,
        }),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        compress: true,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html', // SPA routing
          ttl: Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html', // SPA routing
          ttl: Duration.minutes(5),
        },
      ],
      comment: 'Smart Routing Engine Frontend',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // Use only North America and Europe
    }

    // Add custom domain if certificate is provided
    if (certificateArn) {
      distributionConfig.domainNames = [customDomain]
      distributionConfig.certificate = acm.Certificate.fromCertificateArn(
        this,
        'Certificate',
        certificateArn
      )
    }

    const distribution = new cloudfront.Distribution(this, 'Distribution', distributionConfig)

    this.distributionUrl = `https://${distribution.distributionDomainName}`
    this.bucketName = websiteBucket.bucketName

    new CfnOutput(this, 'WebsiteURL', {
      value: this.distributionUrl,
      description: 'CloudFront distribution URL',
      exportName: 'SR-Frontend-URL',
    })

    new CfnOutput(this, 'BucketName', {
      value: websiteBucket.bucketName,
      description: 'S3 bucket name for frontend',
      exportName: 'SR-Frontend-Bucket',
    })

    new CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront distribution ID',
      exportName: 'SR-Frontend-DistributionId',
    })
  }
}
