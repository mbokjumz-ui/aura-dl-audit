import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

test("both roles save independent discounts and finalization pulls the selected supplier discount, not submitted values", async () => {
  const url = process.env["SUPABASE_URL"], key = process.env["SUPABASE_SERVICE_ROLE_KEY"], pub = process.env["SUPABASE_PUBLISHABLE_KEY"];
  assert.ok(url && key && pub);
  const admin = createClient(url, key, { auth: { persistSession: false } });
  for (const role of ["internal_audit", "purchasing"]) {
    let userId: string | undefined, rabId: string | undefined;
    try {
      const email = `source-discount-${crypto.randomUUID()}@example.com`, password = crypto.randomUUID() + "aA1";
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      assert.equal(created.error, null); assert.ok(created.data.user); userId = created.data.user.id;
      assert.equal((await admin.from("user_roles").insert({ user_id: userId, role })).error, null);
      const client: SupabaseClient = createClient(url, pub, { auth: { persistSession: false } });
      assert.equal((await client.auth.signInWithPassword({ email, password })).error, null);
      const a = crypto.randomUUID(), b = crypto.randomUUID();
      const rab = await client.from("stock_opname_projects").insert({ project_name: "Uji diskon supplier", suppliers: [{ id: a, name: "A" }, { id: b, name: "B" }] }).select("id").single();
      assert.equal(rab.error, null); rabId = rab.data?.id; assert.ok(rabId);
      assert.equal((await client.from("stock_opname_items").insert({ rab_id: rabId, description: "Pekerjaan", quantity: 10, unit_price: 100000, supplier_prices: { [a]: 80000, [b]: 90000 } })).error, null);
      const save = (source: string, type: string, value: number) => client.rpc("save_rab_source_discount", { _rab_id: rabId, _source: source, _discount_type: type, _discount_value: value });
      assert.ok((await save(a, "percent", 101)).error);
      assert.ok((await save(a, "rupiah", 800001)).error);
      assert.equal((await save(a, "percent", 10)).error, null);
      assert.equal((await save(b, "rupiah", 50000)).error, null);
      const saved = await client.from("stock_opname_projects").select("source_discounts").eq("id", rabId).single();
      assert.deepEqual(saved.data?.source_discounts[a], { discount_type: "percent", discount_value: 10 });
      assert.deepEqual(saved.data?.source_discounts[b], { discount_type: "rupiah", discount_value: 50000 });
      const args = { _rab_id: rabId, _source: a, _vat_included: true, _approvers: [{ name: "A", position: "Manajer" }], _acknowledgers: [{ name: "B", position: "Manajer" }], _note: "", _work_days: 1, _work_start_date: "2026-11-13", _down_payment_percent: 0, _responsible_position: "Manajer", _discount_type: "rupiah", _discount_value: 1 };
      assert.equal((await client.rpc("finalize_rab_supplier_disposition", args)).error, null);
      const final = await client.from("stock_opname_projects").select("discount_type,discount_value,finalized_at").eq("id", rabId).single();
      assert.equal(final.data?.discount_type, "percent"); assert.equal(final.data?.discount_value, 10); assert.ok(final.data?.finalized_at);
      assert.ok((await save(a, "percent", 0)).error);
      assert.ok((await client.from("stock_opname_projects").update({ source_discounts: {} }).eq("id", rabId)).error);
      assert.equal((await client.rpc("reopen_rab_revision", { _rab_id: rabId, _reason: "Pilih supplier tanpa diskon" })).error, null);
      assert.equal((await save(b, "rupiah", 0)).error, null);
      assert.equal((await client.rpc("finalize_rab_supplier_disposition", { ...args, _source: b })).error, null);
      assert.equal((await client.from("stock_opname_projects").select("discount_value").eq("id", rabId).single()).data?.discount_value, 0);
    } finally {
      if (rabId) assert.equal((await admin.from("stock_opname_projects").delete().eq("id", rabId)).error, null);
      if (userId) assert.equal((await admin.auth.admin.deleteUser(userId)).error, null);
    }
  }
});