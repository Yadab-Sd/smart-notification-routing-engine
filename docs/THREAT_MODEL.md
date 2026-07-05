# Threat Model

This is a lightweight threat model for self-hosted SNRE deployments. It is not a
formal security assessment. Adopters should perform their own review before
using production, sensitive, or regulated data.

## Assets

- user profiles and contact details
- notification content and template variables
- raw event data in S3
- Attention Ledger decision records
- suppression list and SES event logs
- AWS credentials, IAM roles, and secrets
- SageMaker model artifacts and endpoints
- admin console access

## Trust Boundaries

```text
External clients/admins
  -> Cognito/API Gateway
  -> Lambda services
  -> DynamoDB/S3/Kinesis/SageMaker/SES/SNS/EventBridge
```

Important boundaries:

- browser to API Gateway
- API Gateway authorizer to Lambda handlers
- Lambda service role to AWS resources
- Kinesis stream to consumer Lambda
- sender service to external email/SMS recipients
- admin users to operational data

## Threats And Controls

| Threat | Risk | Existing / Recommended Controls |
|---|---|---|
| Unauthorized API access | Data exposure or unauthorized sends | Cognito JWT authorizer, least privilege IAM, HTTPS |
| Over-permissive IAM roles | Resource misuse if Lambda is compromised | Scope policies by resource, avoid wildcard actions where practical |
| Sensitive data in event metadata | Privacy/compliance risk | Data minimization, validation, adopter data-classification policy |
| Template injection or unsafe variables | Incorrect or misleading messages | Plain text rendering, validation, preview, avoid executing template logic |
| Spam or unlawful sends | Recipient harm, legal risk, SES reputation damage | Consent processes, suppression list, complaint handling, rate controls |
| Kinesis backlog | Delayed notifications | Monitor iterator age, shard capacity, consumer errors |
| SageMaker endpoint failure | Lower quality timing predictions | Fallback heuristic with explicit `modelSource` response |
| EventBridge schedule misfire | Missed or late sends | UTC scheduling, schedule status checks, sender logs |
| Data retention drift | Storing data longer than intended | S3 lifecycle, DynamoDB TTL where appropriate, log retention |
| Admin account compromise | Unauthorized system changes | MFA, least privilege admin groups, CloudTrail |

## Privacy Principles

- Store only fields required for routing and measurement.
- Avoid sensitive content in notification metadata.
- Prefer pseudonymous user IDs where practical.
- Keep outcome tracking proportional to the use case.
- Treat missing clicks as incomplete evidence, not proof of user disinterest.

## Security Review Checklist

- [ ] Cognito user pool configured with MFA for admins where appropriate
- [ ] API routes require authorization
- [ ] Lambda roles scoped to required resources
- [ ] S3 buckets block public access
- [ ] DynamoDB and S3 encryption enabled
- [ ] CloudTrail enabled in the adopter account
- [ ] CloudWatch log retention configured
- [ ] SES bounce/complaint handling tested
- [ ] Suppression list checked before email sends
- [ ] Secrets are not committed to Git
- [ ] Production data is not used in contributor environments

## Out Of Scope

This document does not certify compliance with HIPAA, FERPA, GDPR, TCPA,
CAN-SPAM, SOC 2, FedRAMP, or other frameworks. Those require organization-
specific legal, security, and operational review.

