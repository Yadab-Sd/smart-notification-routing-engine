const apiUrl = process.env.SNRE_API_URL;
const token = process.env.SNRE_TOKEN;

if (!apiUrl || !token) {
  throw new Error("Set SNRE_API_URL and SNRE_TOKEN before running this example.");
}

const payload = {
  userId: "example_user_1",
  email: "example.user@example.com",
  firstName: "Example",
  type: "ABANDONED_CART",
  ts: new Date().toISOString(),
  notification: {
    deliveryMode: "OPTIMIZED",
    channel: "EMAIL",
    message: "You left something in your cart.",
    sourceId: "campaign:example_abandoned_cart",
    campaignId: "example_abandoned_cart",
    messageCategory: "MARKETING",
    priorityClass: "LOW",
    businessValue: 6.0,
    urgency: 0.3,
    maxDelayHours: 24,
    metadata: {
      subject: "Complete your order"
    }
  }
};

const response = await fetch(`${apiUrl}/v1/events`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify(payload)
});

const body = await response.text();
console.log(response.status, body);

