# ADR 0001: Use Self-Hosted AWS Serverless Architecture

## Status

Accepted

## Context

SNRE is intended for organizations that want notification routing intelligence
without handing their user data to a new hosted vendor. Healthcare, education,
public-sector, and finance-adjacent adopters may need control over infrastructure
location, access, retention, and audit evidence.

## Decision

Deploy SNRE into the adopter's AWS account using AWS-native services:

- API Gateway
- Lambda
- DynamoDB
- Kinesis
- S3
- EventBridge Scheduler
- SES/SNS
- Glue
- SageMaker
- CloudWatch
- Cognito

## Consequences

Benefits:

- adopter owns data, IAM, logs, retention, and AWS cost
- no default multi-tenant data sharing
- easier to inspect infrastructure through CDK
- serverless scaling for many operational paths

Tradeoffs:

- adopters need AWS familiarity or setup support
- AWS quotas and SES production access matter
- local development cannot fully reproduce all cloud behavior
- production readiness depends on adopter-specific validation

