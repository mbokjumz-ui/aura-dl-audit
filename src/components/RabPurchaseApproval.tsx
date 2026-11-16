import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileDown, Upload, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { purchaseSnapshotSchema, purchaseEstimateReady, type PurchaseApproval } from "@/lib/rab-purchase";
import { validateRabApprovalPdf } from "@/lib/rab-approval";
import { privateDocumentUrl } from "@/lib/document-preview";
import type { OpnameItem } from "@/lib/stock-opname";
import { Button } from "@/components/ui/button";
import { AttachmentActions } from "@/components/AttachmentActions";

export function RabPurchaseApproval({ rab, items }: { rab: PurchaseApproval & { id: string }; items: OpnameItem[] }) {
  const client = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [printing, setPrinting] = useState(false);
  const key = ["rab-purchase-documents", rab.id];
  const documents = useQuery({ queryKey: key, queryFn: async () => {
    const result = await supabase.from("rab_purchase_documents").select("*").eq("rab_id", rab.id).order("created_at");
    if (result.error) throw result.error; return result.data;
  } });
  async function print() {
    setPrinting(true);
    try {
      const { createPurchaseRabPdf } = await import("@/lib/rab-purchase-pdf");
      const result = await supabase.rpc("print_purchase_rab", { _rab_id: rab.id });
      if (result.error) throw result.error;
      const snapshot = purchaseSnapshotSchema.parse(result.data);
      createPurchaseRabPdf(snapshot).save(`RAB Pembelian - ${snapshot.project_name.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 80)}.pdf`);
      await client.invalidateQueries({ queryKey: ["stock-opname-projects"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "RAB Pembelian gagal dicetak."); }
    finally { setPrinting(false); }
  }
  const upload = useMutation({ mutationFn: async (file: File) => {
    validateRabApprovalPdf(file);
    const path = `rab-purchase/${rab.id}/${crypto.randomUUID()}.pdf`;
    const stored = await supabase.storage.from("stock-opname-documents").upload(path, file, { contentType: "application/pdf" });
    if (stored.error) throw stored.error;
    const result = await supabase.from("rab_purchase_documents").insert({ rab_id: rab.id, file_name: file.name, file_path: path, file_size: file.size, content_type: "application/pdf" });
    if (result.error) { await supabase.storage.from("stock-opname-documents").remove([path]); throw result.error; }
  }, onSuccess: () => { toast.success("Perkiraan Pembelian dikunci. Harga supplier pembanding sudah dibuka."); client.invalidateQueries({ queryKey: key }); client.invalidateQueries({ queryKey: ["stock-opname-projects"] }); }, onError: e => toast.error(e.message) });
  return <section className="mb-5 border-y border-border py-4" aria-label="Persetujuan RAB Pembelian">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Persetujuan RAB Pembelian</h2><div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={printing || upload.isPending || (!rab.purchase_approved_at && !purchaseEstimateReady(items))} onClick={print}><FileDown />{printing ? "Membuat PDF…" : "Cetak RAB Pembelian"}</Button>
      {!rab.purchase_approved_at && <Button variant="outline" disabled={!rab.purchase_printed_at || printing || upload.isPending} onClick={() => { if (confirm("Unggah PDF RAB Pembelian yang disetujui? Rincian dan harga perkiraan akan dikunci, lalu harga supplier pembanding dibuka.")) input.current?.click(); }}><Upload />{upload.isPending ? "Mengunggah…" : "Unggah Persetujuan Pembelian"}</Button>}
    </div></div>
    <p className="mt-3 flex items-center gap-2 text-sm text-primary">{rab.purchase_approved_at && <LockKeyhole className="h-4 w-4 shrink-0" />}{rab.purchase_approved_at ? "Pembelian disetujui · Perkiraan terkunci · Harga supplier dibuka" : rab.purchase_printed_at ? "Menunggu PDF persetujuan Pembelian · Harga supplier terkunci" : "Penyusunan perkiraan Pembelian · Harga supplier terkunci"}</p>
    <input ref={input} className="hidden" type="file" accept=".pdf,application/pdf" aria-label="PDF persetujuan RAB Pembelian" onChange={e => { const file = e.target.files?.[0]; if (file) upload.mutate(file); e.target.value = ""; }} />
    {documents.error && <p role="alert" className="mt-2 text-sm text-destructive">{documents.error.message}</p>}
    <ul>{documents.data?.map(doc => <li key={doc.id} className="mt-3 flex items-center gap-2 border-t border-border pt-3"><span className="min-w-0 flex-1 break-all text-sm">{doc.file_name}</span><AttachmentActions name={doc.file_name} getUrl={download => privateDocumentUrl("stock-opname-documents", doc.file_path, doc.file_name, download)} /></li>)}</ul>
  </section>;
}