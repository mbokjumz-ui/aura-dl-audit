import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Archive, ChevronRight, Folder, Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isoYearObjects, type IsoObject } from "@/lib/iso-archive";
import { ArchiveDocuments } from "@/components/ArchiveDocuments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireAuditPage } from "@/lib/access-client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/arsip-iso")({
  beforeLoad: requireAuditPage,
  head: () => ({ meta: [
    { title: "Arsip ISO — AURA" },
    { name: "description", content: "Arsip dokumen ISO berdasarkan tahun dan object ISO di AURA." },
    { property: "og:title", content: "Arsip ISO — AURA" },
    { property: "og:description", content: "Dokumen ISO privat tersusun menurut tahun dan object ISO." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: IsoArchivePage,
});

function IsoArchivePage() {
  const client = useQueryClient();
  const [year, setYear] = useState<number>();
  const [selected, setSelected] = useState<string>();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string>();
  const [form, setForm] = useState({ year: "", name: "" });
  const query = useQuery({ queryKey: ["iso-objects"], queryFn: async () => {
    const { data, error } = await supabase.from("iso_objects").select("*").order("archive_year", { ascending: false }).order("object_name");
    if (error) throw error;
    return data;
  }});
  const objects = query.data ?? [];
  const active = objects.find(o => o.id === selected);
  const years = [...new Set(objects.map(o => o.archive_year))].sort((a, b) => b - a);
  const searching = search.trim().length > 0;
  const branch = year === undefined ? objects : isoYearObjects(objects, year);
  const matches = objects.filter(o => `${o.archive_year} ${o.object_name}`.toLocaleLowerCase("id").includes(search.trim().toLocaleLowerCase("id")));
  function openForm(object?: IsoObject) {
    setEditing(object?.id);
    setForm({ year: String(object?.archive_year ?? year ?? new Date().getFullYear()), name: object?.object_name ?? "" });
    setShowForm(true);
  }
  const save = useMutation({ mutationFn: async () => {
    const archiveYear = Number(form.year);
    if (!Number.isSafeInteger(archiveYear) || !form.name.trim()) throw new Error("Lengkapi tahun dan nama object ISO.");
    const values = { archive_year: archiveYear, object_name: form.name.trim() };
    const result = editing
      ? await supabase.from("iso_objects").update(values).eq("id", editing).select().single()
      : await supabase.from("iso_objects").insert(values).select().single();
    if (result.error) throw result.error;
    return result.data;
  }, onSuccess: object => {
    client.invalidateQueries({ queryKey: ["iso-objects"] });
    setShowForm(false); setYear(object.archive_year); setSelected(object.id); setSearch("");
    toast.success("Object ISO disimpan");
  }, onError: e => toast.error(e.message.includes("duplicate") ? "Object ISO sudah ada pada tahun ini." : e.message) });
  const remove = useMutation({ mutationFn: async (id: string) => {
    const { data, error } = await supabase.from("iso_documents").select("file_path").eq("object_id", id);
    if (error) throw error;
    if (data.length) {
      const result = await supabase.storage.from("iso-documents").remove(data.map(d => d.file_path));
      if (result.error) throw result.error;
    }
    const result = await supabase.from("iso_objects").delete().eq("id", id);
    if (result.error) throw result.error;
  }, onSuccess: () => {
    setSelected(undefined); client.invalidateQueries({ queryKey: ["iso-objects"] });
    toast.success("Object ISO dihapus");
  }, onError: e => toast.error(e.message) });
  const row = (id: string, label: string, subtitle: string, click: () => void) => <Button key={id} variant="ghost" onClick={click} className="h-auto w-full justify-start gap-4 rounded-none border-b border-border px-2 py-4 text-left"><Folder className="shrink-0 text-primary" /><span className="min-w-0 flex-1 whitespace-normal break-words font-medium">{label}{subtitle && <span className="mt-1 block text-xs font-normal text-muted-foreground">{subtitle}</span>}</span><ChevronRight className="shrink-0 text-muted-foreground" /></Button>;
  return <div>
    <div className="mb-7 flex items-center justify-between gap-3"><h1 className="font-display text-3xl md:text-4xl">Arsip ISO</h1><Button aria-label="Tambah Object ISO" onClick={() => openForm()}><Plus /><span className="hidden sm:inline">Tambah Object ISO</span></Button></div>
    <div className="relative mb-5"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input aria-label="Cari arsip ISO" placeholder="Cari tahun atau object ISO…" className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setSelected(undefined); }} /></div>
    <nav aria-label="Lokasi arsip ISO" className="mb-5 flex flex-wrap items-center gap-1 text-sm"><Button variant="ghost" size="sm" onClick={() => { setYear(undefined); setSelected(undefined); setSearch(""); }}><Archive />Arsip ISO</Button>{year !== undefined && <><ChevronRight className="h-3 w-3 text-muted-foreground" /><Button variant="ghost" size="sm" onClick={() => { setSelected(undefined); setSearch(""); }}>{year}</Button></>}{active && <><ChevronRight className="h-3 w-3 text-muted-foreground" /><span className="min-w-0 break-words px-2">{active.object_name}</span></>}</nav>
    {query.isPending ? <p className="text-sm text-muted-foreground">Memuat arsip ISO…</p> : query.error ? <div role="alert" className="text-sm text-destructive">Arsip ISO tidak dapat dimuat. <Button variant="outline" size="sm" onClick={() => query.refetch()}>Coba Lagi</Button></div> : active ? <article className="border-t border-border pt-5">
      <div className="flex items-start justify-between gap-3"><h2 className="min-w-0 break-words text-xl font-semibold">{active.object_name}</h2><div className="flex shrink-0 gap-1"><Button variant="ghost" size="icon" aria-label="Edit object ISO" title="Edit object ISO" onClick={() => openForm(active)}><Pencil /></Button><Button variant="ghost" size="icon" aria-label="Hapus object ISO" title="Hapus object ISO" disabled={remove.isPending} onClick={() => { if (window.confirm("Hapus object ISO ini beserta seluruh dokumennya?")) remove.mutate(active.id); }}><Trash2 /></Button></div></div>
      <ArchiveDocuments key={active.id} isoObjectId={active.id} />
    </article> : <section className="border-t border-border">
      {searching || year !== undefined ? (searching ? matches : branch).map(o => row(o.id, o.object_name, searching ? String(o.archive_year) : "", () => { setYear(o.archive_year); setSelected(o.id); setSearch(""); })) : years.map(y => row(String(y), String(y), `${isoYearObjects(objects, y).length} object ISO`, () => setYear(y)))}
      {(searching ? matches.length === 0 : branch.length === 0) && <div className="py-14 text-center"><Archive className="mx-auto mb-3 h-9 w-9 text-muted-foreground" /><p className="text-sm text-muted-foreground">{searching ? "Tidak ada arsip ISO yang sesuai." : "Belum ada object ISO di arsip ini."}</p></div>}
    </section>}
    <Dialog open={showForm} onOpenChange={open => { if (!save.isPending) setShowForm(open); }}><DialogContent><DialogHeader><DialogTitle>{editing ? "Edit Object ISO" : "Tambah Object ISO"}</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
      <label className="block text-sm font-medium">Tahun<Input required type="number" step="1" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} className="mt-1" /></label>
      <label className="block text-sm font-medium">Object ISO<Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1" /></label>
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={save.isPending} onClick={() => setShowForm(false)}>Batal</Button><Button disabled={save.isPending}>{save.isPending ? "Menyimpan…" : "Simpan Object"}</Button></div>
    </form></DialogContent></Dialog>
  </div>;
}