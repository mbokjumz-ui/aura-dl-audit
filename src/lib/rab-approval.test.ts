import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRabApprovalPdf } from "./rab-approval";

test("Lampiran RAB ditandatangani hanya menerima PDF", () => {
  assert.equal(validateRabApprovalPdf({ name: "RAB disetujui.PDF", size: 100 }), "pdf");
  assert.throws(() => validateRabApprovalPdf({ name: "RAB.docx", size: 100 }));
  assert.throws(() => validateRabApprovalPdf({ name: "RAB.pdf", size: 0 }));
  assert.throws(() => validateRabApprovalPdf({ name: "RAB.pdf", size: 20971521 }));
});