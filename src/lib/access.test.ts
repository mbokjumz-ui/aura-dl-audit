import { test } from "node:test";
import assert from "node:assert/strict";
import { canAccessPath, canEnterActual, canFinalizeRab, canDeleteFinalRab, roleHome } from "./access";

test("Pembelian dapat mengakses Stock Opname dan dashboard khususnya", () => {
  assert.equal(canAccessPath("purchasing", "/stock-opname"), true);
  assert.equal(canAccessPath("purchasing", "/dashboard-stock-opname"), true);
  assert.equal(canAccessPath("internal_audit", "/dashboard-stock-opname"), true);
  assert.equal(canAccessPath(null, "/dashboard-stock-opname"), false);
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
test("Internal Audit dapat menghapus seluruh RAB final", () => {
  assert.equal(canDeleteFinalRab("internal_audit"), true);
});
test("Pembelian dan pengguna tanpa peran tidak dapat menghapus RAB final", () => {
  assert.equal(canDeleteFinalRab("purchasing"), false);
  assert.equal(canDeleteFinalRab(null), false);
});
test("Tujuan login mengikuti peran dan akun tanpa peran tidak memiliki akses", () => {
  assert.equal(roleHome("purchasing"), "/stock-opname");
  assert.equal(roleHome("internal_audit"), "/dashboard");
  assert.equal(roleHome(null), "/auth");
  assert.equal(canAccessPath(null, "/stock-opname"), false);
});