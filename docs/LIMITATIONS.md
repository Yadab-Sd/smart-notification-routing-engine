# Known Limitations

## Current System Constraints

### 1. Limited ML Feature Set

**Current**: Only 3 features
- `hour`: Hour of day (0-23)
- `click_rate_7d`: 7-day user click rate  
- `sends_count_hour`: Historical sends per hour

**Missing features** (designed but not implemented):
- Timezone normalization (hour 9 PT ≠ hour 9 ET)
- Day of week (Monday vs Saturday patterns)
- Device type (mobile vs desktop engagement)
- Content category (promotional vs transactional)
- Channel preference (email vs SMS effectiveness)
- Recency (days since last notification)
- Engagement trend (improving vs declining)
- Weather context (outdoor activity notifications)
- User demographics (age, location)
- A/B test variant tracking

**Impact**: Predictions are less accurate than they could be. Adding these features could improve model performance by 20-30%.

**Workaround**: System still provides 40-60% lift over fixed-time delivery with current features.

---

### 2. Cold Start Problem

**Issue**: New users without historical data get population average send time.

**Current behavior**:
- User signs up → no clicks, no sends in DynamoDB
- Decision service sees `clickRate = 0.0`, `sendsCount = 0`
- Model predicts based on hour only (population pattern)
- Result: Same send time for all new users

**Solutions planned**:
1. **Epsilon-greedy exploration**: 20% of time, send at random hour to gather data
2. **Population priors**: Use average click rate from similar user cohort
3. **Transfer learning**: Start with patterns from similar users
4. **Contextual bandits**: Balance exploration vs exploitation

**Current workaround**: After 10+ notifications, user has enough data for personalization.

---

### 3. No Channel Selection

**Issue**: System doesn't choose email vs SMS vs push - you specify channel in API call.

**What should happen**:
- User A prefers email (80% open rate vs 20% SMS)
- User B prefers SMS (70% reply rate vs 10% email)
- System should automatically route to preferred channel

**Why it's missing**: Requires channel-level tracking in ML features and multi-class classifier.

**Workaround**: Client application decides channel based on user preferences table.

---

### 4. AWS Pinpoint Deprecation

**Issue**: AWS is deprecating Pinpoint engagement features (campaigns, segments, analytics) in October 2026.

**What we use**: Only Pinpoint `SendMessages` API for transactional email/SMS (still supported).

**Future migration path**: Switch to Amazon SES directly
- SES supports email natively
- SMS via SNS (better pricing)
- No feature loss for this system

**Timeline**: Plan migration by Q3 2026.

---

### 5. Fixed Training Schedule

**Issue**: Model retrains at 02:00 UTC daily, regardless of data changes.

**Problems**:
- If no new events, training wastes compute ($50-100/run)
- If traffic spike happens, model doesn't adapt until next day
- Timezone-dependent (02:00 UTC = 6pm Pacific)

**Better approach**:
- Event-driven training (trigger when X new events accumulated)
- Multiple training windows per day for high-traffic systems
- Skip training if insufficient new data

**Workaround**: Manually trigger pipeline via Step Functions for urgent updates.

---

### 6. No Multi-Language Support

**Issue**: All templates and content are English-only.

**Missing**:
- Template localization (i18n)
- Language preference in user profile
- Character set handling (Chinese, Arabic, etc.)

**Workaround**: Create separate templates per language, route based on user's `locale` attribute.

---

### 7. Single Region Deployment

**Issue**: System deploys in one AWS region (e.g., us-west-2).

**Implications**:
- Users in Asia/Europe experience higher latency
- No automatic failover if region goes down
- Data residency compliance issues (GDPR)

**Multi-region requirements** (not implemented):
- DynamoDB Global Tables
- S3 Cross-Region Replication
- Multi-region SageMaker endpoints
- Route53 failover routing

**Cost impact**: 2-3x higher for multi-region deployment.

---

### 8. No Built-in A/B Testing

**Issue**: Can't automatically measure engagement lift via A/B testing.

**Current process**:
1. Manually split users into control/treatment groups
2. Control: fixed-time delivery
3. Treatment: ML-optimized delivery
4. Measure engagement difference (manual)

**What's needed**:
- Built-in experiment framework
- Automatic metric tracking (click rate, conversion)
- Statistical significance calculator
- Automatic rollout of winning variant

