import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Plus, Pencil, Trash2, CornerDownRight, Paperclip, FileDown, CheckCircle2, RotateCcw, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { groupAmount, lineAmount, rabTotals, numberedRabRows, opnameCompletion, rupiah, type OpnameItem } from "@/lib/stock-opname";
import { ArchiveDocuments } from "@/components/ArchiveDocuments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { requireStockPage } from "@/lib/access-client";
import { canEnterActual } from "@/lib/access";
import { RabFinalizationDialog } from "@/components/RabFinalizationDialog";
import { rabTaxTotals, readRabFinalization, type FinalizedRab } from "@/lib/rab-finalization";

export const Route = createFileRoute("/_authenticated/stock-opname")({
  beforeLoad: requireStockPage,
  head: () => ({ meta: [
    { title: "Stock Opname Proyek — AURA" },
    { name: "description", content: "Susun RAB proyek dan cocokkan dengan hasil stock opname di AURA." },
    { property: "og:title", content: "Stock Opname Proyek — AURA" },
    { property: "og:description", content: "RAB proyek dua level dengan pencocokan otomatis hasil opname." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: StockOpnamePage,
});

type Header = { project_name: string; division_location: string; disposition_number: string; responsible_name: string; auditor_name: string };

function StockOpnamePage() {
  const client = useQueryClient();
  const [selected, setSelected] = useState<string>();
  const [headerForm, setHeaderForm] = useState<(Header & { id?: string }) | null>(null);
  const list = useQuery({ queryKey: ["stock-opname-projects"], queryFn: async () => {
    const { data, error } = await supabase.from("stock_opname_projects").select("*, stock_opname_items(*)").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  }});
  const saveHeader = useMutation({ mutationFn: async (f: Header & { id?: string }) => {
    if (!f.project_name.trim()) throw new Error("Nama proyek wajib diisi.");
    const values = { project_name: f.project_name.trim(), division_location: f.division_location.trim(), disposition_number: f.disposition_number.trim(), responsible_name: f.responsible_name.trim(), auditor_name: f.auditor_name.trim() };
    const r = f.id ? await supabase.from("stock_opname_projects").update(values).eq("id", f.id).select().single()
      : await supabase.from("stock_opname_projects").insert(values).select().single();
    if (r.error) throw r.error;
    return r.data;
  }, onSuccess: d => { client.invalidateQueries({ queryKey: ["stock-opname-projects"] }); setHeaderForm(null); setSelected(d.id); toast.success("RAB disimpan"); },
    onError: e => toast.error(e.message) });
  const active = list.data?.find(p => p.id === selected);

  return <div>
    {active ? <RabDetail rab={active} items={active.stock_opname_items as OpnameItem[]} onBack={() => setSelected(undefined)} onEdit={() => setHeaderForm({ ...active })} />
    : <>
      <div className="mb-7 flex items-center justify-between gap-3"><h1 className="font-display text-3xl md:text-4xl">Stock Opname Proyek</h1>
        <Button onClick={() => setHeaderForm({ project_name: "", division_location: "", disposition_number: "", responsible_name: "", auditor_name: "" })}><Plus />Buat RAB</Button></div>
      {list.isLoading ? <p className="text-muted-foreground">Memuat…</p> : !list.data?.length ? <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">Belum ada RAB. Mulai dengan membuat RAB proyek.</p> :
      <div className="grid gap-3 md:grid-cols-2">{list.data.map(p => { const t = rabTotals(p.stock_opname_items as OpnameItem[]); return (
         <Button variant="outline" key={p.id} onClick={() => setSelected(p.id)} className="h-auto min-w-0 flex-col items-stretch whitespace-normal rounded-lg border border-border bg-card p-5 text-left transition-colors hover:border-primary">
           <div className="flex items-start justify-between gap-3"><p className="break-words font-medium">{p.project_name}</p><span className="shrink-0 text-xs text-primary">{p.status === "selesai" ? "Selesai" : "Berjalan"}</span></div>
          <p className="mt-1 text-xs text-muted-foreground">{p.division_location || "—"} · Disposisi {p.disposition_number || "—"}</p>
          <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm"><span>RAB {rupiah(rabTaxTotals(t.rab, p.vat_included).total)}{p.finalized_at ? " · Final" : " · Draft"}</span><span className="text-muted-foreground">Opname {t.counted}/{t.total} detil</span></div>
         </Button>); })}</div>}
    </>}
    <Dialog open={!!headerForm} onOpenChange={o => !o && setHeaderForm(null)}>
      <DialogContent><DialogHeader><DialogTitle>{headerForm?.id ? "Edit Header RAB" : "Buat RAB Proyek"}</DialogTitle></DialogHeader>
        {headerForm && <form className="space-y-3" onSubmit={e => { e.preventDefault(); saveHeader.mutate(headerForm); }}>
          <Field label="Nama proyek"><Input value={headerForm.project_name} onChange={e => setHeaderForm({ ...headerForm, project_name: e.target.value })} required /></Field>
          <Field label="Divisi / lokasi proyek"><Input value={headerForm.division_location} onChange={e => setHeaderForm({ ...headerForm, division_location: e.target.value })} /></Field>
          <Field label="Nomor disposisi"><Input value={headerForm.disposition_number} onChange={e => setHeaderForm({ ...headerForm, disposition_number: e.target.value })} /></Field>
           <Field label="Nama penanggung jawab project"><Input value={headerForm.responsible_name} onChange={e => setHeaderForm({ ...headerForm, responsible_name: e.target.value })} /></Field>
           <Field label="Nama auditor stock opname"><Input value={headerForm.auditor_name} onChange={e => setHeaderForm({ ...headerForm, auditor_name: e.target.value })} /></Field>
          <Button type="submit" className="w-full" disabled={saveHeader.isPending}>Simpan</Button>
        </form>}
      </DialogContent>
    </Dialog>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1 text-sm font-medium">{label}{children}</label>;
}

type ItemForm = { id?: string; parent_id: string | null; description: string; quantity: string; unit: string; unit_price: string };

function RabDetail({ rab, items, onBack, onEdit }: { rab: { id: string; status: string; completed_at: string | null } & Header & FinalizedRab; items: OpnameItem[]; onBack: () => void; onEdit: () => void }) {
  const { appRole } = Route.useRouteContext();
  const canEditActual = canEnterActual(appRole);
  const client = useQueryClient();
  const [tab, setTab] = useState<"rab" | "opname">("rab");
  const [form, setForm] = useState<ItemForm | null>(null);
  const [attachmentItem, setAttachmentItem] = useState<OpnameItem | null>(null);
  const [exporting, setExporting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const locked = !!rab.finalized_at;
  const refresh = () => client.invalidateQueries({ queryKey: ["stock-opname-projects"] });
  const rows = numberedRabRows(items);
  const totals = rabTotals(items);
  const taxTotals = rabTaxTotals(totals.rab, rab.vat_included);
  const finalDetails = readRabFinalization(rab);
  const hasChildren = (id?: string) => !!id && items.some(i => i.parent_id === id);

  const saveItem = useMutation({ mutationFn: async (f: ItemForm) => {
    if (locked) throw new Error("RAB sudah final dan tidak dapat diubah.");
    if (!f.description.trim()) throw new Error("Uraian pengerjaan wajib diisi.");
    const values = { rab_id: rab.id, parent_id: f.parent_id, description: f.description.trim(), quantity: Number(f.quantity) || 0, unit: f.unit.trim(), unit_price: Number(f.unit_price) || 0 };
    const r = f.id ? await supabase.from("stock_opname_items").update(values).eq("id", f.id)
      : await supabase.from("stock_opname_items").insert({ ...values, sort_order: items.length });
    if (r.error) throw r.error;
  }, onSuccess: () => { refresh(); setForm(null); }, onError: e => toast.error(e.message) });
  async function filePaths(itemIds: string[]) {
    if (!itemIds.length) return [];
    const { data, error } = await supabase.from("stock_opname_documents").select("file_path").in("item_id", itemIds);
    if (error) throw error;
    return data.map(d => d.file_path);
  }
  async function cleanupFiles(paths: string[]) {
    if (!paths.length) return;
    const result = await supabase.storage.from("stock-opname-documents").remove(paths);
    if (result.error) toast.error("Data dihapus, tetapi sebagian berkas belum dapat dibersihkan.");
  }
  const removeItem = useMutation({ mutationFn: async (id: string) => { if (locked) throw new Error("RAB sudah final."); const paths = await filePaths(items.filter(i => i.id === id || i.parent_id === id).map(i => i.id)); const r = await supabase.from("stock_opname_items").delete().eq("id", id); if (r.error) throw r.error; await cleanupFiles(paths); }, onSuccess: refresh, onError: e => toast.error(e.message) });
  const removeRab = useMutation({ mutationFn: async () => { if (locked) throw new Error("RAB sudah final."); const paths = await filePaths(items.map(i => i.id)); const r = await supabase.from("stock_opname_projects").delete().eq("id", rab.id); if (r.error) throw r.error; await cleanupFiles(paths); },
    onSuccess: () => { onBack(); refresh(); toast.success("RAB dihapus"); }, onError: e => toast.error(e.message) });
  const saveActual = useMutation({ mutationFn: async ({ id, value }: { id: string; value: string }) => {
    if (!canEditActual) throw new Error("Hanya Internal Audit dapat mengisi jumlah riil.");
    const r = await supabase.from("stock_opname_items").update({ actual_quantity: value === "" ? null : Number(value) }).eq("id", id);
    if (r.error) throw r.error;
  }, onSuccess: refresh, onError: e => toast.error(e.message) });
  const complete = useMutation({ mutationFn: async (done: boolean) => {
    const { error } = await supabase.from("stock_opname_projects").update(opnameCompletion(done)).eq("id", rab.id);
    if (error) throw error;
  }, onSuccess: (_, done) => { refresh(); toast.success(done ? "Stock opname ditandai selesai" : "Stock opname dibuka kembali"); }, onError: e => toast.error(e.message) });
  async function exportPdf() {
    setExporting(true);
    try {
      const { data, error } = items.length ? await supabase.from("stock_opname_documents").select("item_id,file_name").in("item_id", items.map(i => i.id)) : { data: [], error: null };
      if (error) throw error;
      const { stockOpnamePdf } = await import("@/lib/stock-opname-pdf");
      stockOpnamePdf(rab, items, data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Laporan PDF gagal dibuat."); }
    finally { setExporting(false); }
  }

  const edit = (i: OpnameItem) => setForm({ id: i.id, parent_id: i.parent_id, description: i.description, quantity: String(i.quantity), unit: i.unit, unit_price: String(i.unit_price) });
  const diffClass = (d: number) => d < 0 ? "text-destructive" : d > 0 ? "text-primary" : "text-muted-foreground";

  const row = (i: OpnameItem, number: string, level: number, group?: OpnameItem[]) => {
    const rabAmt = group ? groupAmount(group, "quantity") : lineAmount(i.quantity, i.unit_price);
    const actAmt = group ? groupAmount(group, "actual_quantity") : i.actual_quantity === null ? null : lineAmount(i.actual_quantity, i.unit_price);
    return <tr key={i.id} className={group ? "bg-muted/40 font-medium" : ""}>
      <td className="p-2 align-top tabular-nums">{number}</td>
      <td className="p-2"><span className={`flex items-start gap-1 ${level > 0 ? "pl-4" : ""}`}>{level > 0 && <CornerDownRight className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />}{i.description}</span></td>
      <td className="p-2 text-right">{group ? "" : i.quantity.toLocaleString("id-ID")}</td>
      <td className="p-2">{group ? "" : i.unit}</td>
      <td className="p-2 text-right">{group ? "" : rupiah(i.unit_price)}</td>
      <td className="p-2 text-right">{rupiah(rabAmt)}</td>
      {tab === "rab" ? <td className="p-2"><div className="flex justify-end gap-1">
        {!locked && <>{level === 0 && <Button size="icon" variant="ghost" aria-label="Tambah sub-poin" onClick={() => setForm({ parent_id: i.id, description: "", quantity: "", unit: "", unit_price: "" })}><Plus /></Button>}
        <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => edit(i)}><Pencil /></Button>
        <Button size="icon" variant="ghost" aria-label="Hapus" disabled={!canEditActual && (i.actual_quantity !== null || !!group?.some(child => child.actual_quantity !== null))} onClick={() => removeItem.mutate(i.id)}><Trash2 /></Button></>}</div></td>
      : <>
        <td className="p-2">{group ? "" : canEditActual ? <Input aria-label={`Jumlah riil ${i.description}`} type="number" min="0" step="any" className="h-8 w-24 text-right" defaultValue={i.actual_quantity ?? ""} onBlur={e => { if (e.target.value !== String(i.actual_quantity ?? "")) saveActual.mutate({ id: i.id, value: e.target.value }); }} /> : <span className="block text-right tabular-nums">{i.actual_quantity?.toLocaleString("id-ID") ?? "—"}</span>}</td>
        <td className="p-2 text-right">{actAmt === null ? "—" : rupiah(actAmt)}</td>
        <td className={`p-2 text-right ${actAmt === null ? "" : diffClass(actAmt - rabAmt)}`}>{actAmt === null ? "—" : rupiah(actAmt - rabAmt)}</td>
         <td className="p-2"><Button size="icon" variant="ghost" title="Lampiran dokumen atau foto" aria-label={`Lampiran ${number} ${i.description}`} onClick={() => setAttachmentItem(i)}><Paperclip /></Button></td>
      </>}
    </tr>;
  };

  return <div>
    <Button variant="ghost" size="sm" onClick={onBack} className="mb-4"><ArrowLeft />Semua RAB</Button>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="font-display text-3xl md:text-4xl">{rab.project_name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Divisi/lokasi: {rab.division_location || "—"} · No. disposisi: {rab.disposition_number || "—"}</p>
        <p className="mt-1 text-sm text-muted-foreground">Penanggung jawab: {rab.responsible_name || "—"} · Auditor: {rab.auditor_name || "—"}</p>
        <p className="mt-2 text-sm font-semibold text-primary">{rab.status === "selesai" ? `Selesai${rab.completed_at ? ` · ${new Date(rab.completed_at).toLocaleDateString("id-ID")}` : ""}` : "Berjalan"}</p></div>
      <div className="flex flex-wrap gap-2">{!locked && <><Button variant="outline" onClick={onEdit}><Pencil />Header</Button><Button variant="outline" disabled={!items.length || saveItem.isPending || removeItem.isPending || removeRab.isPending} onClick={() => setFinalizing(true)}><LockKeyhole />Finalisasi RAB</Button></>}
        <Button variant="outline" disabled={exporting || saveActual.isPending} onClick={exportPdf}><FileDown />{exporting ? "Membuat PDF…" : "Cetak PDF"}</Button>
        {canEditActual && <Button disabled={complete.isPending || saveActual.isPending} onClick={() => {
          const done = rab.status !== "selesai";
          const message = done ? `Tandai stock opname selesai?${totals.counted < totals.total ? ` Masih ada ${totals.total - totals.counted} poin tanpa jumlah riil.` : ""}` : "Buka kembali stock opname ini?";
          if (window.confirm(message)) complete.mutate(done);
        }}>{rab.status === "selesai" ? <RotateCcw /> : <CheckCircle2 />}{rab.status === "selesai" ? "Buka Kembali" : "Tandai Selesai"}</Button>}
        {!locked && <Button variant="outline" disabled={!canEditActual && items.some(item => item.actual_quantity !== null)} onClick={() => confirm("Hapus RAB ini beserta seluruh isinya?") && removeRab.mutate()}><Trash2 />Hapus</Button>}</div>
    </div>
    {locked && <p className="mb-5 flex items-center gap-2 border-y border-border py-3 text-sm font-semibold text-primary"><LockKeyhole className="h-4 w-4" />RAB Final · {rab.finalized_at ? new Date(rab.finalized_at).toLocaleDateString("id-ID") : ""}</p>}
    <div className="mb-5 grid gap-3 sm:grid-cols-3">
      <Stat label={rab.vat_included ? "Total RAB + PPN 11%" : "Total RAB (Exclude PPN)"} value={rupiah(taxTotals.total)} />
      <Stat label={`Hasil opname (${totals.counted}/${totals.total})`} value={rupiah(totals.actual)} />
      <Stat label="Selisih" value={rupiah(totals.difference)} className={diffClass(totals.difference)} />
    </div>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div className="inline-flex rounded-lg border border-border p-1">
        <Button size="sm" variant={tab === "rab" ? "default" : "ghost"} onClick={() => setTab("rab")}>1. RAB</Button>
        <Button size="sm" variant={tab === "opname" ? "default" : "ghost"} onClick={() => setTab("opname")} disabled={!items.length}>2. Stock Opname</Button>
      </div>
      {tab === "rab" && !locked && <Button onClick={() => setForm({ parent_id: null, description: "", quantity: "", unit: "", unit_price: "" })}><Plus />Tambah Poin</Button>}
    </div>
    <dl className="ml-auto mt-4 max-w-sm space-y-2 text-sm"><div className="flex justify-between gap-3"><dt>Total sebelum PPN</dt><dd>{rupiah(totals.rab)}</dd></div><div className="flex justify-between gap-3"><dt>PPN {rab.vat_included ? "11%" : "(Exclude)"}</dt><dd>{rupiah(taxTotals.ppn)}</dd></div><div className="flex justify-between gap-3 border-t border-border pt-2 font-semibold"><dt>Total akhir RAB</dt><dd>{rupiah(taxTotals.total)}</dd></div></dl>
    {locked && finalDetails && <section className="mt-7 space-y-5 border-t border-border pt-5"><div><h2 className="mb-3 font-semibold">Perbandingan penawaran sebelum PPN</h2><ul className="divide-y divide-border">{finalDetails.contractors.map((c, i) => <li key={i} className="flex flex-wrap justify-between gap-3 py-2"><span className="break-words">{i + 1}. {c.name}</span><span className="tabular-nums">{rupiah(c.amount)}</span></li>)}</ul></div><div className="grid gap-5 sm:grid-cols-2">{[{ title: "Menyetujui", rows: finalDetails.approvers }, { title: "Mengetahui", rows: finalDetails.acknowledgers }].map(group => <div key={group.title}><h2 className="mb-2 font-semibold">{group.title}</h2>{group.rows.map((person, i) => <p key={i} className="mb-2 break-words text-sm">{person.name}<span className="block text-muted-foreground">{person.position}</span></p>)}</div>)}</div></section>}
    {finalizing && !locked && <RabFinalizationDialog rabId={rab.id} subtotal={totals.rab} onClose={() => setFinalizing(false)} onFinalized={() => { setForm(null); refresh(); }} />}
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b border-border text-left text-xs text-muted-foreground"><tr>
          <th className="p-2">No.</th><th className="p-2">Uraian pengerjaan</th><th className="p-2 text-right">Jumlah</th><th className="p-2">Satuan</th><th className="p-2 text-right">Nilai</th><th className="p-2 text-right">Amount RAB</th>
          {tab === "rab" ? <th /> : <><th className="p-2">Jumlah riil</th><th className="p-2 text-right">Amount opname</th><th className="p-2 text-right">Selisih</th><th className="p-2">Lampiran</th></>}
        </tr></thead>
        <tbody className="divide-y divide-border">
          {rows.length === 0 && <tr><td colSpan={tab === "rab" ? 7 : 10} className="p-6 text-center text-muted-foreground">Belum ada poin pengerjaan.</td></tr>}
          {rows.map(({ item, number, level, children }) => row(item, number, level, children.length ? children : undefined))}
        </tbody>
        <tfoot className="border-t-2 border-border font-semibold"><tr>
          <td className="p-2" colSpan={5}>Total</td><td className="p-2 text-right">{rupiah(totals.rab)}</td>
          {tab === "rab" ? <td /> : <><td /><td className="p-2 text-right">{rupiah(totals.actual)}</td><td className={`p-2 text-right ${diffClass(totals.difference)}`}>{rupiah(totals.difference)}</td><td /></>}
        </tr></tfoot>
      </table>
    </div>
    <Dialog open={!!attachmentItem} onOpenChange={o => !o && setAttachmentItem(null)}>
      <DialogContent><DialogHeader><DialogTitle>Lampiran — {attachmentItem?.description}</DialogTitle></DialogHeader>
        {attachmentItem && <ArchiveDocuments stockItemId={attachmentItem.id} />}
      </DialogContent>
    </Dialog>
    <Dialog open={!!form} onOpenChange={o => !o && setForm(null)}>
      <DialogContent><DialogHeader><DialogTitle>{form?.id ? "Edit" : "Tambah"} {form?.parent_id ? "Sub-poin" : "Poin"} Pengerjaan</DialogTitle></DialogHeader>
        {form && <form className="space-y-3" onSubmit={e => { e.preventDefault(); saveItem.mutate(form); }}>
          <Field label="Uraian / detil pengerjaan"><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required /></Field>
          {hasChildren(form.id) ? <p className="text-xs text-muted-foreground">Poin ini punya sub-poin; amount dihitung dari sub-poinnya.</p> : <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Jumlah"><Input type="number" min="0" step="any" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} /></Field>
              <Field label="Satuan"><Input value={form.unit} placeholder="m², unit, ls…" onChange={e => setForm({ ...form, unit: e.target.value })} /></Field>
            </div>
            <Field label="Nilai pengerjaan (Rp)"><Input type="number" min="0" step="any" value={form.unit_price} onChange={e => setForm({ ...form, unit_price: e.target.value })} /></Field>
            <p className="text-sm">Amount: <b>{rupiah(lineAmount(Number(form.quantity) || 0, Number(form.unit_price) || 0))}</b></p>
            {!form.parent_id && !form.id && <p className="text-xs text-muted-foreground">Kosongkan jumlah/nilai bila poin ini akan diisi sub-poin.</p>}
          </>}
          <Button type="submit" className="w-full" disabled={saveItem.isPending}>Simpan</Button>
        </form>}
      </DialogContent>
    </Dialog>
  </div>;
}

function Stat({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-1 text-xl font-semibold ${className}`}>{value}</p></div>;
}
