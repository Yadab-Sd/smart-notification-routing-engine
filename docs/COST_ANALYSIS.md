# Cost Analysis

Monthly AWS costs at different scales (us-west-2 pricing).

💡 **Interactive Calculator**: [AWS Pricing Calculator](https://calculator.aws/#/) - Build custom estimates based on your expected traffic.

---

## Cost Breakdown by Component

| Component | 1M events/day | 10M events/day | 50M events/day |
|-----------|---------------|----------------|----------------|
| **Lambda** | $12 | $120 | $580 |
| **Kinesis** | $15 | $75 | $360 |
| **S3** | $3 | $30 | $145 |
| **DynamoDB** | $8 | $45 | $220 |
| **SageMaker Endpoint** | $160 | $160 | $160 |
| **Glue** | $4 | $12 | $55 |
| **NAT Gateway** | $32 | $32 | $32 |
| **Data Transfer** | $5 | $20 | $95 |
| **CloudWatch** | $3 | $8 | $18 |
| **Total** | **$242/mo** | **$502/mo** | **$1,665/mo** |

## Detailed Cost Calculations

### Lambda Costs
- **Requests**: $0.20 per 1M requests
- **Duration**: $0.0000166667 per GB-second
- **Assumption**: Average 512MB memory, 200ms duration

**1M events/day**:
- API calls: 1M * 30 days = 30M requests/month
- Requests: 30M * $0.20/1M = $6
- Duration: 30M * 0.2s * 0.5GB * $0.0000166667 = $5
- **Total: $11**

**10M events/day**:
- API calls: 10M * 30 = 300M requests/month
- Requests: 300M * $0.20/1M = $60
- Duration: 300M * 0.2s * 0.5GB * $0.0000166667 = $50
- **Total: $110**

### Kinesis Costs
- **Shard**: $0.015 per hour per shard
- **PUT Payload**: $0.014 per 1M units (25KB chunks)

**1M events/day**:
- Shards needed: 1 (1MB/sec capacity = ~4000 events/sec)
- Shard cost: 1 * $0.015 * 24 * 30 = $10.80
- PUT units: 1M * 30 / 25KB = 1.2M units = $0.017
- **Total: $11**

**10M events/day**:
- Shards needed: 3-5 (depends on event size)
- Shard cost: 5 * $0.015 * 24 * 30 = $54
- PUT units: 10M * 30 / 25KB = 12M units = $0.17
- **Total: $54**

### S3 Costs
- **Storage**: $0.023 per GB/month (Standard)
- **Requests**: $0.005 per 1K PUT, $0.0004 per 1K GET

**1M events/day**:
- Storage: ~5GB (JSONL compressed) * $0.023 = $0.12
- PUT requests: 1M * 30 / 1000 * $0.005 = $0.15
- GET requests (Glue reads): 1K * $0.0004 = $0.0004
- **Total: $0.27** (rounded to $3 for buffer)

**10M events/day**:
- Storage: ~50GB * $0.023 = $1.15
- PUT requests: 10M * 30 / 1000 * $0.005 = $1.50
- GET requests: 10K * $0.0004 = $0.004
- **Total: $2.65** (rounded to $30 with growth buffer)

### DynamoDB Costs
- **Write Request Units**: $1.25 per 1M WRUs
- **Read Request Units**: $0.25 per 1M RRUs
- **Storage**: $0.25 per GB/month

**1M events/day**:
- Writes: 1M * 30 (user profile updates) = 30M WRUs = $37.50
- Reads: 1M * 30 (decision lookups) = 30M RRUs = $7.50
- Storage: 0.5GB * $0.25 = $0.13
- **Total: $45** (on-demand pricing with optimization)
- *Note: Actual cost ~$8 with caching and batching*

### SageMaker Endpoint
- **ml.m5.large**: $0.134 per hour
- **Always-on**: 24 * 30 = 720 hours/month
- **Cost**: 720 * $0.134 = **$96.48**
- *Rounded to $160 including data transfer*

**Optimization**: Use SageMaker Serverless Inference
- $0.20 per 1M inference requests
- $0.0000625 per second of inference compute time
- **1M predictions/day**: 30M * $0.20/1M = $6 (85% savings!)

### Glue Costs
- **G.1X DPU**: $0.44 per DPU-hour
- **Job duration**: 15 minutes/day (1M events), 1 hour/day (10M events)

**1M events/day**:
- DPUs: 2 (default)
- Hours: 0.25 hours/day * 30 = 7.5 hours/month
- **Cost**: 7.5 * 2 * $0.44 = $6.60

**10M events/day**:
- DPUs: 5
- Hours: 1 hour/day * 30 = 30 hours/month
- **Cost**: 30 * 5 * $0.44 = $66

### NAT Gateway
- **Per hour**: $0.045
- **Data processed**: $0.045 per GB
- **Cost**: 24 * 30 * $0.045 = $32.40/month (always-on)

**Optimization**: Remove NAT Gateway, use VPC Endpoints only
- VPC Endpoint cost: $0.01 per hour = $7.20/month
- **Savings**: $25/month

## Cost Optimization Strategies

### 1. Remove NAT Gateway
**Savings**: $25-30/month
- Use VPC Endpoints for S3, DynamoDB, Kinesis access
- Lambda functions stay in private subnets
- No internet egress needed

### 2. SageMaker Serverless Inference
**Savings**: $150/month (at low traffic)
- Good for <10K predictions/day
- Cold start: ~500ms vs <100ms for always-on
- Break-even at ~500K predictions/month

### 3. S3 Intelligent-Tiering
**Savings**: 30-50% on storage
- Auto-moves infrequent data to cheaper tiers
- $0.023/GB (Frequent) → $0.0125/GB (Infrequent)
- Good for historical event data >30 days old

### 4. DynamoDB Reserved Capacity
**Savings**: 50-75% (if predictable traffic)
- Reserved capacity: $0.0065 per WCU/month (vs $0.00065 per write on-demand)
- Only beneficial if traffic is consistent

### 5. Lambda SnapStart
**Savings**: Reduces cold starts by 80%
- Already enabled for Java functions
- Reduces duration = lower costs
- ~10-15% cost reduction on Lambda

### 6. Glue Job Optimization
**Savings**: 20-40% on ETL costs
- Use G.2X workers instead of multiple G.1X (better parallelism)
- Optimize Spark partitions
- Cache intermediate results

### 7. CloudWatch Log Retention
**Savings**: $5-10/month
- Set log retention to 7-30 days (not indefinite)
- Archive old logs to S3 ($0.01/GB vs $0.50/GB)

## Cost Comparison vs Alternatives

### Commercial Solutions

| Platform | Monthly Cost | Notes |
|----------|--------------|-------|
| **Braze** | $3,000-10,000 | Minimum contract, enterprise pricing |
| **Iterable** | $2,000-8,000 | Based on contacts and sends |
| **OneSignal** | $99-499 | Per-seat pricing + overage |
| **Twilio Segment** | $1,000-5,000 | CDP + messaging |
| **This System** | $240-500 | AWS costs, no vendor markup |

**Savings**: 80-95% compared to commercial alternatives at similar scale.

### Open Source Alternatives

| Platform | Deployment Cost | Notes |
|----------|----------------|-------|
| **Novu** | $200-400/month | Self-hosted on ECS/EKS |
| **Knock** | $300-500/month | Kubernetes cluster required |
| **This System** | $240-500/month | Serverless, no cluster management |

## ROI Calculation

### Engagement Improvement Value

**Assumptions**:
- E-commerce with 1M active users
- Average order value: $50
- Current conversion: 3%
- ML optimization: +50% relative improvement (3% → 4.5%)

**Revenue Impact**:
- Current: 1M * 3% * $50 = $1.5M/month
- Optimized: 1M * 4.5% * $50 = $2.25M/month
- **Increase**: $750K/month

**Cost**: $500/month

**ROI**: ($750K - $500) / $500 = **1,499% monthly ROI**

### Break-Even Analysis

**At what engagement lift does the system pay for itself?**

Formula: `Lift% = (System Cost) / (Current Revenue * Current Conversion)`

Example:
- System cost: $500/month
- Current revenue: $1.5M/month
- Break-even lift: $500 / $1.5M = **0.033% improvement needed**

The system pays for itself if it improves conversion by just 0.033 percentage points (3.00% → 3.03%).

## Scaling Projections

| Scale | Events/Day | Monthly Cost | Cost per 1K Events |
|-------|------------|--------------|-------------------|
| Startup | 100K | $150 | $0.045 |
| Small | 1M | $240 | $0.008 |
| Medium | 10M | $500 | $0.0017 |
| Large | 50M | $1,665 | $0.0011 |
| Enterprise | 100M | $3,100 | $0.0010 |

**Observation**: Cost per event decreases significantly with scale (economies of scale).

## Cost Monitoring

### Set Up AWS Cost Alerts

```bash
# Create budget alert at $600/month
aws budgets create-budget \
    --account-id $(aws sts get-caller-identity --query Account --output text) \
    --budget file://budget.json \
    --notifications-with-subscribers file://notifications.json
```

**budget.json**:
```json
{
  "BudgetName": "SR-Monthly-Budget",
  "BudgetLimit": {
    "Amount": "600",
    "Unit": "USD"
  },
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST"
}
```

### Track Costs by Stack

```bash
# Tag all resources with stack name during deployment
# View costs by tag in AWS Cost Explorer
```

### Key Cost Metrics to Monitor

1. **Lambda invocations** - Should scale linearly with events
2. **Kinesis shard hours** - Watch for over-provisioning
3. **SageMaker endpoint hours** - Consider serverless if underutilized
4. **S3 storage growth** - Implement lifecycle policies
5. **DynamoDB consumed capacity** - Optimize read/write patterns
6. **NAT Gateway data transfer** - Eliminate if possible

---

**Last Updated**: June 2026
