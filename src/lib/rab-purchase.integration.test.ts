import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";

test("purchase approval is separate, atomic and protected for both RAB roles", async () => {
  const url = process.env["SUPABASE_URL"], key = process.env["SUPABASE_SERVICE_ROLE_KEY"], pub = process.env["SUPABASE_PUBLISHABLE_KEY"];
  assert.ok(url && key && pub);
  const admin = createClient(url, key, { auth: { persistSession: false } });
  for (const role of ["internal_audit", "purchasing"]) {
    let userId: string | undefined, rabId: string | undefined;
    const paths: string[] = [];
    try {
      const email = `purchase-test-${crypto.randomUUID()}@example.com`, password = crypto.randomUUID() + "aA1";
      const user = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      assert.equal(user.error, null); assert.ok(user.data.user); userId = user.data.user.id;
      assert.equal((await admin.from("user_roles").insert({ user_id: userId, role })).error, null);
      const client: SupabaseClient = createClient(url, pub, { auth: { persistSession: false } });
      assert.equal((await client.auth.signInWithPassword({ email, password })).error, null);
      const supplier = crypto.randomUUID();
      const project = await client.from("stock_opname_projects").insert({ project_name: "Uji persetujuan Pembelian", suppliers: [{ id: supplier, name: "Supplier A" }] }).select().single();
      assert.equal(project.error, null); rabId = project.data?.id; assert.ok(rabId);
      assert.equal(project.data.purchase_approval_required, true);
      assert.ok((await client.from("stock_opname_projects").update({ purchase_approval_required: false }).eq("id", rabId)).error);
      assert.ok((await client.from("stock_opname_projects").update({ purchase_approved_at: new Date().toISOString() }).eq("id", rabId)).error);
      assert.ok((await client.rpc("print_purchase_rab", { _rab_id: rabId })).error);
      const inserted = await client.from("stock_opname_items").insert({ rab_id: rabId, description: "Pekerjaan", quantity: 2, unit: "unit", unit_price: 100 }).select().single();
      assert.equal(inserted.error, null); const id = inserted.data?.id; assert.ok(id);
      assert.ok((await client.from("stock_opname_items").update({ supplier_prices: { [supplier]: 80 } }).eq("id", id)).error);
      assert.ok((await client.rpc("save_rab_source_discount", { _rab_id: rabId, _source: supplier, _discount_type: "percent", _discount_value: 10 })).error);
      const args = { _rab_id: rabId, _source: "estimate", _vat_included: false, _approvers: [{ name: "A", position: "Manajer" }], _acknowledgers: [{ name: "B", position: "Manajer" }], _note: "", _work_days: 2, _work_start_date: "2026-11-16", _down_payment_percent: 0, _responsible_position: "Manajer", _discount_type: "rupiah", _discount_value: 0 };
      assert.ok((await client.rpc("finalize_rab_supplier_disposition", args)).error);
      assert.equal((await client.rpc("print_purchase_rab", { _rab_id: rabId })).error, null);
      assert.equal((await client.from("stock_opname_items").update({ unit_price: 110 }).eq("id", id)).error, null);
      const pdf = await PDFDocument.create(); pdf.addPage(); const bytes = await pdf.save();
      const path = `rab-purchase/${rabId}/${crypto.randomUUID()}.pdf`; paths.push(path);
      assert.equal((await client.storage.from("stock-opname-documents").upload(path, bytes, { contentType: "application/pdf" })).error, null);
      const document = { rab_id: rabId, file_name: "Persetujuan.pdf", file_path: path, file_size: bytes.byteLength, content_type: "application/pdf" };
      assert.ok((await client.from("rab_purchase_documents").insert(document)).error, "stale print cannot be approved");
      assert.equal((await client.rpc("print_purchase_rab", { _rab_id: rabId })).error, null);
      assert.equal((await client.from("rab_purchase_documents").insert(document)).error, null);
      const approved = await client.from("stock_opname_projects").select().eq("id", rabId).single();
      assert.ok(approved.data.purchase_approved_at); assert.equal(approved.data.finalized_at, null);
      assert.ok((await client.from("stock_opname_items").update({ unit_price: 120 }).eq("id", id)).error);
      assert.ok((await client.from("stock_opname_items").update({ estimated_unit_price: 120 }).eq("id", id)).error);
      assert.ok((await client.from("stock_opname_items").update({ quantity: 3 }).eq("id", id)).error);
      assert.ok((await client.from("stock_opname_items").delete().eq("id", id)).error);
      assert.ok((await client.from("stock_opname_items").insert({ rab_id: rabId, description: "Tambahan" })).error);
      assert.ok((await client.rpc("save_rab_source_discount", { _rab_id: rabId, _source: "estimate", _discount_type: "percent", _discount_value: 10 })).error);
      assert.equal((await client.from("stock_opname_items").update({ supplier_prices: { [supplier]: 80 } }).eq("id", id)).error, null);
      assert.equal((await client.rpc("save_rab_source_discount", { _rab_id: rabId, _source: supplier, _discount_type: "percent", _discount_value: 10 })).error, null);
      const removed = await client.storage.from("stock-opname-documents").remove([path]);
      assert.ok(removed.error || removed.data.length === 0);
      assert.equal((await client.rpc("finalize_rab_supplier_disposition", { ...args, _source: supplier })).error, null);
      const row = await client.from("stock_opname_items").select().eq("id", id).single();
      assert.equal(row.data.unit_price, 80); assert.equal(row.data.estimated_unit_price, 110);
      assert.equal((await client.rpc("reopen_rab_revision", { _rab_id: rabId, _reason: "Revisi supplier" })).error, null);
      assert.ok((await client.from("stock_opname_items").update({ estimated_unit_price: 120 }).eq("id", id)).error);
      assert.equal((await client.rpc("finalize_rab_supplier_disposition", args)).error, null);
    } finally {
      if (rabId) assert.equal((await admin.from("stock_opname_projects").delete().eq("id", rabId)).error, null);
      if (paths.length) await admin.storage.from("stock-opname-documents").remove(paths);
      if (userId) assert.equal((await admin.auth.admin.deleteUser(userId)).error, null);
    }
  }
});