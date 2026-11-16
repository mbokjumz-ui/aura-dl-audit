import { test } from "node:test";
import assert from "node:assert/strict";
import { purchasePermissions, purchaseEstimateReady, purchaseEstimateTotal } from "./rab-purchase";
import type { OpnameItem } from "./stock-opname";

const item: OpnameItem = { id: "item", parent_id: null, description: "Pekerjaan", quantity: 2, unit: "unit", unit_price: 80, estimated_unit_price: 100, supplier_prices: {}, actual_quantity: null, sort_order: 0 };
test("RAB baru mengunci supplier sebelum persetujuan Pembelian", () => {
  assert.deepEqual(purchasePermissions({ purchase_approval_required: true }), { gated: true, approved: false, editEstimate: true, editSuppliers: false, canFinalize: false });
});
test("persetujuan mengunci perkiraan dan membuka supplier serta finalisasi", () => {
  assert.deepEqual(purchasePermissions({ purchase_approval_required: true, purchase_approved_at: "2026-11-16" }), { gated: true, approved: true, editEstimate: false, editSuppliers: true, canFinalize: true });
});
test("RAB lama tetap memakai alur sebelumnya", () => {
  assert.deepEqual(purchasePermissions({ purchase_approval_required: false }), { gated: false, approved: false, editEstimate: true, editSuppliers: true, canFinalize: true });
});
test("cetakan Pembelian memakai harga perkiraan bukan harga supplier", () => {
  assert.equal(purchaseEstimateTotal([item]), 200);
});
test("cetakan perlu rincian perkiraan lengkap", () => {
  assert.equal(purchaseEstimateReady([]), false);
  assert.equal(purchaseEstimateReady([{ ...item, unit: "" }]), false);
  assert.equal(purchaseEstimateReady([item]), true);
});