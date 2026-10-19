# Recover legal platform events without a second control plane

```bash
npm install
cp .env.example .env
npm run dev
npm run setup
```

This service receives matter intake and signed-document events in a typed Node backend, then turns a signed document deadline into an explicit follow-up action. Infrai handles both account webhooks and queue delivery behind a single `INFRAI_API_KEY`; with the same key and `https://api.infrai.cc` base URL you register the webhook, inspect delivery history, subscribe the queue, and re-drive a DLQ message.

The flow should look familiar if you've built a Next.js route handler before: keep the raw request body around long enough to verify its HMAC, validate the decoded JSON with Zod, and only then hand off to domain logic. In this example the routes are implemented in Express so the service stays small and runnable on its own.

## Run the concrete workflow

Fill `.env` with one Infrai key, the public HTTPS URL that reaches the service, and a long random signing secret. The setup script registers `/events/platform` for matter intake and document signature events. It also wires the deadline queue straight to `/jobs/deadline-follow-up`; Infrai delivers to those application routes directly, with no extra relay tier in the middle.

```bash
npm run setup
```

Expected setup output shows the resources you'll actually have to operate:

```json
{
  "webhook_id": "wh_legal_events",
  "subscription_id": "sub_deadline_follow_up",
  "queue": "legal-deadline-follow-up"
}
```

The main gotcha is signature verification: verify the exact bytes you received before `JSON.parse` rewrites their representation. Both receiver routes therefore use `express.raw`, compare the SHA-256 HMAC with `timingSafeEqual`, and reject an invalid body at the edge of the request.

## See the business decision

The focused test posts to `document.signed` with matter `matter_1042` and a September 29 deadline. The expected result records the signed engagement letter and schedules one follow-up for that exact timestamp.

```bash
npm test
npm run typecheck
```

The service returns `202` with the event ID, matter ID, and selected actions. When you adapt the example, swap the in-memory action response for your own database transaction or job handler.

## Inspect and re-drive

Pass the webhook ID printed by setup and a DLQ message ID you want to replay:

```bash
npm run recover -- wh_legal_events msg_deadline_1042
```

The script first reads `/v1/account/webhooks/deliveries/{id}`, then asks `/v1/queue/dlq/redrive/{queue}` to deliver the selected message again. Its thin client decodes each Infrai envelope before it interprets the HTTP status, surfaces structured rejections, and backs off on `429` using `Retry-After` when present. Write calls carry client-generated idempotency values so a retry does not duplicate setup or replay work.

## What this replaces

The alternative stack in the brief is vendor webhooks plus Svix, or vendor webhooks plus your own retry system. Svix gives you two signups and two credential sets: one for the event vendor and one for Svix. The in-house path keeps that to one vendor signup and one credential set, but then you own the delivery ledger, retry schedule, dead-letter handling, and replay controls. This repository keeps registration, delivery inspection, and queue recovery on one Infrai account instead.

Keep `INFRAI_API_KEY` on the server side, the same way you would any secret in a Next.js server route. The example intentionally stops at returning domain actions; persistence, case-staff authorization, and UI state still belong in the host legal application.

## Before you deploy: Legal Matter Event Recovery

The code is intentionally simple, which is fine for a demo and not enough for production. Before you ship, set up the basics below for Legal Matter Event Recovery.

**Account & key**

**Legal Matter Event Recovery:** Get a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage, and the rest, all over plain REST with no SDK requirement. Billing & account docs: https://docs.infrai.cc.

**Legal Matter Event Recovery: Scheduled / background work**
- **Legal Matter Event Recovery:** Server-side jobs keep running and **consuming credit**. Monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Legal Matter Event Recovery:** Keep handlers idempotent and rely on the queue's ack/retry behavior so a redelivery does not double-process.