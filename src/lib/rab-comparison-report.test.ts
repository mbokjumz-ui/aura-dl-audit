import { test } from "node:test";
import assert from "node:assert/strict";
import { rabComparisonReport } from "./rab-comparison-report";
import type { OpnameItem } from "./stock-opname";

const a = "00000000-0000-4000-8000-000000000001";
const b = "00000000-0000-4000-8000-000000000002";
const suppliers = [{ id: a, name: "Supplier 1" }, { id: b, name: "Supplier 2" }];
const item: OpnameItem = { id: "item", parent_id: null, description: "Pekerjaan", quantity: 10, unit: "m", unit_price: 90000, estimated_unit_price: 100000, supplier_prices: { [a]: 80000, [b]: 90000 }, actual_quantity: null, sort_order: 0 };

test("each comparison multiplies its own price by volume and totals independently", () => {
  assert.deepEqual(rabComparisonReport([item], { suppliers }).map(s => s.totals?.total), [1000000, 800000, 900000]);
});
test("percentage discount reduces each source total before the comparison grand total", () => {
  const sources = rabComparisonReport([item], { suppliers, discount_type: "percent", discount_value: 10 });
  assert.deepEqual(sources.map(s => s.totals?.discount), [100000, 80000, 90000]);
  assert.deepEqual(sources.map(s => s.totals?.total), [900000, 720000, 810000]);
});
test("rupiah discount reduces each source by the stored nominal amount", () => {
  assert.deepEqual(rabComparisonReport([item], { suppliers, discount_type: "rupiah", discount_value: 100000 }).map(s => s.totals?.total), [900000, 700000, 800000]);
});
test("cancelled rows do not inflate totals and incomplete supplier prices stay unknown", () => {
  const sources = rabComparisonReport([{ ...item, supplier_prices: { [a]: 80000 } }, { ...item, id: "cancelled", is_cancelled: true }], { suppliers });
  assert.deepEqual(sources.map(s => s.totals?.subtotal ?? null), [1000000, 800000, null]);
});