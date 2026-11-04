import { test } from "node:test";
import assert from "node:assert/strict";
import { rabDraftSchema, readRabDraft, draftPreviewValues } from "./rab-draft";

const initial = { finalized_at: null, vat_included: false, contractor_quotes: [], approvers: [], acknowledgers: [] };
test("draft permits incomplete finalization and restores all entered inputs", () => {
  const draft = { ...readRabDraft(initial), note: "Catatan sementara", contractors: [{ name: "Kontraktor", amount: "" }], downPayment: "30" };
  assert.equal(rabDraftSchema.safeParse(draft).success, true);
  assert.deepEqual(readRabDraft({ ...initial, finalization_draft: draft }), draft);
});
test("preview uses current draft values and does not finalize", () => {
  const draft = { ...readRabDraft(initial), vatIncluded: true, workDays: "14", workStartDate: "2026-11-04", downPayment: "30" };
  const preview = draftPreviewValues(draft);
  assert.equal(preview.finalized_at, null);
  assert.equal(preview.vat_included, true);
  assert.equal(preview.work_end_date, "2026-11-17");
  assert.equal(preview.down_payment_percent, 30);
});