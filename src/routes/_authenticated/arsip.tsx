import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Archive, ChevronRight, Folder, FileText, Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ARCHIVE_BUCKET, MONTHS, archiveBranch, type Finding } from "@/lib/archive";
import { ArchiveDocuments } from "@/components/ArchiveDocuments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { requireAuditPage } from "@/lib/access-client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/arsip")({
  beforeLoad: requireAuditPage,
  head: () => ({ meta: [
    { title: "Arsip Audit — AURA" },
    { name: "description", content: "Arsip hasil audit menurut tahun, bulan, project, dan nomor temuan." },
    { property: "og:title", content: "Arsip Audit — AURA" },
    { property: "og:description", content: "Detail temuan dan dokumen hasil audit internal di AURA." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: ArchivePage,
});

type Form = { year: string; month: string; projectKey: string; projectName: string; number: string; title: string; description: string };

function ArchivePage() {
  const client = useQueryClient();
  const [year, setYear] = useState<number>();
  const [month, setMonth] = useState<number>();
  const [project, setProject] = useState<string>();
  const [selected, setSelected] = useState<string>();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string>();
  const [form, setForm] = useState<Form>({ year: "", month: "", projectKey: "", projectName: "", number: "", title: "", description: "" });
  const query = useQuery({ queryKey: ["archive-findings"], queryFn: async () => {
    const { data, error } = await supabase.from("archive_findings").select("*").order("archive_year", { ascending: false }).order("archive_month", { ascending: false }).order("finding_number");
    if (error) throw error;
    return data;
  }});
  const projects = useQuery({ queryKey: ["archive-project-options"], queryFn: async () => {
    const { data, error } = await supabase.from("projects").select("id,name").order("name");
    if (error) throw error;
    return data;
  }});
  const findings = query.data ?? [];
  const active = findings.find(f => f.id === selected);
  const branch = archiveBranch(findings, year, month, project);
  const years = [...new Set(findings.map(f => f.archive_year))].sort((a,b) => b-a);
  const months = [...new Set(branch.map(f => f.archive_month))].sort((a,b) => a-b);
  const projectGroups = [...new Map(branch.map(f => [f.project_key, f.project_name])).entries()];
  const projectOptions = [...new Map([...findings.map(f => [f.project_key, f.project_name] as const), ...(projects.data ?? []).map(p => [p.id, p.name] as const)]).entries()];
  const searching = search.trim().length > 0;
  const matches = findings.filter(f => `${f.archive_year} ${MONTHS[f.archive_month-1]} ${f.project_name} ${f.finding_number} ${f.title} ${f.description}`.toLocaleLowerCase("id").includes(search.trim().toLocaleLowerCase("id")));
  function openForm(f?: Finding) {
    const now = new Date();
    setEditing(f?.id);
    setForm(f ? { year: String(f.archive_year), month: String(f.archive_month), projectKey: f.project_key, projectName: f.project_name, number: f.finding_number, title: f.title, description: f.description } : { year: String(year ?? now.getFullYear()), month: String(month ?? now.getMonth()+1), projectKey: project ?? "", projectName: projectOptions.find(([id]) => id === project)?.[1] ?? "", number: "", title: "", description: "" });
    setShowForm(true);
  }
  const save = useMutation({ mutationFn: async () => {
    if (!form.projectName.trim() || !form.number.trim() || !form.title.trim()) throw new Error("Lengkapi project, nomor temuan, dan judul.");
    const values = { archive_year: Number(form.year), archive_month: Number(form.month), project_key: form.projectKey || crypto.randomUUID(), project_name: form.projectName.trim(), finding_number: form.number.trim(), title: form.title.trim(), description: form.description.trim() };
    const result = editing ? await supabase.from("archive_findings").update(values).eq("id", editing).select().single() : await supabase.from("archive_findings").insert(values).select().single();
    if (result.error) throw result.error;
    return result.data;
  }, onSuccess: f => { client.invalidateQueries({ queryKey: ["archive-findings"] }); setShowForm(false); setSearch(""); setYear(f.archive_year); setMonth(f.archive_month); setProject(f.project_key); setSelected(f.id); toast.success("Temuan disimpan"); }, onError: e => toast.error(e.message.includes("duplicate") ? "Nomor temuan sudah ada pada project dan bulan ini." : e.message) });
  const remove = useMutation({ mutationFn: async (id: string) => {
    const { data, error } = await supabase.from("archive_documents").select("file_path").eq("finding_id", id);
    if (error) throw error;
    if (data.length) { const result = await supabase.storage.from(ARCHIVE_BUCKET).remove(data.map(d => d.file_path)); if (result.error) throw result.error; }
    const result = await supabase.from("archive_findings").delete().eq("id", id);
    if (result.error) throw result.error;
  }, onSuccess: () => { setSelected(undefined); client.invalidateQueries({ queryKey: ["archive-findings"] }); toast.success("Temuan dihapus"); }, onError: e => toast.error(e.message) });
  function navigate(level: number) { if (level < 1) setYear(undefined); if (level < 2) setMonth(undefined); if (level < 3) setProject(undefined); setSelected(undefined); setSearch(""); }
  const selectClass = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring";
  const folder = (id: string, label: string, count: number, click: () => void) => <Button key={id} variant="ghost" onClick={click} className="h-auto w-full justify-start gap-4 rounded-none border-b border-border px-2 py-4 text-left"><Folder className="text-primary" /><span className="min-w-0 flex-1 whitespace-normal break-words font-medium">{label}</span><span className="shrink-0 text-xs text-muted-foreground">{count} temuan</span><ChevronRight className="text-muted-foreground" /></Button>;
  const findingRow = (f: Finding) => <Button key={f.id} variant="ghost" onClick={() => { setSelected(f.id); setYear(f.archive_year); setMonth(f.archive_month); setProject(f.project_key); setSearch(""); }} className="h-auto w-full justify-start gap-4 rounded-none border-b border-border px-2 py-4 text-left"><FileText className="text-primary" /><span className="min-w-0 flex-1 whitespace-normal break-words"><span className="block font-semibold">{f.finding_number} · {f.title}</span>{searching && <span className="mt-1 block text-xs text-muted-foreground">{f.archive_year} / {MONTHS[f.archive_month-1]} / {f.project_name}</span>}</span><ChevronRight className="text-muted-foreground" /></Button>;
  return <div>
    <div className="mb-7 flex items-center justify-between gap-3"><h1 className="font-display text-3xl md:text-4xl">Arsip Audit</h1><Button onClick={() => openForm()} aria-label="Tambah Temuan"><Plus /><span className="hidden sm:inline">Tambah Temuan</span></Button></div>
    <div className="relative mb-5"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input aria-label="Cari arsip" placeholder="Cari nomor temuan, judul, atau project…" value={search} onChange={e => { setSearch(e.target.value); setSelected(undefined); }} className="pl-9" /></div>
    <nav aria-label="Lokasi arsip" className="mb-5 flex flex-wrap items-center gap-1 text-sm"><Button variant="ghost" size="sm" onClick={() => navigate(0)}><Archive />Arsip</Button>{year !== undefined && <><ChevronRight className="h-3 w-3 text-muted-foreground" /><Button variant="ghost" size="sm" onClick={() => navigate(1)}>{year}</Button></>}{month !== undefined && <><ChevronRight className="h-3 w-3 text-muted-foreground" /><Button variant="ghost" size="sm" onClick={() => navigate(2)}>{MONTHS[month-1]}</Button></>}{project && <><ChevronRight className="h-3 w-3 text-muted-foreground" /><Button variant="ghost" size="sm" className="h-auto min-h-8 whitespace-normal break-words text-left" onClick={() => navigate(3)}>{findings.find(f => f.project_key === project)?.project_name}</Button></>}</nav>
    {query.isPending ? <p className="text-sm text-muted-foreground">Memuat arsip…</p> : query.error ? <div role="alert" className="text-sm text-destructive">Arsip tidak dapat dimuat. <Button variant="outline" size="sm" onClick={() => query.refetch()}>Coba Lagi</Button></div> : active ? <article className="border-t border-border pt-5">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="mb-1 text-sm font-medium text-primary">{active.finding_number}</p><h2 className="break-words text-xl font-semibold">{active.title}</h2></div><div className="flex shrink-0 gap-1"><Button variant="ghost" size="icon" aria-label="Edit temuan" title="Edit temuan" onClick={() => openForm(active)}><Pencil /></Button><Button variant="ghost" size="icon" aria-label="Hapus temuan" title="Hapus temuan" disabled={remove.isPending} onClick={() => { if (window.confirm("Hapus temuan ini beserta seluruh dokumennya?")) remove.mutate(active.id); }}><Trash2 /></Button></div></div>
      <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-relaxed">{active.description || "Belum ada uraian."}</p><ArchiveDocuments key={active.id} findingId={active.id} />
    </article> : <section className="border-t border-border">
      {searching ? matches.map(findingRow) : year === undefined ? years.map(y => folder(String(y), String(y), archiveBranch(findings,y).length, () => setYear(y))) : month === undefined ? months.map(m => folder(String(m), MONTHS[m-1] ?? String(m), archiveBranch(findings,year,m).length, () => setMonth(m))) : project === undefined ? projectGroups.map(([id,name]) => folder(id,name,archiveBranch(findings,year,month,id).length,() => setProject(id))) : branch.map(findingRow)}
      {(searching ? matches.length === 0 : branch.length === 0) && <div className="py-14 text-center"><Archive className="mx-auto mb-3 h-9 w-9 text-muted-foreground" /><p className="text-sm text-muted-foreground">{searching ? "Tidak ada arsip yang sesuai." : "Belum ada temuan di arsip ini."}</p></div>}
    </section>}
    <Dialog open={showForm} onOpenChange={open => { if (!save.isPending) setShowForm(open); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{editing ? "Edit Temuan" : "Tambah Temuan"}</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
      <div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium">Tahun<Input required type="number" value={form.year} onChange={e => setForm({ ...form, year:e.target.value })} className="mt-1" /></label><label className="text-sm font-medium">Bulan<select aria-label="Bulan" required className={`mt-1 ${selectClass}`} value={form.month} onChange={e => setForm({ ...form, month:e.target.value })}>{MONTHS.map((m,i) => <option key={m} value={i+1}>{m}</option>)}</select></label></div>
      <label className="block text-sm font-medium">Project<select aria-label="Project" required className={`mt-1 ${selectClass}`} value={form.projectKey || "new"} onChange={e => { const id=e.target.value; setForm({ ...form, projectKey:id === "new" ? "" : id, projectName:projectOptions.find(([key]) => key === id)?.[1] ?? "" }); }}><option value="new">Project lainnya…</option>{projectOptions.map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      {!form.projectKey && <label className="block text-sm font-medium">Nama Project<Input required value={form.projectName} onChange={e => setForm({ ...form, projectName:e.target.value })} className="mt-1" /></label>}
      {projects.error && <p role="alert" className="text-sm text-destructive">Daftar project tidak dapat dimuat.</p>}
      <label className="block text-sm font-medium">Nomor Temuan<Input required value={form.number} onChange={e => setForm({ ...form, number:e.target.value })} className="mt-1" /></label>
      <label className="block text-sm font-medium">Judul Temuan<Input required value={form.title} onChange={e => setForm({ ...form, title:e.target.value })} className="mt-1" /></label>
      <label className="block text-sm font-medium">Uraian Hasil Audit<Textarea aria-label="Uraian Hasil Audit" rows={5} value={form.description} onChange={e => setForm({ ...form, description:e.target.value })} className="mt-1" /></label>
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={save.isPending} onClick={() => setShowForm(false)}>Batal</Button><Button disabled={save.isPending}>{save.isPending ? "Menyimpan…" : "Simpan Temuan"}</Button></div>
    </form></DialogContent></Dialog>
  </div>;
}