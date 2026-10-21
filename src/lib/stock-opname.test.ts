import { test } from "node:test";
import assert from "node:assert/strict";
import { lineAmount, rabTotals, numberedRabRows, opnameCompletion, type OpnameItem } from "./stock-opname";

const item = (p: Partial<OpnameItem>): OpnameItem => ({ id: "x", parent_id: null, description: "", quantity: 0, unit: "", unit_price: 0, actual_quantity: null, sort_order: 0, ...p });

test("RAB points have sequential two-level numbers in display order", () => {
  const rows = numberedRabRows([item({ id: "b", sort_order: 3 }), item({ id: "a2", parent_id: "a", sort_order: 2 }), item({ id: "a", sort_order: 0 }), item({ id: "a1", parent_id: "a", sort_order: 1 })]);
  assert.deepEqual(rows.map(r => [r.item.id, r.number]), [["a", "1"], ["a1", "1.1"], ["a2", "1.2"], ["b", "2"]]);
});

test("closing marks opname complete and records its completion time", () => {
  assert.deepEqual(opnameCompletion(true, new Date("2026-10-21T04:00:00Z")), { status: "selesai", completed_at: "2026-10-21T04:00:00.000Z" });
});

test("reopening clears the completion time", () => {
  assert.deepEqual(opnameCompletion(false), { status: "berjalan", completed_at: null });
});

test("amount is quantity times unit value", () => {
  assert.equal(lineAmount(12.5, 40000), 500000);
});

test("total counts only details, not their parent point, and compares opname to RAB", () => {
  const items = [
    item({ id: "a", quantity: 99, unit_price: 99 }),
    item({ id: "a1", parent_id: "a", quantity: 10, unit_price: 1000, actual_quantity: 8 }),
    item({ id: "a2", parent_id: "a", quantity: 2, unit_price: 500, actual_quantity: 2 }),
    item({ id: "b", quantity: 1, unit_price: 3000 }),
  ];
  const t = rabTotals(items);
  assert.equal(t.rab, 14000);
  assert.equal(t.actual, 9000);
  assert.equal(t.difference, -5000);
  assert.equal(t.counted, 2);
  assert.equal(t.total, 3);
});
