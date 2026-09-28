import assert from "node:assert/strict";
import test from "node:test";
import { decideMatterActions, legalEventSchema } from "../src/deadline_followup.js";

test("a signed document with a deadline records delivery and schedules follow-up", () => {
  const event = legalEventSchema.parse({
    type: "document.signed",
    event_id: "evt_2026_0915",
    matter_id: "matter_1042",
    occurred_at: "2026-09-15T09:00:00.000Z",
    document_id: "engagement_letter_7",
    deadline_at: "2026-09-29T09:00:00.000Z",
  });

  assert.deepEqual(decideMatterActions(event), [
    { kind: "record_signature", matter_id: "matter_1042", document_id: "engagement_letter_7" },
    { kind: "schedule_follow_up", matter_id: "matter_1042", due_at: "2026-09-29T09:00:00.000Z" },
  ]);
});
