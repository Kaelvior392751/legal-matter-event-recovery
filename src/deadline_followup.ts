import { z } from "zod";

export const legalEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("matter.intake.completed"),
    event_id: z.string().min(1),
    matter_id: z.string().min(1),
    occurred_at: z.string().datetime(),
    client_name: z.string().min(1),
  }),
  z.object({
    type: z.literal("document.signed"),
    event_id: z.string().min(1),
    matter_id: z.string().min(1),
    occurred_at: z.string().datetime(),
    document_id: z.string().min(1),
    deadline_at: z.string().datetime().optional(),
  }),
  z.object({
    type: z.literal("deadline.follow_up"),
    event_id: z.string().min(1),
    matter_id: z.string().min(1),
    occurred_at: z.string().datetime(),
    deadline_at: z.string().datetime(),
  }),
]);

export type LegalEvent = z.infer<typeof legalEventSchema>;

export type MatterAction =
  | { kind: "open_matter"; matter_id: string; client_name: string }
  | { kind: "record_signature"; matter_id: string; document_id: string }
  | { kind: "schedule_follow_up"; matter_id: string; due_at: string }
  | { kind: "notify_case_owner"; matter_id: string; due_at: string };

export function decideMatterActions(event: LegalEvent): MatterAction[] {
  if (event.type === "matter.intake.completed") {
    return [{ kind: "open_matter", matter_id: event.matter_id, client_name: event.client_name }];
  }
  if (event.type === "document.signed") {
    const actions: MatterAction[] = [
      { kind: "record_signature", matter_id: event.matter_id, document_id: event.document_id },
    ];
    if (event.deadline_at) {
      actions.push({ kind: "schedule_follow_up", matter_id: event.matter_id, due_at: event.deadline_at });
    }
    return actions;
  }
  return [{ kind: "notify_case_owner", matter_id: event.matter_id, due_at: event.deadline_at }];
}
