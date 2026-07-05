# Local Development

This guide is for contributors who want to build and test code locally. Full AWS
deployment instructions live in [DEPLOYMENT.md](../DEPLOYMENT.md).

## Prerequisites

- Java 21
- Maven 3.8+
- Node.js 20+ or 22+
- pnpm
- AWS CLI v2
- AWS CDK v2
- Docker, optional for local tooling

Run the setup helper if you want the project to install common tools:

```bash
./scripts/setup.sh
```

## Repository Layout

```text
frontend/                 React admin console
services/                 Java Lambda services
infra/cdk/                AWS CDK infrastructure
glue-jobs/                AWS Glue ETL jobs
ml/                       Training helpers and model code
docs/                     Technical documentation
examples/                 API integration examples
```

## Build Backend Services

Build all Lambda services:

```bash
./scripts/build-services.sh
```

Build one service:

```bash
cd services/decision-service
mvn clean package
```

## Build Frontend

```bash
cd frontend
npm ci
npm run build
```

For local development:

```bash
cd frontend
npm run dev
```

The Vite dev server should be used only for local UI work. Cloud-backed API
calls still require a deployed API URL and a valid Cognito token.

## Validate Infrastructure

```bash
cd infra/cdk
pnpm install --frozen-lockfile
pnpm exec cdk synth --no-lookups
```

If `--no-lookups` fails, refresh `cdk.context.json` from an AWS-authenticated
machine and commit the context only when it is safe and environment-neutral.

## Useful Environment Files

```text
infra/cdk/.env.example       CDK configuration template
frontend/.env.example        frontend configuration template
```

Do not commit local `.env`, token, credential, or terminal-variable files.

## Recommended Validation Before PR

```bash
./scripts/build-services.sh
cd frontend && npm ci && npm run build
cd ../infra/cdk && pnpm exec cdk synth --no-lookups
```

If a command cannot be run locally, mention it in the PR.

## Working With AWS Resources

Most contributors can work without deploying AWS resources. Cloud testing is
needed for changes involving:

- API Gateway routes
- Lambda environment variables or IAM policies
- DynamoDB table/index behavior
- Kinesis event flow
- EventBridge Scheduler
- SES/SNS delivery
- SageMaker or Glue

Use test users and synthetic data. Do not use production or regulated data for
contribution work.

