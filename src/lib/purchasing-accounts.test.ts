import { test } from "node:test";
import assert from "node:assert/strict";
import { assertPurchasingDeletionAllowed } from "./purchasing-accounts";

test("Internal Audit dapat menghapus akun Pembelian", () => {
  assert.doesNotThrow(() => assertPurchasingDeletionAllowed("audit", "buyer", true, ["purchasing"]));
});
test("Pembelian dan pengguna tanpa peran tidak dapat menghapus akun", () => {
  assert.throws(() => assertPurchasingDeletionAllowed("buyer", "other", false, ["purchasing"]));
});
test("Akun non-Pembelian dan akun Internal Audit tidak dapat dihapus", () => {
  for (const roles of [[], ["internal_audit"], ["purchasing", "internal_audit"]]) {
    assert.throws(() => assertPurchasingDeletionAllowed("audit", "other", true, roles));
  }
});
test("Penghapusan akun sendiri ditolak", () => {
  assert.throws(() => assertPurchasingDeletionAllowed("self", "self", true, ["purchasing"]));
});