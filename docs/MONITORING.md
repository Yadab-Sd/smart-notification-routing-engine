# Monitoring & Observability

## CloudWatch Logs

### Lambda Function Logs

**Tail logs in real-time**:
```bash
# Control Plane (API)
aws logs tail /aws/lambda/SR-Compute-ControlPlaneFn --follow

# Events Consumer (Kinesis)
aws logs tail /aws/lambda/SR-Compute-EventsConsumerFn --follow

# Decision Service (ML)
aws logs tail /aws/lambda/SR-Compute-DecisionFn --follow

# Sender Service (Notifications)
aws logs tail /aws/lambda/SR-Compute-SenderFn --follow
```

**Search for errors**:
```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/SR-Compute-ControlPlaneFn \
  --filter-pattern "ERROR" \
  --start-time $(date -d '1 hour ago' +%s)000
```

---

## Key Metrics

### Lambda Metrics

**Invocations**:
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=SR-Compute-ControlPlaneFn \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

**Errors**:
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=SR-Compute-ControlPlaneFn \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

**Duration**:
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=SR-Compute-ControlPlaneFn \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum
```

---

### Kinesis Metrics

**Iterator Age** (lag indicator):
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/Kinesis \
  --metric-name GetRecords.IteratorAgeMilliseconds \
  --dimensions Name=StreamName,Value=SR-Data-UserEvents \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Maximum
```

**Incoming Records**:
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/Kinesis \
  --metric-name IncomingRecords \
  --dimensions Name=StreamName,Value=SR-Data-UserEvents \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

---

### SageMaker Metrics

**Model Invocations**:
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/SageMaker \
  --metric-name Invocations \
  --dimensions Name=EndpointName,Value=send-time-v1 \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

**Model Latency**:
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/SageMaker \
  --metric-name ModelLatency \
  --dimensions Name=EndpointName,Value=send-time-v1 \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,p99
```

---

## CloudWatch Alarms

### Lambda Error Rate Alarm

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name SR-Lambda-HighErrors \
  --alarm-description "Alert when Lambda error rate exceeds 5%" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=SR-Compute-ControlPlaneFn \
  --evaluation-periods 2 \
  --treat-missing-data notBreaching
```

### Kinesis Iterator Age Alarm

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name SR-Kinesis-HighLag \
  --alarm-description "Alert when Kinesis lag exceeds 1 minute" \
  --metric-name GetRecords.IteratorAgeMilliseconds \
  --namespace AWS/Kinesis \
  --statistic Maximum \
  --period 60 \
  --threshold 60000 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=StreamName,Value=SR-Data-UserEvents \
  --evaluation-periods 3
```

### SageMaker High Latency Alarm

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name SR-SageMaker-HighLatency \
  --alarm-description "Alert when model latency exceeds 200ms" \
  --metric-name ModelLatency \
  --namespace AWS/SageMaker \
  --statistic Average \
  --period 300 \
  --threshold 200 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=EndpointName,Value=send-time-v1 \
  --evaluation-periods 2
```

---

## Dashboard

**Create CloudWatch dashboard**:

```bash
aws cloudwatch put-dashboard \
  --dashboard-name SmartNotificationRouter \
  --dashboard-body file://dashboard.json
```

**dashboard.json**:
```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/Lambda", "Invocations", {"stat": "Sum"}],
          [".", "Errors", {"stat": "Sum"}],
          [".", "Duration", {"stat": "Average"}]
        ],
        "period": 300,
        "stat": "Average",
        "region": "us-west-2",
        "title": "Lambda Metrics"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/Kinesis", "IncomingRecords", {"stat": "Sum"}],
          [".", "GetRecords.IteratorAgeMilliseconds", {"stat": "Maximum"}]
        ],
        "period": 60,
        "stat": "Average",
        "region": "us-west-2",
        "title": "Kinesis Metrics"
      }
    },
    {
      "type": "log",
      "properties": {
        "query": "SOURCE '/aws/lambda/SR-Compute-ControlPlaneFn' | fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 20",
        "region": "us-west-2",
        "title": "Recent Errors"
      }
    }
  ]
}
```

---

## Log Insights Queries

### Top Error Messages

```sql
SOURCE '/aws/lambda/SR-Compute-ControlPlaneFn'
| fields @timestamp, @message
| filter @message like /ERROR/
| stats count() by @message
| sort count desc
| limit 10
```

### Average Response Time

```sql
SOURCE '/aws/lambda/SR-Compute-ControlPlaneFn'
| fields @duration
| stats avg(@duration), max(@duration), pct(@duration, 95)
```

### User Events by Type

```sql
SOURCE '/aws/lambda/SR-Compute-EventsConsumerFn'
| parse @message "Event type: *" as eventType
| stats count() by eventType
```

---

## Custom Metrics

**Publish custom metric from Lambda**:

```java
// In Lambda code
CloudWatchClient cloudwatch = CloudWatchClient.create();

cloudwatch.putMetricData(PutMetricDataRequest.builder()
    .namespace("SmartRouter")
    .metricData(MetricDatum.builder()
        .metricName("NotificationsSent")
        .value(1.0)
        .unit(StandardUnit.COUNT)
        .dimensions(
            Dimension.builder()
                .name("Channel")
                .value("EMAIL")
                .build()
        )
        .build())
    .build());
```

**Query custom metrics**:
```bash
aws cloudwatch get-metric-statistics \
  --namespace SmartRouter \
  --metric-name NotificationsSent \
  --dimensions Name=Channel,Value=EMAIL \
  --start-time $(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum
```

---

## Distributed Tracing (X-Ray)

**Enable X-Ray** (optional):

```typescript
// infra/cdk/lib/compute-stack.ts
const controlPlane = new lambda.Function(this, 'ControlPlaneFn', {
    tracing: lambda.Tracing.ACTIVE,  // Enable X-Ray
    // ...
});
```

**View traces**:
```bash
aws xray get-trace-summaries \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S)
```

---

## Cost Monitoring

**Set up budget alert**:

```bash
aws budgets create-budget \
  --account-id $(aws sts get-caller-identity --query Account --output text) \
  --budget file://budget.json
```

**budget.json**:
```json
{
  "BudgetName": "SmartRouter-Monthly",
  "BudgetLimit": {
    "Amount": "500",
    "Unit": "USD"
  },
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST"
}
```

---

## Health Checks

**API health check script**:

```bash
#!/bin/bash

API_URL="https://your-api-id.execute-api.us-west-2.amazonaws.com"

# Check health endpoint
STATUS=$(curl -s -o /dev/null -w "%{http_code}" $API_URL/v1/health)

if [ "$STATUS" == "200" ]; then
    echo "✅ API is healthy"
else
    echo "❌ API is down (HTTP $STATUS)"
    # Send alert
fi
```

**Run every 5 minutes via cron**:
```bash
*/5 * * * * /path/to/health-check.sh
```

---

**Last Updated**: June 2026
