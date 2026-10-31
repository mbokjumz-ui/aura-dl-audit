import { test } from "node:test";
import assert from "node:assert/strict";
import { canAccessPath, canEnterActual, canFinalizeRab, roleHome } from "./access";

test("Pembelian hanya dapat mengakses Stock Opname", () => {
  assert.equal(canAccessPath("purchasing", "/stock-opname"), true);
  for (const path of ["/dashboard", "/proyek", "/proyek/123", "/auditor", "/arsip", "/arsip-iso", "/tindak-lanjut", "/akun-pembelian"]) assert.equal(canAccessPath("purchasing", path), false);
});
test("Hanya Internal Audit dapat memasukkan angka riil", () => {
  assert.equal(canEnterActual("purchasing"), false);
  assert.equal(canEnterActual(null), false);
  assert.equal(canEnterActual("internal_audit"), true);
});
test("Pembelian dan Internal Audit dapat memfinalisasi RAB", () => {
  assert.equal(canFinalizeRab("purchasing"), true);
  assert.equal(canFinalizeRab("internal_audit"), true);
  assert.equal(canFinalizeRab(null), false);
});
test("Tujuan login mengikuti peran dan akun tanpa peran tidak memiliki akses", () => {
  assert.equal(roleHome("purchasing"), "/stock-opname");
  assert.equal(roleHome("internal_audit"), "/dashboard");
  assert.equal(roleHome(null), "/auth");
  assert.equal(canAccessPath(null, "/stock-opname"), false);
});