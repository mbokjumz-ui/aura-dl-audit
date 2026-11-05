import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AttachmentActions } from "@/components/AttachmentActions";
import { privateDocumentUrl } from "@/lib/document-preview";
import { RAB_ATTACHMENT_ACCEPT, validateRabAttachment, mergeRabAttachments } from "@/lib/rab-attachments";
import { PDFDocument } from "pdf-lib";

export function RabPrintAttachments({ rabId, editable, disabled = false, onBusy }: { rabId: string; editable: boolean; disabled?: boolean; onBusy?: (busy: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const client = useQueryClient();
  const key = ["rab-print-documents", rabId];
  const query = useQuery({ queryKey: key, queryFn: async () => {
    const { data, error } = await supabase.from("rab_print_documents").select("*").eq("rab_id", rabId).order("created_at").order("id");
    if (error) throw error; return data;
  }});
  const upload = useMutation({ mutationFn: async (files: File[]) => {
    if (!editable) throw new Error("Lampiran RAB final terkunci.");
    for (const file of files) validateRabAttachment(file);
    for (const file of files) {
      const { ext, type } = validateRabAttachment(file);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const empty = await PDFDocument.create(); empty.addPage();
      await mergeRabAttachments(await empty.save(), [{ name: file.name, type, bytes }]);
      const path = `rab-print/${rabId}/${crypto.randomUUID()}.${ext}`;
      const stored = await supabase.storage.from("stock-opname-documents").upload(path, file, { contentType: type });
      if (stored.error) throw stored.error;
      const result = await supabase.from("rab_print_documents").insert({ rab_id: rabId, file_name: file.name, file_path: path, file_size: file.size, content_type: type });
      if (result.error) { await supabase.storage.from("stock-opname-documents").remove([path]); throw result.error; }
    }
  }, onSuccess: () => toast.success("Lampiran cetak RAB diunggah"), onError: e => toast.error(e.message), onSettled: () => { onBusy?.(false); client.invalidateQueries({ queryKey: key }); } });
  const remove = useMutation({ mutationFn: async (doc: { id: string; file_path: string }) => {
    const stored = await supabase.storage.from("stock-opname-documents").remove([doc.file_path]);
    if (stored.error) throw stored.error;
    const result = await supabase.from("rab_print_documents").delete().eq("id", doc.id);
    if (result.error) throw result.error;
  }, onError: e => toast.error(e.message), onSettled: () => { onBusy?.(false); client.invalidateQueries({ queryKey: key }); } });
  return <section className="space-y-3 border-t border-border pt-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Lampiran Cetak RAB</h3>{editable && <Button type="button" size="sm" variant="outline" disabled={disabled || upload.isPending || remove.isPending} onClick={() => input.current?.click()}><Upload />{upload.isPending ? "Mengunggah…" : "Unggah PDF / Gambar"}</Button>}</div>
    <input ref={input} type="file" multiple accept={RAB_ATTACHMENT_ACCEPT} aria-label="Lampiran cetak RAB" className="hidden" onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ""; if (files.length) { onBusy?.(true); upload.mutate(files); } }} />
    {query.isPending && <p className="text-sm text-muted-foreground">Memuat…</p>}{query.error && <p role="alert" className="text-sm text-destructive">{query.error.message}</p>}
    {query.data?.length === 0 && <p className="text-sm text-muted-foreground">Belum ada lampiran cetak.</p>}
    <ol className="divide-y divide-border">{query.data?.map((doc, i) => <li key={doc.id} className="flex items-center gap-2 py-2"><span className="min-w-0 flex-1 break-all text-sm">{i + 1}. {doc.file_name}</span><AttachmentActions name={doc.file_name} getUrl={download => privateDocumentUrl("stock-opname-documents", doc.file_path, doc.file_name, download)} />{editable && <Button type="button" size="icon" variant="ghost" aria-label={`Hapus lampiran ${doc.file_name}`} disabled={disabled || upload.isPending || remove.isPending} onClick={() => { if (confirm(`Hapus lampiran ${doc.file_name}?`)) { onBusy?.(true); remove.mutate(doc); } }}><Trash2 /></Button>}</li>)}</ol>
  </section>;
}