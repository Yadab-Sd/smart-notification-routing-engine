# Contributing to Smart Notification Routing Engine

Thank you for your interest in contributing. This project is building an ML-powered, serverless notification routing engine that learns when users are most likely to engage and sends messages through the best available channel.

Contributions are welcome across code, infrastructure, ML, documentation, testing, and product thinking. You do not need AWS access for many useful contributions.

---

## Project Map

| Area | Path | Stack |
| --- | --- | --- |
| Frontend admin console | `frontend/` | React 18, Vite, TypeScript, TailwindCSS |
| Backend Lambda services | `services/` | Java 21, AWS Lambda, Maven |
| Infrastructure | `infra/cdk/` | AWS CDK v2, TypeScript |
| ML and feature engineering | `ml/`, `glue-jobs/` | SageMaker XGBoost, AWS Glue/Spark |
| Documentation | `docs/`, root `*.md` files | Architecture, setup, SES, operations |
| Scripts | `scripts/` | Local build and deployment helpers |

Core services:

- `control-plane`: user management and event ingestion API
- `events-consumer`: Kinesis event processing, S3 writes, DynamoDB counters
- `decision-service`: ML inference and notification scheduling
- `sender-service`: email/SMS delivery and channel fallback
- `analytics-service`: dashboard metrics and system health
- `endpoint-deployer`: SageMaker endpoint deployment
- `ses-event-processor`: SES bounce and complaint processing

---

## Ways to Contribute

### Great First Contributions

- Improve documentation clarity, examples, or troubleshooting notes
- Add or improve unit tests for Java Lambda handlers
- Improve frontend loading, empty, and error states
- Fix TypeScript or Java warnings
- Add sample payloads for API testing
- Improve README diagrams, setup steps, or cost notes
- Help identify security or deployment footguns

### Larger Contributions

- Add a new notification channel, such as push or WhatsApp
- Improve SES suppression and compliance workflows
- Improve analytics metrics accuracy
- Add integration tests around the event and decision flow
- Improve ML feature engineering and model evaluation
- Harden CDK IAM permissions and stack dependencies
- Improve frontend workflows for users, events, templates, and analytics

---

## You Do Not Need AWS Access For

- Documentation changes
- Frontend UI changes in demo mode
- Java unit tests
- TypeScript build fixes
- CDK synthesis-only validation
- Code review, issue triage, and architecture suggestions

AWS access is only needed when you want to deploy infrastructure, test live AWS integrations, or validate end-to-end cloud workflows.

---

## Local Setup

### Prerequisites

- Git
- Node.js 18+
- npm or pnpm
- Java 21+
- Maven 3.9+
- AWS CLI and CDK only if working on cloud deployment

The setup script can install most tools:

```bash
./scripts/setup.sh
```

If you prefer manual setup, install only the tools needed for the area you are changing.

---

## Development Commands

### Frontend

```bash
cd frontend
npm install
npm run lint
npm run build
npm run dev
```

For local/demo UI work, set demo mode in `frontend/.env.local`:

```bash
VITE_DEMO_MODE=true
```

### Backend Services

Build one service:

```bash
cd services/control-plane
mvn test
mvn clean package -DskipTests
```

Build all Lambda services:

```bash
./scripts/build-services.sh
```

Run this before deploying CDK stacks that package Java Lambda artifacts, such as `SR-Compute`, `SR-ML`, or `SR-Messaging`.

### Infrastructure

```bash
cd infra/cdk
pnpm install
pnpm run build
pnpm exec cdk synth
```

Use `cdk diff` before deploying any infrastructure changes.

```bash
pnpm exec cdk diff
```

### ML and Glue

Feature engineering lives in:

```text
glue-jobs/build_hourly_features.py
```

Training-related code lives in:

```text
ml/
```

For ML changes, include sample input assumptions and explain how you validated feature format compatibility with the decision service.

---

## AWS Access for Cloud Testing

If your contribution needs live AWS resources, contact the maintainer:

- Email: `contact@intelligent-routing.com`
- Subject: `AWS Access Request - Contributor`

Include:

```text
Name:
GitHub username:
Email:
Area of contribution:
AWS account ID, if you want to assume a role from your own account:
```

Contributor access is scoped to development/testing. Do not use production data for contribution work.

### Configure Contributor AWS Credentials

After you receive contributor credentials or role-assumption instructions, configure a named AWS profile:

```bash
aws configure --profile snre-contributor
```

