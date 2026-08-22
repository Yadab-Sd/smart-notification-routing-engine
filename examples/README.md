# Examples

These examples show minimal API calls against a deployed SNRE API.

Set these environment variables first:

```bash
export SNRE_API_URL="https://your-api-id.execute-api.us-west-2.amazonaws.com"
export SNRE_TOKEN="your-cognito-jwt"
```

Available examples:

| Language | File | What It Does |
|---|---|---|
| Node.js | [`node/send-event.mjs`](node/send-event.mjs) | Sends an optimized event with notification intent |
| Python | [`python/send_event.py`](python/send_event.py) | Sends an optimized event with notification intent |
| Java | [`java/SendEvent.java`](java/SendEvent.java) | Sends an optimized event with notification intent |
| JSON | [`starter-packs/`](starter-packs/) | Example categories, templates, audiences, and campaigns for common organization types |

`POST /v1/events` returns `status: queued` after Kinesis accepts the event. The
actual decision, schedule, or delivery happens asynchronously.

Starter packs are public, non-sensitive configuration examples for healthcare,
education, e-commerce, public service/nonprofit, and financial services
workflows. They are intended to help adopters understand how SNRE can be shaped
for different domains without copying real customer, patient, student, or
financial data.
