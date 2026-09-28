import { createHmac, timingSafeEqual } from "node:crypto";
import express, { type Request, type Response } from "express";
import { ZodError } from "zod";
import { decideMatterActions, legalEventSchema } from "./deadline_followup.js";

const app = express();
app.use(express.raw({ type: "application/json", limit: "256kb" }));

function verifySignature(rawBody: Buffer, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const supplied = signature.replace(/^sha256=/, "");
  const expectedBuffer = Buffer.from(expected, "hex");
  const suppliedBuffer = Buffer.from(supplied, "hex");
  return expectedBuffer.length === suppliedBuffer.length
    && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function receiveLegalEvent(req: Request, res: Response): void {
  const secret = process.env.WEBHOOK_SECRET;
  const signature = req.header("x-infrai-signature");
  if (!secret || !signature || !Buffer.isBuffer(req.body) || !verifySignature(req.body, signature, secret)) {
    res.status(401).json({ error: "invalid signature" });
    return;
  }

  try {
    const event = legalEventSchema.parse(JSON.parse(req.body.toString("utf8")));
    const actions = decideMatterActions(event);
    res.status(202).json({ event_id: event.event_id, matter_id: event.matter_id, actions });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      res.status(400).json({ error: "invalid legal event" });
      return;
    }
    throw error;
  }
}

app.post("/events/platform", receiveLegalEvent);
app.post("/jobs/deadline-follow-up", receiveLegalEvent);

const port = Number(process.env.PORT ?? "3000");
app.listen(port, () => console.log(`Legal event receiver listening on ${port}`));
