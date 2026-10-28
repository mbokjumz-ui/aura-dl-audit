import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

test("Pembelian cannot write actual quantities, remove counted rows, finish opname, or access audit records", async () => {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  const publishable = process.env['SUPABASE_PUBLISHABLE_KEY'];
  assert.ok(url && key && publishable, "Integration test requires backend test credentials");
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const password = crypto.randomUUID() + "aA1";
  const email = `aura-access-${crypto.randomUUID()}@example.com`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.equal(created.error, null); assert.ok(created.data.user);
  const userId = created.data.user.id;
  let projectId: string | undefined;
  let auditId: string | undefined;
  try {
    assert.equal((await admin.from("user_roles").insert({ user_id: userId, role: "purchasing" })).error, null);
    const buyer = createClient(url, publishable, { auth: { persistSession: false } });
    assert.equal((await buyer.auth.signInWithPassword({ email, password })).error, null);
    const rab = await buyer.from("stock_opname_projects").insert({ project_name: "Uji akses Pembelian" }).select().single();
    assert.equal(rab.error, null); assert.ok(rab.data); projectId = rab.data.id;
    const item = await buyer.from("stock_opname_items").insert({ rab_id: projectId, description: "Poin uji", quantity: 10, unit_price: 100 }).select().single();
    assert.equal(item.error, null); assert.ok(item.data);
    assert.ok((await buyer.from("stock_opname_items").insert({ rab_id: projectId, description: "Bypass", actual_quantity: 7 })).error);
    assert.ok((await buyer.from("stock_opname_items").update({ actual_quantity: 7 }).eq("id", item.data.id)).error);
    assert.equal((await admin.from("stock_opname_items").update({ actual_quantity: 4 }).eq("id", item.data.id)).error, null);
    assert.ok((await buyer.from("stock_opname_items").delete().eq("id", item.data.id)).error);
    assert.ok((await buyer.from("stock_opname_projects").delete().eq("id", projectId)).error);
    assert.ok((await buyer.from("stock_opname_projects").update({ status: "selesai" }).eq("id", projectId)).error);
    const unchanged = await buyer.from("stock_opname_items").select("actual_quantity").eq("id", item.data.id).single();
    assert.equal(unchanged.data?.actual_quantity, 4);
    const audit = await admin.from("projects").insert({ name: "Uji audit tersembunyi" }).select().single();
    assert.equal(audit.error, null); assert.ok(audit.data); auditId = audit.data.id;
    assert.deepEqual((await buyer.from("projects").select("id").eq("id", auditId)).data, []);
    assert.ok((await buyer.from("projects").insert({ name: "Akses dilarang" })).error);
    assert.ok((await buyer.from("user_roles").insert({ user_id: userId, role: "internal_audit" })).error);
  } finally {
    if (projectId) await admin.from("stock_opname_projects").delete().eq("id", projectId);
    if (auditId) await admin.from("projects").delete().eq("id", auditId);
    await admin.auth.admin.deleteUser(userId);
  }
});