Then verify access:

```bash
aws sts get-caller-identity --profile snre-contributor
```

For CDK commands, use that profile:

```bash
export AWS_PROFILE=snre-contributor
```

### Deploy for Cloud Testing

Build the Java Lambda artifacts first if your change touches backend services:

```bash
./scripts/build-services.sh
```

Then synth or diff the CDK app:

```bash
cd infra/cdk
pnpm install
pnpm run build
pnpm exec cdk synth
pnpm exec cdk diff
```

Deploy only the stack or stacks needed for your change when possible:

```bash
pnpm exec cdk deploy SR-Compute
pnpm exec cdk deploy SR-Messaging
pnpm exec cdk deploy SR-Frontend
```

Use `pnpm exec cdk deploy --all` only when your change truly spans multiple stacks and you have confirmed with the maintainer that a full deployment is expected.

After cloud testing, include the deployed stack names, test commands, and relevant sanitized logs in your PR.

---

## Branch and Commit Workflow

1. Fork the repository.
2. Create a focused branch.

```bash
git checkout -b fix/ses-suppression-profile-update
```

3. Make a small, reviewable change.
4. Run the relevant checks.
5. Open a pull request with context and test results.

Use clear commit messages:

```text
feat: add SMS fallback reason to sender response
fix: update SES processor user table wiring
docs: clarify local frontend demo setup
test: add decision request validation coverage
```

---

## Pull Request Checklist

Before opening a PR, please check:

- [ ] The change is focused and easy to review
- [ ] Relevant tests or validation commands were run
- [ ] Documentation was updated if behavior changed
- [ ] No credentials, tokens, `.env` files, customer data, or generated secrets are committed
- [ ] CDK changes include `pnpm run build` and, when practical, `pnpm exec cdk synth`
- [ ] Frontend changes include `npm run lint` and `npm run build`
- [ ] Backend changes include `mvn test` or a clear explanation if tests could not be run

In the PR description, include:

```text
What changed:
Why it changed:
How it was tested:
Screenshots, if UI changed:
Follow-up notes:
```

---

## Code Guidelines

### Java Lambda Services

- Use Java 21.
- Keep handlers small and explicit.
- Prefer AWS SDK v2 clients already used in the service.
- Validate request input before calling AWS services.
- Avoid logging sensitive user data, credentials, tokens, or full message bodies.
- Add tests for validation, branching, and error behavior when practical.

### Frontend

- Use React functional components and TypeScript.
- Keep UI consistent with the existing admin console.
- Prefer clear loading, empty, and error states.
- Avoid hardcoded production URLs.
- Put API access in `frontend/src/api/` and shared types in `frontend/src/types/`.

### Infrastructure

- Keep CDK changes least-privilege where practical.
- Pass cross-stack dependencies explicitly through props.
- Prefer environment variables for deploy-time config.
- Do not hardcode account-specific values unless clearly documented as temporary.
- Run `pnpm run build` before submitting.

### Documentation

- Use practical examples.
- Prefer copy-pasteable commands.
- Call out region/account assumptions.
- Keep credentials and personal information out of docs.

---

## Security Rules

Security matters here because the project touches AWS accounts, email delivery, user profiles, and messaging compliance.

Never commit:

- AWS access keys or secret keys
- Cognito tokens or JWTs
- `.env` files with real values
- customer or recipient data
- private certificates or signing keys
- downloaded credential CSVs

Use `.env.example` files and placeholder values for documentation.

If you find a security issue, please do not open a public issue with exploit details. Email `contact@intelligent-routing.com` with a concise report.

---

## Issues

Use GitHub Issues for:

- Bug reports
- Feature requests
- Documentation gaps
- Architecture questions
- Contributor onboarding questions

When reporting a bug, include:

- What you expected
- What happened
- Steps to reproduce
- Relevant logs with secrets removed
- Local/cloud environment details

---

## CI

The repository includes GitHub Actions for:

- Frontend lint/typecheck/build
- Backend Maven build/test
- CDK synth validation
- Basic security checks
- Optional manual frontend deployment with GitHub OIDC

Passing CI is expected before merge. If CI fails for a reason unrelated to your change, mention that in the PR.

Deployment workflows are not triggered by contributor PRs. Use local scripts for your own AWS account, or ask a maintainer before running any workflow that deploys to shared infrastructure.

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thanks again for helping build this. Thoughtful contributions make the system more useful, safer, and easier for the next person to trust.
