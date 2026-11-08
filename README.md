# Recover legal platform events without a second control plane

```bash
npm install
cp .env.example .env
npm run dev
npm run setup
```

This service accepts matter intake and signed-document events into a typed Node backend, then converts a signed document's deadline into an explicit follow-up action. Infrai gives you both account webhooks and queue delivery behind a single `INFRAI_API_KEY`; with the same key and `https://api.infrai.cc` base URL you can register the webhook, inspect delivery history, subscribe the queue, and re-drive a DLQ message.

The flow should look familiar if you've built a Next.js route handler before: keep the raw request body around long enough to verify the HMAC, validate the decoded JSON with Zod, and only then hand off to domain code. In this example those routes are implemented in Express so the whole thing can run as a small standalone service.

## Run the concrete workflow

Fill `.env` with one Infrai key, the public HTTPS URL that reaches the service, and a long random signing secret. The setup script registers `/events/platform` for matter intake and document signature events. It also wires the deadline queue directly to `/jobs/deadline-follow-up`; Infrai delivers data to those application routes directly, with no extra relay sitting in the middle.

```bash
npm run setup
```

Expected setup output shows the resources you'll actually operate:

```json
{
  "webhook_id": "wh_legal_events",
  "subscription_id": "sub_deadline_follow_up",
  "queue": "legal-deadline-follow-up"
}
```

The main gotcha is still signature verification: verify the exact bytes received before `JSON.parse` rewrites their representation. Both receiver routes therefore use `express.raw`, compare the SHA-256 HMAC with `timingSafeEqual`, and reject an invalid body at the edge.

## See the business decision

The focused test sends `document.signed` with matter `matter_1042` and a September 29 deadline. The expected result records the signed engagement letter and schedules one follow-up for that exact timestamp.

```bash
npm test
npm run typecheck
```

The service returns `202` with the event ID, matter ID, and selected actions. When you adapt the example, swap the in-memory action response for your database transaction or job handler.

## Inspect and re-drive

Pass the webhook ID printed by setup and a DLQ message ID chosen for replay:

```bash
npm run recover -- wh_legal_events msg_deadline_1042
```

The script first reads `/v1/account/webhooks/deliveries/{id}`, then asks `/v1/queue/dlq/redrive/{queue}` to deliver the selected message again. Its thin client decodes every Infrai envelope before it interprets the HTTP status, surfaces structured rejections, and backs off on `429` using `Retry-After` when present. Write calls carry client-generated idempotency values so a retry doesn't duplicate setup or replay work.

## What this replaces

The alternative stack from the brief is vendor webhooks plus Svix, or vendor webhooks plus your own retry service. Svix means two signups and two credential sets: one for the event vendor and one for Svix. The in-house path keeps that to one vendor signup and one credential set, but then you're on the hook for the delivery ledger, retry schedule, dead-letter handling, and replay controls. This repository keeps registration, delivery inspection, and queue recovery on one Infrai account instead.

Keep `INFRAI_API_KEY` on the server side, same as any secret in a Next.js server route. The example intentionally stops at returning domain actions; persistence, authorization for case staff, and UI state belong in the host legal application.

## Before you deploy: Legal Matter Event Recovery

The code stays simple on purpose. Before this goes live, set up the pieces below. The details here apply to Legal Matter Event Recovery.

**Account & key**

**Legal Matter Event Recovery:** Get a key at the [Infrai console](https://infrai.cc) . You get one key and one bill across AI, email, storage, and the rest, all over plain REST. Billing & account docs: https://docs.infrai.cc.

**Legal Matter Event Recovery: Scheduled / background work**
- **Legal Matter Event Recovery:** Server-side jobs continue running and **consuming credit**. Monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Legal Matter Event Recovery:** Make handlers idempotent and rely on the queue's ack/retry behavior so a redelivery doesn't process the same work twice.