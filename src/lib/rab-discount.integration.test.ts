import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

test("Diskon finalisasi tersimpan atomik dan terkunci untuk Internal Audit maupun Pembelian", async () => {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  const pub = process.env["SUPABASE_PUBLISHABLE_KEY"];
  assert.ok(url && key && pub, "Backend test credentials required");
  const admin = createClient(url, key, { auth: { persistSession: false } });
  for (const role of ["internal_audit", "purchasing"]) {
    let userId: string | undefined;
    let rabId: string | undefined;
    try {
      const email = `discount-${crypto.randomUUID()}@example.com`;
      const password = crypto.randomUUID() + "aA1";
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      assert.equal(created.error, null); assert.ok(created.data.user);
      userId = created.data.user.id;
      assert.equal((await admin.from("user_roles").insert({ user_id: userId, role })).error, null);
      const client: SupabaseClient = createClient(url, pub, { auth: { persistSession: false } });
      assert.equal((await client.auth.signInWithPassword({ email, password })).error, null);
      const rab = await client.from("stock_opname_projects").insert({ project_name: "Uji diskon otomatis" }).select("id").single();
      assert.equal(rab.error, null); assert.ok(rab.data); rabId = rab.data.id;
      assert.equal((await client.from("stock_opname_items").insert({ rab_id: rabId, description: "Pekerjaan", quantity: 10, unit_price: 100000 })).error, null);
      const args = { _rab_id: rabId, _vat_included: true, _contractor_quotes: [{ name: "Kontraktor", amount: 1000000 }], _approvers: [{ name: "A", position: "Manajer" }], _acknowledgers: [{ name: "B", position: "Manajer" }], _note: "", _work_days: 10, _work_start_date: "2026-11-09", _down_payment_percent: 0, _responsible_position: "Manajer", _discount_type: "percent", _discount_value: 10 };
      assert.ok((await client.rpc("finalize_rab_discounted_disposition", { ...args, _discount_value: 101 })).error);
      assert.ok((await client.rpc("finalize_rab_discounted_disposition", { ...args, _discount_type: "rupiah", _discount_value: 1000001 })).error);
      const before = await client.from("stock_opname_projects").select("discount_value,finalized_at").eq("id", rabId).single();
      assert.equal(before.data?.discount_value, 0); assert.equal(before.data?.finalized_at, null);
      assert.equal((await client.rpc("finalize_rab_discounted_disposition", args)).error, null);
      const saved = await client.from("stock_opname_projects").select("discount_type,discount_value,finalized_at").eq("id", rabId).single();
      assert.equal(saved.data?.discount_type, "percent"); assert.equal(saved.data?.discount_value, 10); assert.ok(saved.data?.finalized_at);
      assert.ok((await client.from("stock_opname_projects").update({ discount_value: 20 }).eq("id", rabId)).error);
    } finally {
      if (rabId) assert.equal((await admin.from("stock_opname_projects").delete().eq("id", rabId)).error, null);
      if (userId) assert.equal((await admin.auth.admin.deleteUser(userId)).error, null);
    }
  }
});