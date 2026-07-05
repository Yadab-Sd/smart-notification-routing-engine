import json
import os
from datetime import datetime, timezone
from urllib import request, error


api_url = os.environ.get("SNRE_API_URL")
token = os.environ.get("SNRE_TOKEN")

if not api_url or not token:
    raise SystemExit("Set SNRE_API_URL and SNRE_TOKEN before running this example.")

payload = {
    "userId": "example_user_1",
    "email": "example.user@example.com",
    "firstName": "Example",
    "type": "ABANDONED_CART",
    "ts": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "notification": {
        "deliveryMode": "OPTIMIZED",
        "channel": "EMAIL",
        "message": "You left something in your cart.",
        "sourceId": "campaign:example_abandoned_cart",
        "campaignId": "example_abandoned_cart",
        "messageCategory": "MARKETING",
        "priorityClass": "LOW",
        "businessValue": 6.0,
        "urgency": 0.3,
        "maxDelayHours": 24,
        "metadata": {
            "subject": "Complete your order"
        }
    }
}

req = request.Request(
    f"{api_url}/v1/events",
    data=json.dumps(payload).encode("utf-8"),
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    },
    method="POST",
)

try:
    with request.urlopen(req, timeout=20) as res:
        print(res.status, res.read().decode("utf-8"))
except error.HTTPError as exc:
    print(exc.code, exc.read().decode("utf-8"))
    raise

