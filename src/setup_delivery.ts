import { randomUUID } from "node:crypto";
import { infraiFromEnvironment } from "./infrai_client.js";

const publicBaseUrl = process.env.PUBLIC_BASE_URL;
const secret = process.env.WEBHOOK_SECRET;
const queue = process.env.LEGAL_EVENTS_QUEUE ?? "legal-deadline-follow-up";
if (!publicBaseUrl || !secret) {
  throw new Error("PUBLIC_BASE_URL and WEBHOOK_SECRET are required");
}

const infrai = infraiFromEnvironment();
const webhook = await infrai.request<{ id: string }>(
  "/v1/account/webhooks/register",
  "POST",
  {
    url: `${publicBaseUrl}/events/platform`,
    events: ["matter.intake.completed", "document.signed"],
    description: "Legal matter intake and signed document delivery",
    secret,
  },
  randomUUID(),
);

const subscription = await infrai.request<{ id: string }>(
  `/v1/queue/push_subscribe/${encodeURIComponent(queue)}`,
  "POST",
  {
    queue,
    url: `${publicBaseUrl}/jobs/deadline-follow-up`,
    secret,
    max_retries: 8,
    visibility_timeout: 60,
    dead_letter_queue: `${queue}-dlq`,
    idempotency_key: randomUUID(),
  },
  randomUUID(),
);

console.log(JSON.stringify({ webhook_id: webhook.id, subscription_id: subscription.id, queue }, null, 2));
