import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

test("RAB final terkunci untuk kedua peran, tetapi opname tetap dapat diisi Internal Audit", async () => {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  const pub = process.env['SUPABASE_PUBLISHABLE_KEY'];
  assert.ok(url && key && pub, "Backend test credentials required");
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const users: string[] = [];
  let rabId: string | undefined;
  try {
    const clients: SupabaseClient[] = [];
    for (const role of ["internal_audit", "purchasing"]) {
      const email = `rab-final-${crypto.randomUUID()}@example.com`, password = crypto.randomUUID() + "aA1";
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      assert.equal(created.error, null); assert.ok(created.data.user);
      users.push(created.data.user.id);
      assert.equal((await admin.from("user_roles").insert({ user_id: created.data.user.id, role })).error, null);
      const client: SupabaseClient = createClient(url, pub, { auth: { persistSession: false } });
      assert.equal((await client.auth.signInWithPassword({ email, password })).error, null);
      clients.push(client);
    }
    const [audit, buyer] = clients;
    assert.ok(audit && buyer);
    const rab = await buyer.from("stock_opname_projects").insert({ project_name: "Uji finalisasi RAB" }).select().single();
    assert.equal(rab.error, null); assert.ok(rab.data); rabId = rab.data.id;
    const row = await buyer.from("stock_opname_items").insert({ rab_id: rabId, description: "Poin final", quantity: 10, unit_price: 100000 }).select().single();
    assert.equal(row.error, null); assert.ok(row.data);
    const args = { _rab_id: rabId, _vat_included: true, _contractor_quotes: [{ name: "A", amount: 1000000 }], _approvers: [{ name: "B", position: "Direktur" }], _acknowledgers: [{ name: "C", position: "Manager" }] };
    assert.ok((await buyer.rpc("finalize_stock_opname_rab", { ...args, _contractor_quotes: [] })).error);
    assert.equal((await buyer.rpc("finalize_stock_opname_rab", args)).error, null);
    assert.ok((await buyer.from("stock_opname_projects").update({ status: "selesai", completed_at: new Date().toISOString() }).eq("id", rabId)).error);
    for (const client of clients) {
      assert.ok((await client.from("stock_opname_projects").update({ project_name: "Bypass" }).eq("id", rabId)).error);
      assert.ok((await client.from("stock_opname_projects").update({ finalized_at: null }).eq("id", rabId)).error);
      assert.ok((await client.from("stock_opname_projects").update({ vat_included: false }).eq("id", rabId)).error);
      assert.ok((await client.from("stock_opname_items").update({ quantity: 99, actual_quantity: 9 }).eq("id", row.data.id)).error);
      assert.ok((await client.from("stock_opname_items").insert({ rab_id: rabId, description: "Bypass" })).error);
      assert.ok((await client.from("stock_opname_items").delete().eq("id", row.data.id)).error);
      assert.ok((await client.from("stock_opname_projects").delete().eq("id", rabId)).error);
    }
    assert.ok((await buyer.from("stock_opname_items").update({ actual_quantity: 9 }).eq("id", row.data.id)).error);
    assert.equal((await audit.from("stock_opname_items").update({ actual_quantity: 9 }).eq("id", row.data.id)).error, null);
    assert.equal((await audit.from("stock_opname_projects").update({ status: "selesai", completed_at: new Date().toISOString() }).eq("id", rabId)).error, null);
    assert.equal((await audit.from("stock_opname_projects").update({ status: "berjalan", completed_at: null }).eq("id", rabId)).error, null);
    const read = await buyer.from("stock_opname_projects").select("finalized_at,vat_included,stock_opname_items(quantity,actual_quantity)").eq("id", rabId).single();
    assert.ok(read.data?.finalized_at); assert.equal(read.data?.vat_included, true);
    assert.equal(read.data?.stock_opname_items[0]?.quantity, 10); assert.equal(read.data?.stock_opname_items[0]?.actual_quantity, 9);
  } finally {
    if (rabId) assert.equal((await admin.from("stock_opname_projects").delete().eq("id", rabId)).error, null);
    for (const userId of users) await admin.auth.admin.deleteUser(userId);
  }
});