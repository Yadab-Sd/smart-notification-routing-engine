# Starter Notification Packs

These starter packs show how adopters can configure SNRE for common
organization types without starting from a blank category, template, audience,
and campaign library.

The examples are intentionally generic. They do not contain real personal
data, health data, financial data, or production performance claims.

## What Is In A Pack?

Each JSON file contains:

- `categories`: policy defaults for notification types.
- `templates`: reusable subject/body content with placeholders.
- `audiences`: example user ID lists for campaign preview or launch.
- `campaigns`: saved message plans that reference categories and templates.

The payloads match the public API concepts:

- `POST /v1/categories`
- `POST /v1/templates`
- `POST /v1/audiences`
- `POST /v1/campaigns`

## Available Packs

| Pack | File | Example Use Cases |
| --- | --- | --- |
| Healthcare | [`healthcare.json`](healthcare.json) | Appointment reminders, care follow-ups, billing notices |
| Education | [`education.json`](education.json) | Class reminders, deadline alerts, learning nudges |
| E-commerce | [`ecommerce.json`](ecommerce.json) | Abandoned carts, delivery updates, renewal reminders |
| Public Service / Nonprofit | [`public-service.json`](public-service.json) | Community notices, benefit reminders, event updates |
| Financial Services | [`financial-services.json`](financial-services.json) | Payment reminders, account notices, fraud/security alerts |

## How To Use

1. Create real users in your own environment first.
2. Replace the sample `userIds` with your non-sensitive test user IDs.
3. Create the categories, templates, audiences, and campaigns through the admin
   UI or API.
4. Preview campaigns before launching so Attention Escrow can estimate send,
   schedule, and defer outcomes.
5. Adjust business value, urgency, priority, delivery mode, and max delay to
   match your organization policy.

For API field details, see [`docs/API.md`](../../docs/API.md).

## Customization Notes

- `defaultDeliveryMode: "IMMEDIATE"` should use `maxDelayHours: 0`.
- `defaultDeliveryMode: "OPTIMIZED"` allows SNRE to search a delivery window.
- Higher `businessValue` and `urgency` should be reserved for messages that
  are genuinely important.
- `priorityClass` should not be inflated for routine messages; otherwise the
  system loses the ability to protect user attention.
- Custom template variables, such as `{{appointmentTime}}`, should be supplied
  during campaign launch or event submission.

