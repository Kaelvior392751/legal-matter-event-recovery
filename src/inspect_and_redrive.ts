import { randomUUID } from "node:crypto";
import { z } from "zod";
import { infraiFromEnvironment } from "./infrai_client.js";

const argsSchema = z.object({
  webhookId: z.string().min(1),
  messageId: z.string().min(1),
});

const [webhookId, messageId] = process.argv.slice(2);
const args = argsSchema.parse({ webhookId, messageId });
const queue = process.env.LEGAL_EVENTS_QUEUE ?? "legal-deadline-follow-up";
const infrai = infraiFromEnvironment();

const deliveries = await infrai.request<unknown>(
  `/v1/account/webhooks/deliveries/${encodeURIComponent(args.webhookId)}`,
  "GET",
);
const redrive = await infrai.request<unknown>(
  `/v1/queue/dlq/redrive/${encodeURIComponent(queue)}`,
  "POST",
  { queue, message_id: args.messageId, idempotency_key: randomUUID() },
  randomUUID(),
);

console.log(JSON.stringify({ deliveries, redrive }, null, 2));
