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
    const draft = { vatIncluded: true, note: "Draft belum lengkap", contractors: [{ name: "Kontraktor", amount: "" }], approvers: [{ name: "", position: "" }], acknowledgers: [{ name: "", position: "" }], workDays: "", workStartDate: "", downPayment: "30", responsiblePosition: "" };
    for (const client of clients) {
      assert.equal((await client.rpc("save_rab_finalization_draft", { _rab_id: rabId, _draft: draft })).error, null);
      const savedDraft = await client.from("stock_opname_projects").select("finalization_draft,finalized_at").eq("id", rabId).single();
      assert.equal(savedDraft.error, null);
      assert.deepEqual(savedDraft.data?.finalization_draft, draft);
      assert.equal(savedDraft.data?.finalized_at, null);
    }
    const args = { _rab_id: rabId, _vat_included: true, _contractor_quotes: Array.from({ length: 5 }, (_, i) => ({ name: `Kontraktor ${i + 1}`, amount: 1000000 })), _approvers: Array.from({ length: 4 }, (_, i) => ({ name: `Penyetuju ${i + 1}`, position: "Direktur" })), _acknowledgers: Array.from({ length: 4 }, (_, i) => ({ name: `Mengetahui ${i + 1}`, position: "Manager" })) };
    assert.ok((await buyer.rpc("finalize_stock_opname_rab", { ...args, _contractor_quotes: [] })).error);
    const dispositionArgs = { ...args, _note: "Material sesuai spesifikasi", _work_duration: "14 hari", _down_payment_percent: 30, _responsible_position: "Manajer" };
    assert.ok((await buyer.rpc("finalize_rab_disposition", { ...dispositionArgs, _down_payment_percent: 101 })).error);
    const { _work_duration, ...baseScheduled } = dispositionArgs;
    const scheduledArgs = { ...baseScheduled, _work_days: 14, _work_start_date: "2026-11-04" };
    assert.ok((await buyer.rpc("finalize_rab_scheduled_disposition", { ...scheduledArgs, _work_days: 0 })).error);
    assert.ok((await buyer.rpc("finalize_rab_scheduled_disposition", { ...scheduledArgs, _down_payment_percent: 101 })).error);
    const failed = await buyer.from("stock_opname_projects").select("work_start_date,finalized_at").eq("id", rabId).single();
    assert.equal(failed.data?.work_start_date, null);
    assert.equal(failed.data?.finalized_at, null);
    assert.equal((await buyer.rpc("finalize_rab_scheduled_disposition", scheduledArgs)).error, null);
    const parties = await buyer.from("stock_opname_projects").select("contractor_quotes,approvers,acknowledgers").eq("id", rabId).single();
    assert.equal(parties.error, null);
    assert.deepEqual(parties.data?.contractor_quotes, args._contractor_quotes);
    assert.deepEqual(parties.data?.approvers, args._approvers);
    assert.deepEqual(parties.data?.acknowledgers, args._acknowledgers);
    const disposition = await buyer.from("stock_opname_projects").select("disposition_note,work_duration,down_payment_percent,responsible_position,work_duration_days,work_start_date,work_end_date").eq("id", rabId).single();
    assert.equal(disposition.data?.disposition_note, "Material sesuai spesifikasi");
    assert.equal(disposition.data?.work_duration, "14 hari kalender");
    assert.equal(disposition.data?.work_duration_days, 14);
    assert.equal(disposition.data?.work_start_date, "2026-11-04");
    assert.equal(disposition.data?.work_end_date, "2026-11-17");
    assert.equal(disposition.data?.down_payment_percent, 30);
    assert.equal(disposition.data?.responsible_position, "Manajer");
    assert.ok((await buyer.from("stock_opname_projects").update({ status: "selesai", completed_at: new Date().toISOString() }).eq("id", rabId)).error);
    for (const client of clients) {
      assert.ok((await client.rpc("save_rab_finalization_draft", { _rab_id: rabId, _draft: draft })).error);
      assert.ok((await client.from("stock_opname_projects").update({ project_name: "Bypass" }).eq("id", rabId)).error);
      assert.ok((await client.from("stock_opname_projects").update({ finalized_at: null }).eq("id", rabId)).error);
      assert.ok((await client.from("stock_opname_projects").update({ work_start_date: "2026-12-01", work_duration_days: 1 }).eq("id", rabId)).error);
      assert.ok((await client.from("stock_opname_projects").update({ vat_included: false }).eq("id", rabId)).error);
      assert.ok((await client.from("stock_opname_projects").update({ disposition_note: "Bypass", down_payment_percent: 0 }).eq("id", rabId)).error);
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
    for (const [index, client] of clients.entries()) {
      assert.ok((await client.rpc("reopen_rab_revision", { _rab_id: rabId, _reason: "   " })).error);
      const reason = index === 0 ? "Revisi saat pengajuan tanda tangan" : "Revisi kedua nilai pekerjaan";
      const reopened = await client.rpc("reopen_rab_revision", { _rab_id: rabId, _reason: reason });
      assert.equal(reopened.error, null);
      assert.equal(reopened.data, index + 1);
      assert.ok((await client.rpc("reopen_rab_revision", { _rab_id: rabId, _reason: "Pembukaan ganda" })).error);
      const state = await client.from("stock_opname_projects").select("finalized_at,revision_number,finalization_draft").eq("id", rabId).single();
      assert.equal(state.data?.finalized_at, null);
      assert.equal(state.data?.revision_number, index + 1);
      assert.equal(state.data?.finalization_draft, null);
      const history = await client.from("rab_revisions").select("reason,revision_number,created_by").eq("rab_id", rabId).eq("revision_number", index + 1).single();
      assert.equal(history.error, null);
      assert.equal(history.data?.reason, reason);
      assert.equal(history.data?.created_by, users[index]);
      assert.ok((await client.from("rab_revisions").insert({ rab_id: rabId, revision_number: 99, reason: "Bypass", created_by: users[index] })).error);
      assert.ok((await client.from("stock_opname_projects").update({ revision_number: 99 }).eq("id", rabId)).error);
      const premature = { rab_id: rabId, file_name: "signed.pdf", file_path: `rab-approved/${rabId}/${crypto.randomUUID()}.pdf`, content_type: "application/pdf", file_size: 100 };
      assert.ok((await client.from("rab_approval_documents").insert(premature)).error);
      assert.equal((await client.from("stock_opname_items").update({ quantity: 10 + index }).eq("id", row.data.id)).error, null);
      assert.equal((await client.rpc("finalize_rab_scheduled_disposition", scheduledArgs)).error, null);
    }
    const signed = await buyer.from("rab_approval_documents").insert({ rab_id: rabId, file_name: "signed.pdf", file_path: `rab-approved/${rabId}/${crypto.randomUUID()}.pdf`, content_type: "application/pdf", file_size: 100 }).select().single();
    assert.equal(signed.error, null); assert.ok(signed.data);
    const signedState = await audit.from("stock_opname_projects").select("signed_locked_at,revision_number").eq("id", rabId).single();
    assert.ok(signedState.data?.signed_locked_at);
    assert.equal(signedState.data?.revision_number, 2);
    assert.equal((await buyer.from("rab_approval_documents").delete().eq("id", signed.data.id)).error, null);
    for (const client of clients) {
      assert.ok((await client.rpc("reopen_rab_revision", { _rab_id: rabId, _reason: "Setelah PDF dihapus" })).error);
      assert.ok((await client.from("stock_opname_projects").update({ signed_locked_at: null, finalized_at: null }).eq("id", rabId)).error);
      assert.ok((await client.from("stock_opname_items").update({ quantity: 99 }).eq("id", row.data.id)).error);
    }
  } finally {
    if (rabId) assert.equal((await admin.from("stock_opname_projects").delete().eq("id", rabId)).error, null);
    for (const userId of users) await admin.auth.admin.deleteUser(userId);
  }
});