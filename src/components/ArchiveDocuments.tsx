import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ARCHIVE_BUCKET, FILE_ACCEPT, validateArchiveFile } from "@/lib/archive";
import { Button } from "@/components/ui/button";

export function ArchiveDocuments(props: { findingId: string } | { isoObjectId: string } | { stockItemId: string }) {
  const stock = "stockItemId" in props;
  const iso = "isoObjectId" in props;
  const ownerId = "stockItemId" in props ? props.stockItemId : "isoObjectId" in props ? props.isoObjectId : props.findingId;
  const bucket = stock ? "stock-opname-documents" : iso ? "iso-documents" : ARCHIVE_BUCKET;
  const input = useRef<HTMLInputElement>(null);
  const client = useQueryClient();
  const key = [stock ? "stock-opname-documents" : iso ? "iso-documents" : "archive-documents", ownerId];
  const query = useQuery({ queryKey: key, queryFn: async () => {
    const { data, error } = stock
      ? await supabase.from("stock_opname_documents").select("*").eq("item_id", ownerId).order("created_at")
      : iso
      ? await supabase.from("iso_documents").select("*").eq("object_id", ownerId).order("created_at")
      : await supabase.from("archive_documents").select("*").eq("finding_id", ownerId).order("created_at");
    if (error) throw error;
    return data;
  }});
  const upload = useMutation({ mutationFn: async (files: File[]) => {
    for (const file of files) validateArchiveFile(file);
    for (const file of files) {
      const path = `${ownerId}/${crypto.randomUUID()}.${validateArchiveFile(file)}`;
      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file);
      if (uploadError) throw uploadError;
      const values = { file_name: file.name, file_path: path, file_size: file.size, content_type: file.type || "application/octet-stream" };
      const { error } = stock
        ? await supabase.from("stock_opname_documents").insert({ ...values, item_id: ownerId })
        : iso
        ? await supabase.from("iso_documents").insert({ ...values, object_id: ownerId })
        : await supabase.from("archive_documents").insert({ ...values, finding_id: ownerId });
      if (error) { await supabase.storage.from(bucket).remove([path]); throw error; }
    }
  }, onSuccess: () => toast.success("Dokumen diunggah"), onError: (e) => toast.error(e.message), onSettled: () => client.invalidateQueries({ queryKey: key }) });
  const remove = useMutation({ mutationFn: async (doc: { id: string; file_path: string }) => {
    const { error: storageError } = await supabase.storage.from(bucket).remove([doc.file_path]);
    if (storageError) throw storageError;
    const { error } = await supabase.from(stock ? "stock_opname_documents" : iso ? "iso_documents" : "archive_documents").delete().eq("id", doc.id);
    if (error) throw error;
  }, onSuccess: () => { toast.success("Dokumen dihapus"); client.invalidateQueries({ queryKey: key }); }, onError: (e) => toast.error(e.message) });
  async function download(path: string, name: string) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60, { download: name });
    if (error) { toast.error(error.message); return; }
    const link = document.createElement("a"); link.href = data.signedUrl; link.rel = "noopener"; link.target = "_blank"; link.click();
  }
  return <section className="mt-6 border-t border-border pt-5">
    <div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-semibold">Dokumen</h3><Button variant="outline" size="sm" disabled={upload.isPending} onClick={() => input.current?.click()}><Upload />{upload.isPending ? "Mengunggah…" : "Unggah Dokumen"}</Button></div>
    <input ref={input} type="file" multiple accept={FILE_ACCEPT} className="hidden" aria-label={stock ? "Lampiran stock opname" : iso ? "Lampiran ISO" : "Lampiran arsip"} onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length) upload.mutate(files); e.target.value = ""; }} />
    {query.isPending && <p className="text-sm text-muted-foreground">Memuat dokumen…</p>}
    {query.error && <p role="alert" className="text-sm text-destructive">{query.error.message}</p>}
    {!query.isPending && !query.error && query.data?.length === 0 && <p className="text-sm text-muted-foreground">Belum ada dokumen.</p>}
    <ul className="divide-y divide-border">{query.data?.map(doc => <li key={doc.id} className="flex items-center gap-3 py-3"><FileText className="h-5 w-5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="break-all text-sm font-medium">{doc.file_name}</p><p className="text-xs text-muted-foreground">{(doc.file_size / 1024).toFixed(1)} KB</p></div><Button variant="ghost" size="icon" title="Unduh dokumen" aria-label={`Unduh ${doc.file_name}`} onClick={() => download(doc.file_path, doc.file_name)}><Download /></Button><Button variant="ghost" size="icon" title="Hapus dokumen" aria-label={`Hapus ${doc.file_name}`} disabled={remove.isPending} onClick={() => { if (window.confirm(`Hapus dokumen ${doc.file_name}?`)) remove.mutate(doc); }}><Trash2 /></Button></li>)}</ul>
  </section>;
}