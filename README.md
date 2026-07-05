<div align="center">

# Smart Notification Routing Engine

**ML-Powered Notification Delivery Optimization**

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![DOI](https://zenodo.org/badge/1075035783.svg)](https://zenodo.org/badge/latestdoi/1075035783)
[![AWS](https://img.shields.io/badge/AWS-Serverless-orange)](https://aws.amazon.com/)
[![Java](https://img.shields.io/badge/Java-21-blue)](https://openjdk.org/)
[![Python](https://img.shields.io/badge/Python-3.10-green)](https://www.python.org/)

[Quick Start](#quick-start) • [Deploy](DEPLOYMENT.md) • [Docs](docs/README.md) • [Architecture](#architecture) • [Contribute](CONTRIBUTING.md)

</div>

---

## What This Does

Learns when each user is most likely to engage with notifications, then automatically schedules delivery at those times.

**The Problem**: Most apps send notifications at fixed times (9am, 6pm). Users ignore them because they arrive during meetings, sleep, or commutes.

**This Solution**: 
1. Tracks when users click notifications
2. Trains an XGBoost model on this data (nightly)
3. Predicts best send time per user (real-time)
4. Schedules delivery accordingly

**Pilot goal**: Validate whether user-specific timing and attention-aware routing improve engagement, reduce fatigue, and lower risky sends compared with fixed-time delivery.

**Production metrics note**: This project has not yet been validated with
production customer data. Engagement lift, accuracy, latency, throughput, ROI,
cost, and reliability must be measured in each adopter's own AWS account before
making production claims.

---

## Architecture

![High Level Architecture Diagram](docs/diagrams/SNRE_TECHNICAL_ARCHITECTURE.svg)

![Data Flow](docs/diagrams/data-flow.svg)

**Core Components**:
- **Ingestion**: React console/API clients → API Gateway + Cognito → Control Plane Lambda → Kinesis → S3 data lake + DynamoDB
- **ML Pipeline**: Glue (Spark) → SageMaker (XGBoost) → Endpoint
- **Attention Escrow**: Decision Lambda scores attention cost/value before scheduling
- **Category Policies**: Admin console/API manages organization-specific notification defaults that remain overrideable per send
- **Template Library**: Admin console/API stores reusable subject/body templates with variables like `{{name}}`, `{{firstName}}`, `{{email}}`, and custom placeholders, then loads them into Campaigns, Send Event, and Attention Escrow workflows
- **Delivery**: EventBridge Scheduler → Sender Lambda → Email (SES) / SMS (SNS)
- **Feedback**: SES configuration set → SNS bounce/complaint topics → SES Event Processor Lambda → suppression and audit tables

Built entirely on AWS serverless (Lambda, SageMaker, Glue, S3, DynamoDB).

[Detailed Architecture](docs/ARCHITECTURE.md) • [Deployment Guide](DEPLOYMENT.md) • [Cost Analysis](docs/COST_ANALYSIS.md) • [Limitations](docs/LIMITATIONS.md)

---

## Quick Start

### One-Click Setup

```bash
git clone https://github.com/Yadab-Sd/smart-notification-routing-engine.git
cd smart-notification-routing-engine
./scripts/setup.sh
```

This installs AWS CLI, Node.js, Java, Maven, CDK and configures everything.

### Deploy

```bash
# Set SENDER_EMAIL in infra/cdk/.env first

# Deploy infrastructure
./scripts/deploy-infra.sh

# Build, upload, and invalidate the frontend
./scripts/deploy-frontend.sh
```

Takes 10-15 minutes. Creates 8 CloudFormation stacks.

For GitHub-based frontend deployment, use the optional manual `Frontend Deploy` workflow after configuring AWS OIDC.

### Test

```bash
# Get API URL
API_URL=$(aws cloudformation describe-stacks --stack-name SR-Compute \
    --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)

# Health check
curl $API_URL/v1/health
```

[Complete Setup Guide](docs/SETUP.md) • [Deployment Guide](DEPLOYMENT.md)

---

## How It Works

### ML Model

**Predicts**: Will user click notification sent at hour X?

**Features** (current):
- Hour of day (0-23)
- User's 7-day click rate
- Historical send volume per hour

**Algorithm**: XGBoost binary classifier (200 trees, depth 6)

**Training**: Nightly at 02:00 UTC on last 30 days of data

**Inference**: Iterate through next 24-48 hours, pick hour with highest predicted click probability.

### API

```bash
# 1. Create user (required first)
POST /v1/users

# 2. Track events
POST /v1/events

# 3. Optional: create reusable notification categories
POST /v1/categories

# 4. Optional: create reusable message templates
POST /v1/templates

# 5. Get optimal send time
POST /v1/decisions/preview

# Response
{
  "userId": "user_123",
  "hour": 14,
  "probability": 0.73,
  "attentionDecision": "SEND",
  "attentionCost": 2.4,
  "attentionValue": 5.9,
  "attentionReason": "Predicted value exceeds attention cost"
}
```

[User Management API](docs/USER_MANAGEMENT.md) • [Multi-Channel Guide](docs/MULTI_CHANNEL.md)

---

## Configuration

**Primary config**: `infra/cdk/.env`
```
SENDER_EMAIL=notifications@yourdomain.com
```

**Important**: Email must be verified in Amazon SES before deployment.

```bash
aws sesv2 create-email-identity --email-identity notifications@yourdomain.com
```

---

## Cost

Monthly AWS costs:

| Scale | Events/Day | Cost/Month |
|-------|------------|------------|
| Small | 1M | $240 |
| Medium | 10M | $500 |
| Large | 50M | $1,665 |

[Detailed Cost Breakdown](docs/COST_ANALYSIS.md)

---

## Development

**Make code changes**:
```bash
./scripts/build-services.sh
cd infra/cdk && pnpm exec cdk deploy SR-Compute
```

**View logs**:
```bash
aws logs tail /aws/lambda/SR-Compute-ControlPlaneFn --follow
```

**Destroy everything**:
```bash
cd infra/cdk && pnpm exec cdk destroy --all
```

---

## Documentation

Start with the [Documentation Index](docs/README.md) if you are new to the
project.

### Features
- **[FEATURES.md](FEATURES.md)** - Complete list of all 18+ features (ML optimization, multi-channel, SES compliance, analytics, etc.)

### Getting Started
- [Complete Setup Guide](docs/SETUP.md)
- [Deployment Guide](DEPLOYMENT.md)
- [Local Development](docs/LOCAL_DEVELOPMENT.md)
- [API Examples](examples/README.md)
- [User Management API](docs/USER_MANAGEMENT.md)
- [Multi-Channel Guide](docs/MULTI_CHANNEL.md)

### Technical
- [Architecture Deep Dive](docs/ARCHITECTURE.md)
- [Architecture Decisions](docs/DECISIONS/README.md)
- [Channel Architecture (Strategy Pattern)](docs/CHANNEL_ARCHITECTURE.md)
- [Attention Escrow](docs/ATTENTION_ESCROW.md)
- [ML Pipeline](docs/ML_PIPELINE.md)
- [API Reference](docs/API.md)
- [Roadmap](docs/ROADMAP.md)

### Operations
- [Cost Analysis](docs/COST_ANALYSIS.md)
- [Monitoring](docs/MONITORING.md)
- [Operations Runbook](docs/OPERATIONS.md)
- [Threat Model](docs/THREAT_MODEL.md)
- [Known Limitations](docs/LIMITATIONS.md)
- [SES Production Access](docs/ses/SES_PRODUCTION_ACCESS.md)
- [Compliance Guidance](docs/legal/COMPLIANCE.md)
- [US Impact & Government Alignment](docs/US_IMPACT.md)

---

## License

MIT License - see [LICENSE](LICENSE) for details.

```
Copyright (c) 2025 Yadab Sutradhar
```

---

## Adoption And Setup Support

Organizations can self-deploy this project in their own AWS account, modify it
under the MIT license, and evaluate it with their own notification workflows.

For pilot, adoption, or free setup-support inquiries, visit
[get.intelligent-routing.com](https://get.intelligent-routing.com).

## 🚀 For Contributors

Help improve the system through issues, pull requests, tests, docs, integrations,
and implementation feedback.

👉 **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Contributor guidelines

---
<div align="center">

## 📬 Contact

**Yadab Sutradhar**

[![Email](https://img.shields.io/badge/Email-yadab.sd2013%40gmail.com-red?style=for-the-badge&logo=gmail&logoColor=white)](mailto:yadab.sd2013@gmail.com)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-yadab--sutradhar-blue?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/yadab-sutradhar)
[![GitHub](https://img.shields.io/badge/GitHub-%40Yadab--Sd-black?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Yadab-Sd)

---

### 🤝 Support

[![Issues](https://img.shields.io/github/issues/Yadab-Sd/smart-notification-routing-engine?style=flat-square)](https://github.com/Yadab-Sd/smart-notification-routing-engine/issues)
[![Discussions](https://img.shields.io/github/discussions/Yadab-Sd/smart-notification-routing-engine?style=flat-square)](https://github.com/Yadab-Sd/smart-notification-routing-engine/discussions)

Report bugs • Request features • Ask questions

---

</div>

### 📖 Citation

```bibtex
@software{yadab_sutradhar_2026_20707474,
  author       = {Yadab Sutradhar},
  title        = {Yadab-Sd/smart-notification-routing-engine: v2.6.0
                   - Template Library Release - 07/04/2026
                  },
  month        = jul,
  year         = 2026,
  publisher    = {Zenodo},
  version      = {v2.6.0},
  doi          = {10.5281/zenodo.20707474},
  url          = {https://doi.org/10.5281/zenodo.20707474},
}
```

---

<sub>Built with ❤️ using AWS Serverless • XGBoost • Apache Spark</sub>

<sub>Last updated: July 2026</sub>
