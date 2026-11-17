import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";

export async function approveTestPurchase(client: SupabaseClient, rabId: string) {
  const pdf = await PDFDocument.create(); pdf.addPage(); const bytes = await pdf.save();
  assert.equal((await client.rpc("print_purchase_rab", { _rab_id: rabId })).error, null);
  const path = `rab-purchase/${rabId}/${crypto.randomUUID()}.pdf`;
  assert.equal((await client.storage.from("stock-opname-documents").upload(path, bytes, { contentType: "application/pdf" })).error, null);
  const inserted = await client.from("rab_purchase_documents").insert({ rab_id: rabId, file_name: "Test purchase approval.pdf", file_path: path, file_size: bytes.byteLength, content_type: "application/pdf" });
  if (inserted.error) { await client.storage.from("stock-opname-documents").remove([path]); }
  assert.equal(inserted.error, null);
  return path;
}