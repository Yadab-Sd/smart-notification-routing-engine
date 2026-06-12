<div align="center">

# Smart Notification Routing Engine

**ML-Powered Notification Delivery Optimization**

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![AWS](https://img.shields.io/badge/AWS-Serverless-orange)](https://aws.amazon.com/)
[![Java](https://img.shields.io/badge/Java-21-blue)](https://openjdk.org/)
[![Python](https://img.shields.io/badge/Python-3.10-green)](https://www.python.org/)

[Quick Start](#quick-start) • [Architecture](#architecture) • [Documentation](#documentation)

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

**Result**: 40-60% higher engagement vs fixed-time delivery.

---

## Architecture

![Data Flow](docs/diagrams/data-flow.svg)

**Core Components**:
- **Ingestion**: REST API → Kinesis → S3 data lake
- **ML Pipeline**: Glue (Spark) → SageMaker (XGBoost) → Endpoint
- **Delivery**: Decision Lambda → EventBridge Scheduler → Sender Lambda → Pinpoint

Built entirely on AWS serverless (Lambda, SageMaker, Glue, S3, DynamoDB).

[Detailed Architecture](docs/ARCHITECTURE.md) • [Cost Analysis](docs/COST_ANALYSIS.md) • [Limitations](docs/LIMITATIONS.md)

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
cd infra/cdk
cp .env.example .env
nano .env  # Set SENDER_EMAIL

pnpm install
pnpm exec cdk deploy --all
```

Takes 10-15 minutes. Creates 8 CloudFormation stacks.

### Test

```bash
# Get API URL
API_URL=$(aws cloudformation describe-stacks --stack-name SR-Compute \
    --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)

# Health check
curl $API_URL/v1/health
```

[Complete Setup Guide](docs/SETUP.md)

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
# Ingest event
POST /v1/events
{
  "userId": "user_123",
  "type": "CLICK",
  "ts": "2026-06-12T10:30:00Z"
}

# Get optimal send time
POST /v1/decisions/preview
{
  "userId": "user_123",
  "windowStart": 1718186400,
  "windowEnd": 1718272800
}

# Response
{
  "hour": 14,
  "probability": 0.73
}
```

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

### Getting Started
- [Complete Setup Guide](docs/SETUP.md)
- [Configuration](docs/CONFIGURATION.md)
- [Testing](docs/TESTING.md)

### Technical
- [Architecture Deep Dive](docs/ARCHITECTURE.md)
- [ML Pipeline](docs/ML_PIPELINE.md)
- [API Reference](docs/API.md)

### Operations
- [Cost Analysis](docs/COST_ANALYSIS.md)
- [Monitoring](docs/MONITORING.md)
- [Known Limitations](docs/LIMITATIONS.md)

---

## Current Limitations

- Only 3 ML features (missing timezone, day of week, device type)
- Cold start for new users (no historical data)
- No channel selection (email vs SMS)
- Fixed nightly training schedule
- Single region deployment

[Complete Limitations List](docs/LIMITATIONS.md)

---

## Contributing

Areas needing work:
- Add more ML features (timezone, day of week, device)
- Multi-channel optimization
- Cold-start handling (epsilon-greedy)
- Documentation improvements

Fork, make changes, submit PR. Follow existing code style.

---

## License

MIT License - see [LICENSE](LICENSE) for details.

```
Copyright (c) 2025 Yadab Sutradhar
```

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

### 📖 Citation

```bibtex
@software{sutradhar2025notification,
  author = {Sutradhar, Yadab},
  title = {Smart Notification Routing Engine},
  year = {2025},
  url = {https://github.com/Yadab-Sd/smart-notification-routing-engine}
}
```

---

<sub>Built with ❤️ using AWS Serverless • XGBoost • Apache Spark</sub>

<sub>Last updated: June 2026</sub>

</div>
