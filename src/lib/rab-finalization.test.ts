import { test } from "node:test";
import assert from "node:assert/strict";
import { rabTaxTotals, rabFinalizationSchema } from "./rab-finalization";

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