**Workaround**: External experimentation platform or manual analysis.

---

### 9. Limited Error Handling

**Issues**:
- No retry logic in Lambda functions (fails on transient errors)
- No dead-letter queues (failed events lost)
- Limited circuit breakers; Decision Service falls back to heuristic send-time scoring if SageMaker is unavailable, but other transient failures still need broader retry/DLQ coverage

**Better approach**:
- Lambda retry with exponential backoff
- DLQ for Kinesis events
- Expand fallback/retry coverage beyond send-time scoring

**Current behavior**: Errors logged to CloudWatch, but no automatic recovery.

---

### 10. No Content Personalization

**Issue**: System optimizes *when* to send, not *what* to send.

**Missing**:
- Subject line optimization
- Content recommendation
- Image/text A/B testing
- Dynamic template selection

**Scope**: Intentional limitation - focuses on delivery timing only.

---

### 11. Notification Fatigue Detection

**Issue**: System doesn't prevent sending too many notifications.

**Current**:
- No global rate limiting (can send 100+ notifications/day per user)
- No fatigue detection (if user stops clicking, keep sending)
- No quiet hours support (sends at 3am if predicted optimal)

**Planned**:
- User preference: max notifications/day
- Auto-quiet hours: 10pm-8am (timezone-aware)
- Fatigue score: reduce frequency if engagement drops

**Workaround**: Client application implements rate limiting before calling API.

---

### 12. No Real-Time Model Updates

**Issue**: Model trains nightly, so predictions can be 24 hours stale.

**Scenario**:
- Monday 9am: User clicks notification
- System doesn't learn about this until Tuesday 2am training
- Monday 3pm: Another notification scheduled - uses old model

**Online learning** (not implemented):
- Update model incrementally with each event
- Requires streaming ML framework (Kafka + Flink)
- Complex infrastructure

**Workaround**: Nightly training is sufficient for most use cases (engagement patterns don't change hourly).

---

### 13. No Cost Anomaly Detection

**Issue**: If someone accidentally sends 100M events, AWS bill explodes.

**Missing**:
- AWS Budget alerts (can be configured manually)
- Rate limiting at API Gateway (set to 5000 req/sec but no per-client limit)
- Kinesis shard throttling alerts

**Recommendation**: Set up AWS Budgets with $1000/month alert threshold.

---

### 14. Limited Observability

**Missing**:
- Distributed tracing (AWS X-Ray not enabled)
- Custom metrics dashboard (CloudWatch dashboard exists but limited)
- Model performance degradation alerts
- Data drift detection (model accuracy declining over time)

**Current**: Logs and basic metrics only.

---

### 15. No User Consent Management

**Issue**: System doesn't track user opt-in/opt-out preferences.

**Missing**:
- GDPR consent tracking
- Channel-specific opt-outs (email yes, SMS no)
- Consent audit log
- "Do not send" list

**Critical for**: European deployments, healthcare (HIPAA)

**Workaround**: Client application manages consent, only sends userId to system for users with consent.

---

## Mitigations Summary

| Limitation | Severity | Mitigation | Timeline |
|------------|----------|------------|----------|
| Limited features | Medium | Add 25+ features | Q3 2026 |
| Cold start | Medium | Epsilon-greedy | Q2 2026 |
| No channel selection | Low | Multi-class model | Q4 2026 |
| Pinpoint deprecation | High | Migrate to SES | Q3 2026 |
| Fixed training | Low | Event-driven pipeline | Q4 2026 |
| No i18n | Low | Template localization | Q3 2026 |
| Single region | Medium | Multi-region (if needed) | 2027 |
| No A/B testing | Low | Experiment framework | Q4 2026 |
| Limited error handling | Medium | Retry + DLQ | Q2 2026 |
| No content personalization | N/A | Out of scope | - |
| No fatigue detection | Medium | Rate limiting + quiet hours | Q3 2026 |
| No real-time updates | Low | Online learning (future) | 2027 |
| No cost alerts | High | AWS Budgets setup | Q2 2026 |
| Limited observability | Medium | X-Ray + custom dashboards | Q3 2026 |
| No consent management | High | GDPR compliance | Q2 2026 |

---

**Last Updated**: June 2026
