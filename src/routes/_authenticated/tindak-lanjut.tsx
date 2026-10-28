import { createFileRoute } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, ArrowLeft, ChevronRight, Link as LinkIcon, Check, RotateCcw, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FOLLOW_UP_STATUS, FOLLOW_UP_BUCKET, canReview, eligibleProject, type FollowUpStatus } from '@/lib/follow-up';
import { createFollowUpLink, reviewFollowUp } from '@/lib/follow-up.functions';
import { formatDate } from '@/lib/audit';
import { AttachmentActions } from '@/components/AttachmentActions';
import { privateDocumentUrl } from '@/lib/document-preview';
import { requireAuditPage } from '@/lib/access-client';

export const Route = createFileRoute('/_authenticated/tindak-lanjut')({ beforeLoad: requireAuditPage, head: () => ({ meta: [
  { title: 'Tindak Lanjut — AURA' }, { name: 'description', content: 'Penugasan, bukti pelaksanaan, dan tinjauan tindak lanjut hasil audit di AURA.' },
  { property: 'og:title', content: 'Tindak Lanjut — AURA' }, { property: 'og:description', content: 'Monitor tindak lanjut auditee dan tinjau bukti pelaksanaannya.' },
  { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
] }), component: FollowUpPage });

const emptyProject = { projectId: '', name: '', email: '' };
const emptyItem = { title: '', description: '', name: '', email: '', due: '' };
function FollowUpPage() {
  const client = useQueryClient();
  const [selected, setSelected] = useState<string>();
  const [dialog, setDialog] = useState<'project' | 'item' | null>(null);
  const [editingProject, setEditingProject] = useState(false);
  const [editingItem, setEditingItem] = useState<string>();
  const [projectForm, setProjectForm] = useState(emptyProject);
  const [itemForm, setItemForm] = useState(emptyItem);
  const [filter, setFilter] = useState('all');
  const [notes, setNotes] = useState<Record<string,string>>({});
  const [generatedLink, setGeneratedLink] = useState<{ url: string; recipient: string; expiresAt: string }>();
  const makeLink = useServerFn(createFollowUpLink);
  const review = useServerFn(reviewFollowUp);
  const projectsQuery = useQuery({ queryKey: ['follow-up-projects'], queryFn: async () => { const r = await supabase.from('follow_up_projects').select('*, follow_up_items(id,status)').order('created_at', { ascending: false }); if (r.error) throw r.error; return r.data; } });
  const availableQuery = useQuery({ queryKey: ['follow-up-available-projects'], queryFn: async () => { const r = await supabase.from('projects').select('id,name,status').eq('status','selesai'); if (r.error) throw r.error; return r.data; } });
  const itemsQuery = useQuery({ queryKey: ['follow-up-items', selected], enabled: Boolean(selected), queryFn: async () => { const r = await supabase.from('follow_up_items').select('*, follow_up_submissions(*, follow_up_documents(*))').eq('follow_up_project_id', selected ?? '').order('created_at'); if (r.error) throw r.error; return r.data; } });
  const projects = projectsQuery.data ?? [];
  const active = projects.find(p => p.id === selected);
  const available = (availableQuery.data ?? []).filter(p => eligibleProject(p.status) && !projects.some(f => f.project_id === p.id));
  function refresh() { client.invalidateQueries({ queryKey: ['follow-up-projects'] }); client.invalidateQueries({ queryKey: ['follow-up-items'] }); }
  const saveProject = useMutation({ mutationFn: async () => {
    const values = { responsible_name: projectForm.name.trim(), responsible_email: projectForm.email.trim() };
    if (!values.responsible_name || !values.responsible_email) throw new Error('Lengkapi penanggung jawab.');
    if (editingProject && active) { const r = await supabase.from('follow_up_projects').update(values).eq('id',active.id).select().single(); if(r.error) throw r.error; return r.data; }
    const project = available.find(p => p.id === projectForm.projectId); if (!project) throw new Error('Pilih Project yang sudah selesai.');
    const r = await supabase.from('follow_up_projects').insert({ ...values, project_id: project.id, project_name: project.name }).select().single(); if(r.error) throw r.error; return r.data;
  }, onSuccess: p => { refresh(); setSelected(p.id); setDialog(null); toast.success('Tindak lanjut Project disimpan'); }, onError: e => toast.error(e.message) });
  const saveItem = useMutation({ mutationFn: async () => {
    if (!active || !itemForm.title.trim() || !itemForm.name.trim() || !itemForm.email.trim()) throw new Error('Lengkapi poin dan pelaksana.');
    const values = { title: itemForm.title.trim(), description: itemForm.description.trim(), executor_name: itemForm.name.trim(), executor_email: itemForm.email.trim(), due_date: itemForm.due || null };
    const r = editingItem ? await supabase.from('follow_up_items').update(values).eq('id', editingItem).eq('status','pending').select().single() : await supabase.from('follow_up_items').insert({ ...values, follow_up_project_id: active.id }).select().single();
    if(r.error) throw r.error;
  }, onSuccess: () => { refresh(); setDialog(null); toast.success('Poin tindak lanjut disimpan'); }, onError: e => toast.error(e.message) });
  const links = useMutation({ mutationFn: async (itemId: string | null) => {
    if(!active) throw new Error('Pilih Project.');
    const result = await makeLink({ data: { projectId: active.id, itemId, role: itemId ? 'executor' : 'responsible' } });
    const item = itemsQuery.data?.find(i => i.id === itemId);
    return { url: `${window.location.origin}/auditee#token=${result.token}`, recipient: item ? `${item.executor_name} (${item.executor_email})` : `${active.responsible_name} (${active.responsible_email})`, expiresAt: result.expiresAt };
  }, onSuccess: setGeneratedLink, onError: e => toast.error(e.message) });
  const reviewItem = useMutation({ mutationFn: (data: { itemId: string; decision: 'approved' | 'revision'; note: string }) => review({ data }), onSuccess: () => { refresh(); toast.success('Tinjauan disimpan'); }, onError: e => toast.error(e.message) });
  const items = itemsQuery.data ?? [];
  return <div>
    <div className="mb-7 flex flex-wrap items-center justify-between gap-3"><h1 className="font-display text-3xl md:text-4xl">Tindak Lanjut</h1><Button onClick={() => { if(active) { setItemForm(emptyItem); setEditingItem(undefined); setDialog('item'); } else { setProjectForm(emptyProject); setEditingProject(false); setDialog('project'); } }}><Plus />{active ? 'Tambah Poin' : 'Tambah Project'}</Button></div>
    {projectsQuery.error && <p role="alert" className="mb-4 text-destructive">Tindak lanjut tidak dapat dimuat. <Button variant="outline" onClick={() => projectsQuery.refetch()}>Coba Lagi</Button></p>}
    {active ? <>
      <Button variant="ghost" className="mb-4" onClick={() => { setSelected(undefined); setFilter('all'); }}><ArrowLeft />Semua Project</Button>
      <section className="mb-6 border-y border-border py-5"><h2 className="break-words text-xl font-semibold">{active.project_name}</h2><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><p className="text-sm font-medium">Penanggung jawab: {active.responsible_name}</p><p className="break-all text-sm text-muted-foreground">{active.responsible_email}</p></div><div className="flex gap-2"><Button variant="outline" size="icon" title="Edit penanggung jawab" aria-label="Edit penanggung jawab" onClick={() => { setEditingProject(true); setProjectForm({ projectId: active.project_id ?? '', name: active.responsible_name, email: active.responsible_email }); setDialog('project'); }}><Pencil /></Button><Button variant="outline" disabled={links.isPending} onClick={() => links.mutate(null)}><LinkIcon />Link Penanggung Jawab</Button></div></div></section>
      <div className="mb-5 flex flex-wrap gap-2">{Object.entries({ all: 'Semua', ...FOLLOW_UP_STATUS }).map(([value,label]) => <Button size="sm" key={value} variant={filter === value ? 'default' : 'outline'} onClick={() => setFilter(value)}>{label}</Button>)}</div>
      {itemsQuery.isPending ? <p>Memuat poin…</p> : itemsQuery.error ? <p role="alert" className="text-destructive">Poin tidak dapat dimuat. <Button onClick={() => itemsQuery.refetch()}>Coba Lagi</Button></p> : items.filter(i => filter === 'all' || i.status === filter).map(item => <article key={item.id} className="mb-6 rounded-lg border border-border bg-card p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="min-w-0 break-words text-lg font-semibold">{item.title}</h3><span className="text-sm font-medium text-primary">{FOLLOW_UP_STATUS[item.status as FollowUpStatus]}</span></div><p className="mt-3 whitespace-pre-wrap break-words text-sm">{item.description}</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className="min-w-0 text-sm"><p>Pelaksana: {item.executor_name}</p><p className="break-all text-muted-foreground">{item.executor_email}</p><p className="mt-1 text-muted-foreground">Target: {formatDate(item.due_date)}</p></div><div className="flex gap-2">{item.status === 'pending' && <Button variant="outline" size="icon" title="Edit poin" aria-label="Edit poin" onClick={() => { setEditingItem(item.id); setItemForm({ title: item.title, description: item.description, name: item.executor_name, email: item.executor_email, due: item.due_date ?? '' }); setDialog('item'); }}><Pencil /></Button>}<Button variant="outline" disabled={links.isPending} onClick={() => links.mutate(item.id)}><LinkIcon />Link Pelaksana</Button></div></div>
        {item.review_note && <p className="mt-4 whitespace-pre-wrap break-words border-l-2 border-primary pl-3 text-sm">Catatan auditor: {item.review_note}</p>}
        {[...item.follow_up_submissions].sort((a,b) => b.created_at.localeCompare(a.created_at)).map(s => <section key={s.id} className="mt-5 border-t border-border pt-4"><p className="text-xs text-muted-foreground">{formatDate(s.created_at.slice(0,10))} · {s.author_role === 'responsible' ? 'Penanggung jawab' : 'Pelaksana'}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm">{s.description}</p>{s.follow_up_documents.map(d => <div key={d.id} className="mt-2 flex items-center gap-2"><span className="min-w-0 flex-1 break-all text-sm">{d.file_name}</span><AttachmentActions name={d.file_name} getUrl={download => privateDocumentUrl(FOLLOW_UP_BUCKET, d.file_path, d.file_name, download)} /></div>)}</section>)}
        {canReview(item.status) && <section className="mt-5 border-t border-border pt-4"><label className="block text-sm font-medium">Catatan tinjauan<Textarea className="mt-2" maxLength={10000} value={notes[item.id] ?? ''} onChange={e => setNotes({ ...notes, [item.id]: e.target.value })} /></label><div className="mt-3 flex flex-wrap gap-2"><Button disabled={reviewItem.isPending} onClick={() => reviewItem.mutate({ itemId: item.id, decision: 'approved', note: notes[item.id] ?? '' })}><Check />Setujui Selesai</Button><Button variant="outline" disabled={reviewItem.isPending} onClick={() => reviewItem.mutate({ itemId: item.id, decision: 'revision', note: notes[item.id] ?? '' })}><RotateCcw />Minta Perbaikan</Button></div></section>}
      </article>)}
      {!itemsQuery.isPending && !items.length && <p className="py-10 text-center text-muted-foreground">Belum ada poin tindak lanjut.</p>}
    </> : <section className="border-t border-border">{projectsQuery.isPending ? <p className="py-6">Memuat Project…</p> : projects.map(p => <Button key={p.id} variant="ghost" className="h-auto w-full justify-start gap-3 rounded-none border-b border-border py-5 text-left" onClick={() => setSelected(p.id)}><div className="min-w-0 flex-1"><p className="whitespace-normal break-words font-semibold">{p.project_name}</p><p className="mt-1 whitespace-normal text-xs text-muted-foreground">{p.responsible_name} · {p.follow_up_items.filter(i => i.status === 'approved').length}/{p.follow_up_items.length} poin selesai</p></div><ChevronRight className="shrink-0" /></Button>)}{!projectsQuery.isPending && !projects.length && <p className="py-14 text-center text-muted-foreground">Belum ada tindak lanjut hasil audit.</p>}</section>}
    <Dialog open={dialog !== null} onOpenChange={open => { if(!open) setDialog(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{dialog === 'project' ? editingProject ? 'Edit Penanggung Jawab' : 'Tambah Tindak Lanjut Project' : editingItem ? 'Edit Poin' : 'Tambah Poin Tindak Lanjut'}</DialogTitle></DialogHeader>
      {dialog === 'project' ? <form className="space-y-4" onSubmit={e => { e.preventDefault(); saveProject.mutate(); }}>
        {!editingProject && <label className="block text-sm font-medium">Project selesai<select required aria-label="Project selesai" className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={projectForm.projectId} onChange={e => setProjectForm({ ...projectForm, projectId: e.target.value })}><option value="">Pilih Project</option>{available.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>{availableQuery.isPending ? <span className="mt-2 block text-xs text-muted-foreground">Memuat Project…</span> : availableQuery.error ? <span role="alert" className="mt-2 block text-xs text-destructive">Project tidak dapat dimuat.</span> : !available.length && <span className="mt-2 block text-xs text-muted-foreground">Tidak ada Project selesai yang belum memiliki tindak lanjut.</span>}</label>}
        <label className="block text-sm font-medium">Nama penanggung jawab<Input required maxLength={200} className="mt-2" value={projectForm.name} onChange={e => setProjectForm({ ...projectForm, name: e.target.value })} /></label><label className="block text-sm font-medium">Email penanggung jawab<Input required type="email" maxLength={254} className="mt-2" value={projectForm.email} onChange={e => setProjectForm({ ...projectForm, email: e.target.value })} /></label><Button disabled={saveProject.isPending}>Simpan Project</Button>
      </form> : <form className="space-y-4" onSubmit={e => { e.preventDefault(); saveItem.mutate(); }}>
        <label className="block text-sm font-medium">Poin tindak lanjut<Input required maxLength={500} className="mt-2" value={itemForm.title} onChange={e => setItemForm({ ...itemForm, title: e.target.value })} /></label><label className="block text-sm font-medium">Uraian<Textarea maxLength={10000} className="mt-2" value={itemForm.description} onChange={e => setItemForm({ ...itemForm, description: e.target.value })} /></label><label className="block text-sm font-medium">Nama pelaksana<Input required maxLength={200} className="mt-2" value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} /></label><label className="block text-sm font-medium">Email pelaksana<Input required type="email" maxLength={254} className="mt-2" value={itemForm.email} onChange={e => setItemForm({ ...itemForm, email: e.target.value })} /></label><label className="block text-sm font-medium">Target tanggal<Input type="date" className="mt-2" value={itemForm.due} onChange={e => setItemForm({ ...itemForm, due: e.target.value })} /></label><Button disabled={saveItem.isPending}>Simpan Poin</Button>
      </form>}
    </DialogContent></Dialog>
    <Dialog open={Boolean(generatedLink)} onOpenChange={open => { if(!open) setGeneratedLink(undefined); }}><DialogContent><DialogHeader><DialogTitle>Link Auditee</DialogTitle></DialogHeader>{generatedLink && <><p className="break-words text-sm">{generatedLink.recipient}</p><Input aria-label="Link auditee" readOnly value={generatedLink.url} /><p className="text-xs text-muted-foreground">Berlaku hingga {formatDate(generatedLink.expiresAt.slice(0,10))}. Link sebelumnya untuk penerima ini dinonaktifkan.</p><Button onClick={async () => { try { await navigator.clipboard.writeText(generatedLink.url); toast.success('Link disalin'); } catch { toast.error('Salin link dari kolom di atas.'); } }}>Salin Link</Button></>}</DialogContent></Dialog>
  </div>;
}