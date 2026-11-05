import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function RabRevisionControls({ rabId, finalized, signedLocked, canRevise }: { rabId: string; finalized: boolean; signedLocked: boolean; canRevise: boolean }) {
  const client = useQueryClient();
  const [opening, setOpening] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [reason, setReason] = useState("");
  const history = useQuery({ queryKey: ["rab-revisions", rabId], enabled: historyOpen, queryFn: async () => {
    const { data, error } = await supabase.from("rab_revisions").select("*").eq("rab_id", rabId).order("revision_number", { ascending: false });
    if (error) throw error;
    return data;
  }});
  const reopen = useMutation({ mutationFn: async () => {
    const { data, error } = await supabase.rpc("reopen_rab_revision", { _rab_id: rabId, _reason: reason.trim() });
    if (error) throw error;
    return data;
  }, onSuccess: revision => {
    setOpening(false); setReason("");
    client.invalidateQueries({ queryKey: ["stock-opname-projects"] });
    client.invalidateQueries({ queryKey: ["rab-revisions", rabId] });
    toast.success(`RAB dibuka untuk rev${revision}.`);
  }, onError: e => toast.error(e.message) });
  return <>
    {finalized && !signedLocked && canRevise && <Button variant="outline" onClick={() => setOpening(true)}><RotateCcw />Buka Revisi RAB</Button>}
    <Button variant="outline" onClick={() => setHistoryOpen(true)}><History />Histori Revisi</Button>
    <Dialog open={opening} onOpenChange={open => { if (!reopen.isPending) setOpening(open); }}><DialogContent><DialogHeader><DialogTitle>Buka Revisi RAB</DialogTitle><DialogDescription>Anggaran dapat diubah kembali. Alasan revisi akan tersimpan dalam histori.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); reopen.mutate(); }}>
        <label className="block space-y-2 text-sm font-medium">Keterangan alasan revisi<Textarea required maxLength={5000} value={reason} onChange={e => setReason(e.target.value)} disabled={reopen.isPending} /></label>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={reopen.isPending} onClick={() => setOpening(false)}>Batal</Button><Button disabled={!reason.trim() || reopen.isPending}><RotateCcw />{reopen.isPending ? "Membuka…" : "Simpan & Buka Revisi"}</Button></div>
      </form>
    </DialogContent></Dialog>
    <Dialog open={historyOpen} onOpenChange={setHistoryOpen}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Histori Revisi RAB</DialogTitle></DialogHeader>
      {history.isPending ? <p className="text-sm text-muted-foreground">Memuat…</p> : history.error ? <p role="alert" className="text-sm text-destructive">{history.error.message}</p> : !history.data?.length ? <p className="text-sm text-muted-foreground">Belum ada revisi.</p> : <ol className="divide-y divide-border">{history.data.map(revision => <li key={revision.id} className="space-y-2 py-4"><div className="flex flex-wrap justify-between gap-2 text-sm"><strong>rev{revision.revision_number}</strong><time className="text-muted-foreground">{new Date(revision.created_at).toLocaleString("id-ID")}</time></div><p className="whitespace-pre-wrap break-words text-sm">{revision.reason}</p></li>)}</ol>}
    </DialogContent></Dialog>
  </>;
}