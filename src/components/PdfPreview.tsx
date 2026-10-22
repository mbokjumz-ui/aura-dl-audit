import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PDFDocumentProxy } from 'pdfjs-dist';

export function PdfPreview({ url }: { url: string }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy>();
  const [pageNumber, setPageNumber] = useState(1);
  const [width, setWidth] = useState(600);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | undefined;
    async function load() {
      try {
        const [PDF, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
        if (cancelled) return;
        PDF.GlobalWorkerOptions.workerSrc = worker.default;
        const task = PDF.getDocument({ url, isEvalSupported: false });
        destroy = () => { void task.destroy(); };
        const document = await task.promise;
        if (!cancelled) setPdf(document);
      } catch { if (!cancelled) { setError('PDF tidak dapat ditampilkan. Berkas asli tetap dapat diunduh.'); setLoading(false); } }
    }
    void load();
    return () => { cancelled = true; destroy?.(); };
  }, [url]);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(entries => { const entry = entries[0]; if (entry) setWidth(Math.max(100, entry.contentRect.width - 32)); });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    let cancelRender: (() => void) | undefined;
    setLoading(true);
    async function render() {
      try {
        const page = await pdf?.getPage(pageNumber);
        const element = canvas.current;
        if (!page || !element || cancelled) return;
        const viewport = page.getViewport({ scale: Math.min(width / page.getViewport({ scale: 1 }).width, 2) });
        const context = element.getContext('2d');
        if (!context) throw new Error('Canvas unavailable');
        element.width = viewport.width; element.height = viewport.height;
        const task = page.render({ canvas: element, canvasContext: context, viewport });
        cancelRender = () => task.cancel();
        await task.promise;
        if (!cancelled) setLoading(false);
      } catch { if (!cancelled) { setError('Halaman PDF tidak dapat ditampilkan.'); setLoading(false); } }
    }
    void render();
    return () => { cancelled = true; cancelRender?.(); };
  }, [pdf, pageNumber, width]);
  return <div className="flex min-h-0 flex-1 flex-col gap-3">
    <div className="flex shrink-0 items-center justify-center gap-3"><Button size="icon" variant="outline" title="Halaman sebelumnya" aria-label="Halaman PDF sebelumnya" disabled={!pdf || pageNumber === 1} onClick={() => setPageNumber(n => n - 1)}><ChevronLeft /></Button><span className="min-w-20 text-center text-sm">{pageNumber} / {pdf?.numPages ?? '…'}</span><Button size="icon" variant="outline" title="Halaman berikutnya" aria-label="Halaman PDF berikutnya" disabled={!pdf || pageNumber >= pdf.numPages} onClick={() => setPageNumber(n => n + 1)}><ChevronRight /></Button></div>
    <div ref={container} className="min-h-0 flex-1 overflow-auto bg-muted p-4">
      {loading && !error && <p role="status" className="mb-3 flex items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" />Memuat PDF…</p>}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : <canvas ref={canvas} aria-label={`Halaman ${pageNumber} PDF`} className="mx-auto max-w-full" />}
    </div>
  </div>;
}