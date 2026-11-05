import { supabase } from "@/integrations/supabase/client";
import { mergeRabAttachments, type PdfAttachment } from "./rab-attachments";

export async function mergedRabBlob(rabId: string, form: ArrayBuffer) {
  const result = await supabase.from("rab_print_documents").select("*").eq("rab_id", rabId).order("created_at").order("id");
  if (result.error) throw result.error;
  const attachments: PdfAttachment[] = [];
  for (const doc of result.data) {
    const file = await supabase.storage.from("stock-opname-documents").download(doc.file_path);
    if (file.error || !file.data) throw new Error(`Lampiran ${doc.file_name} gagal dibaca. Cetakan dibatalkan.`);
    attachments.push({ name: doc.file_name, type: doc.content_type, bytes: new Uint8Array(await file.data.arrayBuffer()) });
  }
  return mergeRabAttachments(new Uint8Array(form), attachments);
}