# Security Policy

SNRE is an open-source notification routing system designed for controlled pilots and customer-owned AWS deployment. Security expectations depend on the deployment model.

---

## Reporting A Vulnerability

Please do not open a public issue for security vulnerabilities.

Contact: `contact@intelligent-routing.com`

Include:

- affected component
- reproduction steps
- possible impact
- whether the issue affects hosted pilots, self-hosted deployments, or both

I aim to acknowledge valid reports within 48 hours.

---

## Pilot Data Principles

For hosted discovery pilots:

- use the smallest useful pilot segment
- prefer pseudonymous user IDs
- avoid sensitive message content unless an appropriate agreement is in place
- share only fields needed for routing, suppression, and measurement
- define data deletion/export expectations before the pilot starts
- avoid emergency, legal-critical, medical-critical, or financial-critical messages in the first pilot

For organization-owned deployments:

- the organization controls AWS access, data retention, logging, and compliance
- SNRE should be connected to the organization's consent, unsubscribe, and privacy workflows
- secrets should remain in AWS-managed secret/configuration services or GitHub/AWS secure stores

---

## Deployment Security Expectations

Recommended production/adoption posture:

- deploy into the organization's own AWS account
- use least-privilege IAM roles
- use GitHub OIDC instead of long-lived AWS keys for CI/CD
- keep SES bounce and complaint suppression enabled
- restrict frontend deployment permissions to the frontend S3 bucket and CloudFront invalidation
- review CloudWatch logs for accidental sensitive data exposure
- rotate any credentials that may have been shared during onboarding

---

## Compliance Note

SNRE is a software tool. The sending organization remains responsible for legal and regulatory compliance, including consent, unsubscribe handling, data protection, CAN-SPAM, TCPA, HIPAA, FERPA, GDPR, or other applicable rules.

This repository provides engineering guidance, not legal advice.
