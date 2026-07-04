# Architecture Diagrams

This folder contains visual architecture artifacts for the Smart Notification Routing Engine.

| File | Purpose |
|---|---|
| `aws-resource-architecture.svg` | Recommended AWS component/resource-level diagram using official AWS Architecture Icons. Shows the adopter AWS account, frontend, identity, API Gateway, Lambda services, DynamoDB, S3, Kinesis, SES, SNS, EventBridge, Glue, Step Functions, SageMaker, CloudWatch, IAM, KMS, and CDK/CloudFormation. |
| `aws-cloud-architecture-visual.svg` | Polished AWS/cloud architecture view for technical reviewers, adopters, and USCIS evidence packets. |
| `SNRE_TECHNICAL_ARCHITECTURE.drawio.svg` | Single-page Draw.io SVG export showing the reusable critical-communication flow. |
| `implementation-architecture_in_layers.svg` | Layered implementation architecture view. |
| `data-flow.svg` | Lightweight data-flow diagram. |

## Recommended Use

Use `aws-resource-architecture.svg` when the audience needs a concrete AWS
service/resource diagram that looks like a cloud architecture review artifact.
Use `aws-cloud-architecture-visual.svg` when the audience needs a cleaner
conceptual cloud architecture view.

`aws-cloud-architecture-visual.svg` explains:

- who sends notifications;
- how requests enter through the frontend/API layer;
- how policy, send-time prediction, and Attention Escrow make routing decisions;
- how AWS storage, event streams, and ML training support the system;
- how SES/SNS delivery and bounce/complaint feedback close the loop;
- how another organization can deploy the system in its own AWS account.

## Claim Boundary

These diagrams should not be used to claim production accuracy, throughput, ROI,
HIPAA compliance, emergency-alert certification, or regulated deployment
readiness. Those claims require adopter-specific validation and legal/security
review.
