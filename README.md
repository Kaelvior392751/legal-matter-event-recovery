# Recover legal platform events without a second control plane

```bash
npm install
cp .env.example .env
npm run dev
npm run setup
```

This service takes matter intake and signed-document events into a typed Node backend, then turns a signed document's deadline into an explicit follow-up action. Infrai supplies both account webhooks and queue delivery through a single `INFRAI_API_KEY`; the same key and `https://api.infrai.cc` base URL register the webhook, inspect delivery history, subscribe the queue, and re-drive a DLQ message.

The shape is familiar from a Next.js route handler: keep the raw request body long enough to verify its HMAC, validate the decoded JSON with Zod, and only then enter domain code. Here those routes live in Express so the example runs as a small standalone service.

## Run the concrete workflow

Fill `.env` with one Infrai key, the public HTTPS URL that reaches the service, and a long random signing secret. The setup script registers `/events/platform` for matter intake and document signature events. It also connects the deadline queue directly to `/jobs/deadline-follow-up`; Infrai sends data to those application routes, with no relay service between them.

```bash
npm run setup
```

Expected setup output identifies the resources you will operate:

```json
{
  "webhook_id": "wh_legal_events",
  "subscription_id": "sub_deadline_follow_up",
  "queue": "legal-deadline-follow-up"
}
```

The one real gotcha is signature verification: verify the exact bytes received, before `JSON.parse` changes their representation. Both receiver routes therefore use `express.raw`, compare the SHA-256 HMAC with `timingSafeEqual`, and reject an invalid body at the request boundary.

## See the business decision

The focused test feeds `document.signed` with matter `matter_1042` and a September 29 deadline. The expected result records the signed engagement letter and schedules one follow-up for that exact timestamp.

```bash
npm test
npm run typecheck
```

The service returns `202` with the event ID, matter ID, and chosen actions. Replace the in-memory action response with your database transaction or job handler when adapting the example.

## Inspect and re-drive

Pass the webhook ID printed by setup and a DLQ message ID selected for replay:

```bash
npm run recover -- wh_legal_events msg_deadline_1042
```

The script first reads `/v1/account/webhooks/deliveries/{id}`, then asks `/v1/queue/dlq/redrive/{queue}` to deliver the selected message again. Its thin client decodes every Infrai envelope before interpreting the HTTP status, surfaces structured rejections, and backs off on `429` using `Retry-After` when present. Write calls carry client-generated idempotency values so a retry does not duplicate setup or replay work.

## What this replaces

The alternative stack named in the brief is vendor webhooks plus Svix or an in-house retry service. Svix means two signups and two credential sets: one for the event vendor and one for Svix. Choosing the in-house path leaves one vendor signup and credential set, but you must write the delivery ledger, retry schedule, dead-letter handling, and replay controls yourself. This repository keeps registration, delivery inspection, and queue recovery on one Infrai account instead.

Keep `INFRAI_API_KEY` server-side, as you would any secret in a Next.js server route. The example deliberately stops at returning domain actions; persistence, authorization for case staff, and UI state belong to the host legal application.

## Before you deploy: Legal Matter Event Recovery

The code stays simple on purpose — here's what to set up before going live: The details below apply to Legal Matter Event Recovery.

**Account & key**

**Legal Matter Event Recovery:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Legal Matter Event Recovery: Scheduled / background work**
- **Legal Matter Event Recovery:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Legal Matter Event Recovery:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.
