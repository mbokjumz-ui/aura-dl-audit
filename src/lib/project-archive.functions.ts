import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { automaticArchiveHeader, copyMissingProjectDocuments } from './project-archive';

export const completeProjectWithArchive = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ projectId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const role = await db.rpc('has_role', { _user_id: context.userId, _role: 'internal_audit' });
    if (role.error || !role.data) throw new Error('Hanya Internal Audit dapat menyelesaikan Project audit.');
    const project = await db.from('projects').select('id,name').eq('id', data.projectId).single();
    if (project.error) throw new Error('Project tidak dapat diakses.');
    const docs = await db.from('stage_documents').select('*,project_stages!inner(project_id)')
      .eq('project_stages.project_id', data.projectId);
    if (docs.error) throw new Error('Lampiran Project tidak dapat dimuat.');
    let findingId: string | null = null;
    if (docs.data.length) {
      const existing = await db.from('archive_findings').select('id').eq('source_project_id', data.projectId).maybeSingle();
      if (existing.error) throw new Error('Arsip Project tidak dapat dimuat.');
      findingId = existing.data?.id ?? null;
      if (!findingId) {
        const created = await db.from('archive_findings').insert(automaticArchiveHeader(project.data)).select('id').single();
        if (created.error) {
          // A simultaneous completion may have created the same archive first.
          const retry = await db.from('archive_findings').select('id').eq('source_project_id', data.projectId).single();
          if (retry.error) throw new Error('Arsip Project gagal dibuat. Silakan coba lagi.');
          findingId = retry.data.id;
        } else findingId = created.data.id;
      }
      const ownerId = findingId;
      const archived = await db.from('archive_documents').select('source_document_id').eq('finding_id', ownerId);
      if (archived.error) throw new Error('Lampiran arsip tidak dapat dimuat.');
      const ids = new Set(archived.data.flatMap(d => d.source_document_id ? [d.source_document_id] : []));
      await copyMissingProjectDocuments(docs.data, ids, async document => {
        const extension = document.file_path.split('.').pop();
        const path = `${ownerId}/${document.id}.${extension ?? 'bin'}`;
        const copied = await db.storage.from('audit-documents').copy(document.file_path, path, { destinationBucket: 'archive-documents' });
        if (copied.error) {
          // Retry safely after a previous copy succeeded but its metadata failed.
          const files = await db.storage.from('archive-documents').list(ownerId, { search: `${document.id}.` });
          if (files.error || !files.data.some(f => `${ownerId}/${f.name}` === path && Number(f.metadata?.size) === document.file_size)) {
            throw new Error(`Lampiran ${document.file_name} gagal disalin. Project belum ditandai selesai; silakan coba lagi.`);
          }
        }
        const saved = await db.from('archive_documents').upsert({
          finding_id: ownerId, source_document_id: document.id, file_path: path,
          file_name: document.file_name, content_type: document.content_type, file_size: document.file_size,
        }, { onConflict: 'file_path', ignoreDuplicates: true });
        if (saved.error) throw new Error('Lampiran sudah disalin tetapi belum tercatat di Arsip. Silakan coba lagi.');
      });
    }
    const finished = await db.rpc('finish_archived_project', { _project_id: data.projectId, _finding_id: findingId ?? data.projectId });
    if (finished.error) throw new Error('Project belum dapat diselesaikan. Pastikan seluruh lampiran tersalin, lalu coba lagi.');
    return { archivedCount: docs.data.length };
  });