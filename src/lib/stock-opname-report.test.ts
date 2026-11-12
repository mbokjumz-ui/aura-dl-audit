import { test } from "node:test";
import assert from "node:assert/strict";
import { stockOpnameReport } from "./stock-opname-report";
import type { OpnameItem } from "./stock-opname";

const item = (values: Partial<OpnameItem> = {}): OpnameItem => ({ id: "a", parent_id: null, description: "Pekerjaan", quantity: 10, actual_quantity: 4, unit: "m", unit_price: 100000, sort_order: 0, ...values });
test("volume percentage is actual volume divided by disposition volume times 100", () => {
  assert.equal(stockOpnameReport([item()], { vat_included: true }).rows[0]?.volumePercent, 40);
});
test("both amounts use the effective selected RAB unit price, not estimate or supplier comparisons", () => {
  const row = stockOpnameReport([item({ estimated_unit_price: 200000 })], { vat_included: true }).rows[0];
  assert.equal(row?.dispositionAmount, 1000000);
  assert.equal(row?.opnameAmount, 400000);
});
test("rupiah discount is applied to opname proportionally before 11 percent VAT", () => {
  const result = stockOpnameReport([item()], { vat_included: true, discount_type: "rupiah", discount_value: 100000 });
  assert.equal(result.discountPercent, 10);
  assert.deepEqual(result.disposition, { subtotal: 1000000, discount: 100000, netSubtotal: 900000, ppn: 99000, total: 999000 });
  assert.deepEqual(result.opname, { subtotal: 400000, discount: 40000, netSubtotal: 360000, ppn: 39600, total: 399600 });
});
test("percentage discount applies at the same percentage to both totals", () => {
  const result = stockOpnameReport([item()], { vat_included: false, discount_type: "percent", discount_value: 25 });
  assert.equal(result.opname.discount, 100000);
  assert.equal(result.opname.total, 300000);
  assert.equal(result.opname.ppn, 0);
});
test("work achievement uses pre-discount opname amount over disposition amount", () => {
  assert.equal(stockOpnameReport([item()], { vat_included: true, discount_type: "rupiah", discount_value: 100000 }).workPercent, 40);
});
test("cancelled branches are omitted and parent amounts are not counted twice", () => {
  const result = stockOpnameReport([item({ id: "parent", quantity: 99 }), item({ parent_id: "parent" }), item({ id: "cancelled", is_cancelled: true })], { vat_included: false });
  assert.deepEqual(result.rows.map(r => r.item.id), ["parent", "a"]);
  assert.equal(result.disposition.subtotal, 1000000);
  assert.equal(result.opname.subtotal, 400000);
});
test("missing results stay uncounted, zero is recorded, and zero denominators remain finite", () => {
  const result = stockOpnameReport([item({ id: "missing", actual_quantity: null }), item({ id: "zero", quantity: 0, actual_quantity: 0 })], { vat_included: false });
  assert.equal(result.rows[0]?.volumePercent, null);
  assert.equal(result.rows[1]?.volumePercent, 0);
  assert.equal(stockOpnameReport([], { vat_included: false }).workPercent, 0);
});