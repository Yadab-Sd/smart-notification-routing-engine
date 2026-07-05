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

`POST /v1/events` returns `status: queued` after Kinesis accepts the event. The
actual decision, schedule, or delivery happens asynchronously.

