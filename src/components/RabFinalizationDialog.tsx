import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { LockKeyhole, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { rabFinalizationSchema, rabTaxTotals } from "@/lib/rab-finalization";
import { rupiah } from "@/lib/stock-opname";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function RabFinalizationDialog({ rabId, subtotal, onClose, onFinalized }: { rabId: string; subtotal: number; onClose: () => void; onFinalized: () => void }) {
  const [vatIncluded, setVatIncluded] = useState(false);
  const [contractors, setContractors] = useState([{ name: "", amount: "" }]);
  const [approvers, setApprovers] = useState([{ name: "", position: "" }]);
  const [acknowledgers, setAcknowledgers] = useState([{ name: "", position: "" }]);
  const [confirmed, setConfirmed] = useState(false);
  const totals = rabTaxTotals(subtotal, vatIncluded);
  const save = useMutation({ mutationFn: async () => {
    const parsed = rabFinalizationSchema.safeParse({ vatIncluded, contractors: contractors.map(c => ({ name: c.name, amount: c.amount.trim() ? Number(c.amount) : NaN })), approvers, acknowledgers });
    if (!parsed.success) throw new Error("Lengkapi nama, nilai penawaran, dan jabatan yang wajib diisi.");
    if (!confirmed) throw new Error("Konfirmasi penguncian RAB terlebih dahulu.");
    const { error } = await supabase.rpc("finalize_stock_opname_rab", { _rab_id: rabId, _vat_included: parsed.data.vatIncluded, _contractor_quotes: parsed.data.contractors, _approvers: parsed.data.approvers, _acknowledgers: parsed.data.acknowledgers });
    if (error) throw error;
  }, onSuccess: () => { toast.success("RAB difinalisasi dan dikunci permanen."); onFinalized(); onClose(); }, onError: e => toast.error(e.message) });
  const signatories = (title: string, rows: typeof approvers, setRows: typeof setApprovers) => <fieldset className="space-y-3 border-t border-border pt-4"><legend className="font-semibold">{title}</legend>{rows.map((row, i) => <div key={i} className="flex items-end gap-2"><div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2"><label className="space-y-1 text-sm">Nama {i + 1}<Input required maxLength={150} value={row.name} onChange={e => setRows(rows.map((r, n) => n === i ? { ...r, name: e.target.value } : r))} /></label><label className="space-y-1 text-sm">Jabatan {i + 1}<Input required maxLength={150} value={row.position} onChange={e => setRows(rows.map((r, n) => n === i ? { ...r, position: e.target.value } : r))} /></label></div>{rows.length > 1 && <Button type="button" size="icon" variant="ghost" title={`Hapus ${title} ${i + 1}`} aria-label={`Hapus ${title} ${i + 1}`} onClick={() => setRows(rows.filter((_, n) => n !== i))}><Trash2 /></Button>}</div>)}{rows.length < 2 && <Button type="button" variant="outline" size="sm" onClick={() => setRows([...rows, { name: "", position: "" }])}><Plus />Tambah {title}</Button>}</fieldset>;
  return <Dialog open onOpenChange={open => { if (!open && !save.isPending) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Finalisasi RAB</DialogTitle><DialogDescription>Header, rincian anggaran, dan informasi persetujuan dikunci permanen. Hasil Stock Opname tetap dapat diisi oleh Internal Audit.</DialogDescription></DialogHeader><form className="space-y-5" onSubmit={e => { e.preventDefault(); save.mutate(); }}><fieldset disabled={save.isPending} className="space-y-5">
    <fieldset className="flex flex-wrap gap-4"><legend className="mb-2 text-sm font-semibold">PPN</legend>{[{ value: false, label: "Exclude PPN" }, { value: true, label: "Include PPN 11%" }].map(option => <label key={option.label} className="flex items-center gap-2 text-sm"><input type="radio" name="ppn" checked={vatIncluded === option.value} onChange={() => setVatIncluded(option.value)} />{option.label}</label>)}</fieldset>
    <dl className="space-y-2 border-y border-border py-3 text-sm"><div className="flex justify-between gap-3"><dt>Total RAB sebelum PPN</dt><dd>{rupiah(subtotal)}</dd></div><div className="flex justify-between gap-3"><dt>PPN {vatIncluded ? "11%" : "(Exclude)"}</dt><dd>{rupiah(totals.ppn)}</dd></div><div className="flex justify-between gap-3 font-semibold"><dt>Total akhir RAB</dt><dd>{rupiah(totals.total)}</dd></div></dl>
    <fieldset className="space-y-3"><legend className="mb-2 font-semibold">Perbandingan penawaran sebelum PPN</legend>{contractors.map((row, i) => <div key={i} className="flex items-end gap-2"><div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2"><label className="space-y-1 text-sm">Nama kontraktor {i + 1}<Input required maxLength={150} value={row.name} onChange={e => setContractors(contractors.map((r, n) => n === i ? { ...r, name: e.target.value } : r))} /></label><label className="space-y-1 text-sm">Penawaran {i + 1} sebelum PPN (Rp)<Input required type="number" min="0" max="100000000000000" step="0.01" value={row.amount} onChange={e => setContractors(contractors.map((r, n) => n === i ? { ...r, amount: e.target.value } : r))} /></label></div>{contractors.length > 1 && <Button type="button" size="icon" variant="ghost" title={`Hapus kontraktor ${i + 1}`} aria-label={`Hapus kontraktor ${i + 1}`} onClick={() => setContractors(contractors.filter((_, n) => n !== i))}><Trash2 /></Button>}</div>)}{contractors.length < 3 && <Button type="button" variant="outline" size="sm" onClick={() => setContractors([...contractors, { name: "", amount: "" }])}><Plus />Tambah Kontraktor</Button>}</fieldset>
    {signatories("Menyetujui", approvers, setApprovers)}{signatories("Mengetahui", acknowledgers, setAcknowledgers)}
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Saya menyatakan RAB sudah benar dan menyetujui penguncian permanen.</label><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Batal</Button><Button disabled={!confirmed || save.isPending}><LockKeyhole />{save.isPending ? "Memfinalisasi…" : "Finalisasi & Kunci RAB"}</Button></div>
  </fieldset></form></DialogContent></Dialog>;
}