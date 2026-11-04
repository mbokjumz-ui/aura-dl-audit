import { z } from "zod";
import { readRabFinalization, type FinalizedRab } from "./rab-finalization";
import { workEndDate } from "./rab-schedule";

const text = z.string().max(150);
const party = z.object({ name: text, position: text });
export const rabDraftSchema = z.object({
  vatIncluded: z.boolean(),
  contractors: z.array(z.object({ name: text, amount: z.string().refine(v => v === "" || (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 100000000000000)) })),
  approvers: z.array(party), acknowledgers: z.array(party),
  note: z.string().max(5000),
  workDays: z.string().refine(v => v === "" || (Number.isSafeInteger(Number(v)) && Number(v) > 0)),
  workStartDate: z.string().refine(v => v === "" || !!workEndDate(v, 1)),
  downPayment: z.string().refine(v => v === "" || (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 100)),
  responsiblePosition: text,
}).refine(v => !v.workDays || !v.workStartDate || !!workEndDate(v.workStartDate, Number(v.workDays)));
export type RabDraft = z.infer<typeof rabDraftSchema>;
export function readRabDraft(rab: FinalizedRab & { finalization_draft?: unknown }): RabDraft {
  const draft = rabDraftSchema.safeParse(rab.finalization_draft);
  if (!rab.finalized_at && draft.success) return draft.data;
  const saved = readRabFinalization(rab);
  return {
    vatIncluded: rab.vat_included,
    contractors: saved?.contractors.map(c => ({ name: c.name, amount: String(c.amount) })) ?? [{ name: "", amount: "" }],
    approvers: saved?.approvers ?? [{ name: "", position: "" }],
    acknowledgers: saved?.acknowledgers ?? [{ name: "", position: "" }],
    note: rab.disposition_note ?? "", workDays: rab.work_duration_days ? String(rab.work_duration_days) : "",
    workStartDate: rab.work_start_date ?? "", downPayment: String(rab.down_payment_percent ?? 0), responsiblePosition: rab.responsible_position ?? "",
  };
}
export function draftPreviewValues(draft: RabDraft): FinalizedRab {
  const party = (p: RabDraft["approvers"][number]) => ({ name: p.name.trim() || "—", position: p.position.trim() || "—" });
  return {
    finalized_at: null, vat_included: draft.vatIncluded,
    contractor_quotes: draft.contractors.map(c => ({ name: c.name.trim() || "—", amount: Number(c.amount) || 0 })),
    approvers: draft.approvers.map(party), acknowledgers: draft.acknowledgers.map(party),
    disposition_note: draft.note, work_duration: draft.workDays ? `${draft.workDays} hari kalender` : "",
    work_duration_days: draft.workDays ? Number(draft.workDays) : null, work_start_date: draft.workStartDate || null,
    work_end_date: workEndDate(draft.workStartDate, Number(draft.workDays)) || null,
    down_payment_percent: Number(draft.downPayment) || 0, responsible_position: draft.responsiblePosition,
  };
}