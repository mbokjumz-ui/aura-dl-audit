import { createFileRoute } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ClipboardCheck, Download, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { readAuditeeFollowUp, submitAuditeeFollowUp, downloadAuditeeEvidence } from '@/lib/follow-up.functions';
import { FOLLOW_UP_STATUS, canSubmit, type FollowUpStatus } from '@/lib/follow-up';
import { formatDate } from '@/lib/audit';

export const Route = createFileRoute('/auditee')({
  head: () => ({ meta: [
    { title: 'Tindak Lanjut Auditee — AURA' }, { name: 'description', content: 'Pembaruan dan bukti tindak lanjut audit oleh auditee di AURA.' },
    { property: 'og:title', content: 'Tindak Lanjut Auditee — AURA' }, { property: 'og:description', content: 'Pembaruan tindak lanjut audit melalui akses privat.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex, nofollow' }, { name: 'referrer', content: 'no-referrer' },
  ] }), component: AuditeePage,
});

function AuditeePage() {
  const [token, setToken] = useState<string>();
  useEffect(() => { setToken(new URLSearchParams(window.location.hash.slice(1)).get('token') ?? ''); }, []);
  const read = useServerFn(readAuditeeFollowUp);
  const submit = useServerFn(submitAuditeeFollowUp);
  const download = useServerFn(downloadAuditeeEvidence);
  const query = useQuery({ queryKey: ['auditee-follow-up', token], queryFn: () => read({ data: { token: token ?? '' } }), enabled: Boolean(token), retry: false });
  const send = useMutation({ mutationFn: (form: FormData) => submit({ data: form }), onSuccess: () => { query.refetch(); toast.success('Bukti dikirim untuk ditinjau auditor'); }, onError: e => toast.error(e.message) });
  async function openEvidence(id: string) { try { const result = await download({ data: { token: token ?? '', documentId: id } }); window.open(result.url, '_blank', 'noopener,noreferrer'); } catch (e) { toast.error(e instanceof Error ? e.message : 'Bukti tidak dapat dibuka'); } }
  return <main className="mx-auto min-h-screen max-w-3xl px-4 py-8 md:py-12">
    <header className="mb-8 flex items-center gap-3 border-b border-border pb-5"><ClipboardCheck className="h-8 w-8 text-primary" /><div><p className="font-display text-3xl">AURA</p><p className="text-xs text-muted-foreground">Audit Updates, Review &amp; Action</p></div></header>
    <h1 className="mb-6 font-display text-3xl">Tindak Lanjut Audit</h1>
    {token === undefined || (token && query.isPending) ? <p>Memuat tugas…</p> : !token ? <p role="alert" className="text-destructive">Link tugas tidak lengkap. Hubungi auditor untuk link baru.</p> : query.error ? <p role="alert" className="text-destructive">{query.error.message}</p> : query.data && <>
      <section className="mb-7 border-b border-border pb-5"><h2 className="break-words text-xl font-semibold">{query.data.project.project_name}</h2><p className="mt-2 text-sm text-muted-foreground">Penanggung jawab: {query.data.project.responsible_name}</p><p className="mt-1 text-xs text-muted-foreground">Akses {query.data.role === 'responsible' ? 'penanggung jawab' : 'pelaksana'} · Berlaku hingga {formatDate(query.data.expiresAt.slice(0, 10))}</p></section>
      {query.data.items.map(item => <article key={item.id} className="mb-8 border-b border-border pb-8">
        <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="min-w-0 break-words text-lg font-semibold">{item.title}</h2><span className="text-sm font-medium text-primary">{FOLLOW_UP_STATUS[item.status as FollowUpStatus]}</span></div>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm">{item.description}</p><p className="mt-3 text-sm text-muted-foreground">Pelaksana: {item.executor_name} · Target: {formatDate(item.due_date)}</p>
        {item.review_note && <div className="mt-4 border-l-2 border-primary bg-secondary p-3 text-sm"><p className="mb-1 font-semibold">Catatan auditor</p><p className="whitespace-pre-wrap break-words">{item.review_note}</p></div>}
        {[...item.follow_up_submissions].sort((a,b) => b.created_at.localeCompare(a.created_at)).map(s => <div key={s.id} className="mt-5 border-t border-border pt-4"><p className="text-xs text-muted-foreground">{formatDate(s.created_at.slice(0,10))} · {s.author_role === 'responsible' ? 'Penanggung jawab' : 'Pelaksana'}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm">{s.description}</p><div className="mt-2 space-y-1">{s.follow_up_documents.map(d => <Button key={d.id} variant="ghost" className="h-auto max-w-full justify-start text-left" onClick={() => openEvidence(d.id)}><Download className="shrink-0" /><span className="whitespace-normal break-all">{d.file_name}</span></Button>)}</div></div>)}
        {canSubmit(item.status) && <form className="mt-6 space-y-4" onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); form.set('token', token); form.set('itemId', item.id); send.mutate(form); }}>
          <label className="block text-sm font-medium">Keterangan pelaksanaan<Textarea name="description" required maxLength={10000} className="mt-2" /></label>
          <label className="block text-sm font-medium">Bukti pelaksanaan<Input name="files" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" multiple required className="mt-2" /></label>
          <Button disabled={send.isPending}><Send />{send.isPending ? 'Mengirim…' : 'Kirim untuk Ditinjau'}</Button>
        </form>}
      </article>)}
    </>}
  </main>;
}