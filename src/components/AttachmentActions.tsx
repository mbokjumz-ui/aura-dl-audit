import { useEffect, useState } from 'react';
import { Download, Eye, LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { previewKind } from '@/lib/document-preview';
import { PdfPreview } from '@/components/PdfPreview';

type Sheet = { name: string; rows: string[][] };
type Preview = { url?: string; html?: string; sheets?: Sheet[] };

export function AttachmentActions({ name, getUrl }: { name: string; getUrl: (download: boolean) => Promise<string> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    try {
      const url = await getUrl(true);
      const link = document.createElement('a');
      link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.click();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Dokumen tidak dapat diunduh'); }
    finally { setBusy(false); }
  }
  return <>
    <Button variant="ghost" size="icon" title="Lihat lampiran" aria-label={`Lihat ${name}`} onClick={() => setOpen(true)}><Eye /></Button>
    <Button variant="ghost" size="icon" title="Unduh lampiran" aria-label={`Unduh ${name}`} disabled={busy} onClick={download}><Download /></Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="flex h-[90dvh] w-[calc(100%-2rem)] max-w-6xl flex-col gap-3 overflow-hidden p-4 sm:p-6">
      <DialogHeader className="min-w-0 pr-7"><DialogTitle className="break-all text-left">{name}</DialogTitle><DialogDescription className="sr-only">Pratinjau lampiran privat</DialogDescription></DialogHeader>
      {open && <DocumentPreview name={name} getUrl={getUrl} />}
    </DialogContent></Dialog>
  </>;
}

function DocumentPreview({ name, getUrl }: { name: string; getUrl: (download: boolean) => Promise<string> }) {
  const [preview, setPreview] = useState<Preview>();
  const [error, setError] = useState('');
  const [sheetIndex, setSheetIndex] = useState(0);
  const kind = previewKind(name);
  useEffect(() => {
    if (kind === 'unsupported') return;
    let cancelled = false;
    let objectUrl: string | undefined;
    const controller = new AbortController();
    async function load() {
      try {
        const url = await getUrl(false);
        if (cancelled) return;
        const response = await fetch(url, { signal: controller.signal, referrerPolicy: 'no-referrer' });
        if (!response.ok) throw new Error('Lampiran tidak dapat dimuat. Tutup lalu buka kembali.');
        const buffer = await response.arrayBuffer();
        if (cancelled) return;
        let result: Preview;
        if (kind === 'image' || kind === 'pdf') {
          const ext = name.split('.').pop()?.toLowerCase();
          objectUrl = URL.createObjectURL(new Blob([buffer], { type: kind === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : 'image/jpeg' }));
          result = { url: objectUrl };
        } else if (kind === 'word') {
          const [mammoth, { default: DOMPurify }] = await Promise.all([import('mammoth'), import('dompurify')]);
          const converted = await mammoth.convertToHtml({ arrayBuffer: buffer }, { externalFileAccess: false });
          // No scripts, embedded objects, remote resources, or navigation from uploaded files.
          const html = DOMPurify.sanitize(converted.value, { FORBID_TAGS: ['style', 'iframe', 'object', 'embed', 'form', 'input'], FORBID_ATTR: ['style', 'srcset', 'href'], ALLOW_DATA_ATTR: false });
          const parsed = new DOMParser().parseFromString(html, 'text/html');
          parsed.querySelectorAll('img').forEach(img => { if (!/^data:image\/(png|jpeg|gif|webp);base64,/i.test(img.getAttribute('src') ?? '')) img.remove(); });
          result = { html: parsed.body.innerHTML };
        } else {
          const XLSX = await import('xlsx');
          const workbook = XLSX.read(buffer, { type: 'array', cellFormula: false, cellHTML: false });
          result = { sheets: workbook.SheetNames.map(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            return { name: sheetName, rows: sheet ? XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '', blankrows: false }) : [] };
          }) };
        }
        if (!cancelled) setPreview(result);
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Lampiran tidak dapat ditampilkan.'); }
    }
    void load();
    return () => { cancelled = true; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
    // Each opening mounts a fresh preview; signing callback identities need not reload it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, kind]);
  if (kind === 'unsupported') return <p role="alert" className="py-6 text-sm text-muted-foreground">Format Word lama (.doc) belum dapat ditampilkan langsung. Gunakan berkas .docx atau PDF untuk pratinjau; berkas asli tetap dapat diunduh.</p>;
  if (error) return <p role="alert" className="py-6 text-sm text-destructive">{error}</p>;
  if (!preview) return <div role="status" className="flex flex-1 items-center justify-center gap-2 text-muted-foreground"><LoaderCircle className="h-5 w-5 animate-spin motion-reduce:animate-none" />Memuat lampiran…</div>;
  const sheet = preview.sheets?.[sheetIndex];
  return <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
    {kind === 'image' && <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-muted"><img src={preview.url} alt={name} className="max-h-full max-w-full object-contain" /></div>}
    {kind === 'pdf' && preview.url && <PdfPreview url={preview.url} />}
    {kind === 'word' && <div className="document-preview min-h-0 flex-1 overflow-auto bg-card p-4 text-card-foreground sm:p-8" dangerouslySetInnerHTML={{ __html: preview.html ?? '' }} />}
    {kind === 'excel' && <>
      <div className="mb-3 flex shrink-0 gap-2 overflow-x-auto" role="tablist" aria-label="Lembar Excel">{preview.sheets?.map((s, index) => <Button key={s.name} size="sm" variant={index === sheetIndex ? 'default' : 'outline'} role="tab" aria-selected={index === sheetIndex} onClick={() => setSheetIndex(index)}>{s.name}</Button>)}</div>
      <div role="tabpanel" aria-label={sheet?.name} className="min-h-0 flex-1 overflow-auto border border-border bg-card">{sheet?.rows.length ? <table className="w-full border-collapse text-sm"><tbody>{sheet.rows.map((row, index) => <tr key={index} className="even:bg-muted/40"><th scope="row" className="sticky left-0 border border-border bg-muted px-3 py-2 text-muted-foreground">{index + 1}</th>{row.map((cell, col) => <td key={col} className="min-w-28 max-w-96 whitespace-pre-wrap break-words border border-border px-3 py-2">{cell}</td>)}</tr>)}</tbody></table> : <p className="p-4 text-sm text-muted-foreground">Lembar kosong.</p>}</div>
    </>}
  </div>;
}