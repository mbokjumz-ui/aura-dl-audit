import { test } from "node:test";
import assert from "node:assert/strict";
import { rabTaxTotals, rabFinalizationSchema, rabDiscountTotals, validateRabDiscount } from "./rab-finalization";

const valid = { vatIncluded: true, contractors: [{ name: "Kontraktor A", amount: 1000000 }], approvers: [{ name: "A", position: "Direktur" }], acknowledgers: [{ name: "B", position: "Manager" }] };
test("Include PPN menambahkan 11% ke total nilai RAB", () => {
  assert.deepEqual(rabTaxTotals(1000000, true), { subtotal: 1000000, ppn: 110000, total: 1110000 });
});
test("Exclude PPN tidak menambah pajak", () => {
  assert.deepEqual(rabTaxTotals(1000000, false), { subtotal: 1000000, ppn: 0, total: 1000000 });
});
test("Penawaran sebelum PPN tidak memiliki batas jumlah kontraktor", () => {
  for (const count of [1, 3, 4, 25, 100]) assert.equal(rabFinalizationSchema.safeParse({ ...valid, contractors: Array.from({ length: count }, () => valid.contractors[0]) }).success, true);
  assert.equal(rabFinalizationSchema.safeParse({ ...valid, contractors: [] }).success, false);
});
for (const field of ["approvers", "acknowledgers"] as const) test(`${field} tidak memiliki batas jumlah nama dengan jabatan`, () => {
  for (const count of [1, 2, 3, 25, 100]) assert.equal(rabFinalizationSchema.safeParse({ ...valid, [field]: Array.from({ length: count }, () => valid[field][0]) }).success, true);
  assert.equal(rabFinalizationSchema.safeParse({ ...valid, [field]: [] }).success, false);
  assert.equal(rabFinalizationSchema.safeParse({ ...valid, [field]: [{ name: "A", position: "" }] }).success, false);
});
test("Diskon rupiah memotong RAB sebelum PPN 11%", () => {
  assert.deepEqual(rabDiscountTotals(1000000, true, { discount_type: "rupiah", discount_value: 100000 }), { subtotal: 1000000, discount: 100000, netSubtotal: 900000, ppn: 99000, total: 999000 });
});
test("Diskon persen memotong RAB sebelum PPN", () => {
  assert.equal(rabDiscountTotals(1000000, true, { discount_type: "percent", discount_value: 10 }).total, 999000);
});
test("Diskon Exclude PPN tidak menambahkan pajak", () => {
  assert.equal(rabDiscountTotals(1000000, false, { discount_type: "percent", discount_value: 10 }).total, 900000);
});
test("Diskon nol dan 100 persen aman", () => {
  assert.equal(rabDiscountTotals(1000000, true).total, 1110000);
  assert.equal(rabDiscountTotals(1000000, true, { discount_type: "percent", discount_value: 100 }).total, 0);
});
test("Diskon negatif, persen lebih dari 100 dan rupiah melebihi RAB ditolak", () => {
  assert.throws(() => validateRabDiscount(1000000, "rupiah", 1000001));
  assert.throws(() => validateRabDiscount(1000000, "percent", 101));
  assert.throws(() => validateRabDiscount(1000000, "rupiah", -1));
});
