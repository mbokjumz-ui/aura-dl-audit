import { test } from "node:test";
import assert from "node:assert/strict";
import { rupiahWords, dispositionAmounts } from "./rab-disposition";
import { rabDispositionSchema } from "./rab-finalization";

test("Nominal RAB dan PPN dicetak dalam terbilang rupiah", () => {
  assert.equal(rupiahWords(1110000), "Satu juta seratus sepuluh ribu rupiah");
  assert.equal(rupiahWords(1000000), "Satu juta rupiah");
  assert.equal(rupiahWords(0), "Nol rupiah");
  assert.equal(rupiahWords(1000.25), "Seribu rupiah dua puluh lima sen");
});
test("DP merupakan persen dengan rentang 0 sampai 100", () => {
  const values = { note: "", workDuration: "14 hari", responsiblePosition: "Manajer" };
  for (const downPaymentPercent of [0, 30, 100]) assert.equal(rabDispositionSchema.safeParse({ ...values, downPaymentPercent }).success, true);
  for (const downPaymentPercent of [-1, 101, NaN]) assert.equal(rabDispositionSchema.safeParse({ ...values, downPaymentPercent }).success, false);
});
test("Rincian disposisi memakai leaf RAB dan Include atau Exclude PPN", () => {
  const row = { id: "1", parent_id: null, description: "Pekerjaan", quantity: 10, unit: "unit", unit_price: 100000, actual_quantity: null, sort_order: 0 };
  assert.deepEqual(dispositionAmounts([row], true).totals, { subtotal: 1000000, discount: 0, netSubtotal: 1000000, ppn: 110000, total: 1110000 });
  assert.equal(dispositionAmounts([row], false).totals.total, 1000000);
});
test("Diskon disposisi memotong dasar PPN tanpa mengubah amount rincian", () => {
  const row = { id: "1", parent_id: null, description: "Pekerjaan", quantity: 10, unit: "unit", unit_price: 100000, actual_quantity: null, sort_order: 0 };
  const result = dispositionAmounts([row], true, { discount_type: "percent", discount_value: 10 });
  assert.equal(result.rows[0]?.amount, 1000000);
  assert.equal(result.totals.total, 999000);
});
