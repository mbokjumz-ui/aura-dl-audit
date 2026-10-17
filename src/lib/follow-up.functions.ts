import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { accessAllows, canReview, canSubmit, FOLLOW_UP_BUCKET, hashAccessToken, validateEvidence } from './follow-up';

const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
const idSchema = z.string().uuid();

export const createFollowUpLink = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ projectId: idSchema, itemId: idSchema.nullable(), role: z.enum(['responsible', 'executor']) }))
  .handler(async ({ data, context }) => {
    const project = await context.supabase.from('follow_up_projects').select('id').eq('id', data.projectId).single();
    if (project.error) throw new Error('Project tidak dapat diakses.');
    if ((data.role === 'responsible') !== (data.itemId === null)) throw new Error('Penerima link tidak sesuai.');
    if (data.itemId) {
      const item = await context.supabase.from('follow_up_items').select('id').eq('id', data.itemId).eq('follow_up_project_id', data.projectId).single();
      if (item.error) throw new Error('Poin tidak dapat diakses.');
    }
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('');
    const expiresAt = new Date(Date.now() + 90 * 86400000).toISOString();
    let old = supabaseAdmin.from('follow_up_access').update({ revoked_at: new Date().toISOString() }).eq('follow_up_project_id', data.projectId).eq('recipient_role', data.role).is('revoked_at', null);
    old = data.itemId ? old.eq('item_id', data.itemId) : old.is('item_id', null);
    const revoked = await old; if (revoked.error) throw new Error('Link lama gagal dinonaktifkan.');
    const result = await supabaseAdmin.from('follow_up_access').insert({ follow_up_project_id: data.projectId, item_id: data.itemId, recipient_role: data.role, token_hash: await hashAccessToken(token), expires_at: expiresAt });
    if (result.error) throw new Error('Link gagal dibuat.');
    return { token, expiresAt };
  });

// The token is a bearer credential: only its SHA-256 fingerprint is persisted.
async function resolveAccess(token: string) {
  tokenSchema.parse(token);
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await supabaseAdmin.from('follow_up_access').select('*').eq('token_hash', await hashAccessToken(token)).is('revoked_at', null).gt('expires_at', new Date().toISOString()).single();
  if (error || !data) throw new Error('Link tidak berlaku atau sudah kedaluwarsa. Hubungi auditor untuk link baru.');
  return { access: data, db: supabaseAdmin };
}

export const readAuditeeFollowUp = createServerFn({ method: 'POST' }).inputValidator(z.object({ token: tokenSchema }))
  .handler(async ({ data }) => {
    const { access, db } = await resolveAccess(data.token);
    const project = await db.from('follow_up_projects').select('id, project_name, responsible_name').eq('id', access.follow_up_project_id).single();
    let query = db.from('follow_up_items').select('id, follow_up_project_id, title, description, executor_name, due_date, status, review_note, follow_up_submissions(id, description, author_role, created_at, follow_up_documents(id, file_name))').eq('follow_up_project_id', access.follow_up_project_id).order('created_at');
    if (access.item_id) query = query.eq('id', access.item_id);
    const items = await query;
    if (project.error || items.error) throw new Error('Tindak lanjut tidak dapat dimuat.');
    return { project: project.data, items: items.data, role: access.recipient_role, expiresAt: access.expires_at };
  });

export const submitAuditeeFollowUp = createServerFn({ method: 'POST' })
  .inputValidator((input: FormData) => { if (!(input instanceof FormData)) throw new Error('Kiriman tidak valid.'); return input; })
  .handler(async ({ data }) => {
    const token = tokenSchema.parse(data.get('token'));
    const itemId = idSchema.parse(data.get('itemId'));
    const description = z.string().trim().min(1).max(10000).parse(data.get('description'));
    const { access, db } = await resolveAccess(token);
    const item = await db.from('follow_up_items').select('id, follow_up_project_id, status').eq('id', itemId).single();
    if (!item.data || !accessAllows(access, item.data) || !canSubmit(item.data.status)) throw new Error('Poin ini tidak dapat diperbarui.');
    const files = data.getAll('files');
    if (files.length === 0 || files.length > 5) throw new Error('Lampirkan 1–5 bukti.');
    const validFiles: File[] = [];
    for (const file of files) { if (!(file instanceof File)) throw new Error('Bukti tidak valid.'); validateEvidence(file); validFiles.push(file); }
    if (validFiles.reduce((sum, f) => sum + f.size, 0) > 25 * 1024 * 1024) throw new Error('Total bukti maksimal 25 MB per kiriman.');
    const docs: { file_name: string; file_path: string; content_type: string; file_size: number }[] = [];
    try {
      for (const file of validFiles) {
        const path = `${itemId}/${crypto.randomUUID()}.${file.name.split('.').pop()?.toLowerCase()}`;
        const contentType = file.type || 'application/octet-stream';
        const uploaded = await db.storage.from(FOLLOW_UP_BUCKET).upload(path, file, { contentType });
        if (uploaded.error) throw new Error('Bukti gagal diunggah.');
        docs.push({ file_name: file.name, file_path: path, content_type: contentType, file_size: file.size });
      }
      const result = await db.rpc('submit_follow_up', { _access_id: access.id, _item_id: itemId, _description: description, _documents: docs });
      if (result.error) throw new Error('Kiriman gagal disimpan atau poin sudah dikirim. Silakan muat ulang.');
      return { submitted: true };
    } catch (error) { if (docs.length) await db.storage.from(FOLLOW_UP_BUCKET).remove(docs.map(d => d.file_path)); throw error; }
  });

export const downloadAuditeeEvidence = createServerFn({ method: 'POST' }).inputValidator(z.object({ token: tokenSchema, documentId: idSchema }))
  .handler(async ({ data }) => {
    const { access, db } = await resolveAccess(data.token);
    const doc = await db.from('follow_up_documents').select('file_path, file_name, follow_up_submissions!inner(follow_up_items!inner(id, follow_up_project_id))').eq('id', data.documentId).single();
    const item = doc.data?.follow_up_submissions.follow_up_items;
    if (!doc.data || !item || !accessAllows(access, item)) throw new Error('Bukti tidak dapat diakses.');
    const url = await db.storage.from(FOLLOW_UP_BUCKET).createSignedUrl(doc.data.file_path, 60, { download: doc.data.file_name });
    if (url.error) throw new Error('Bukti tidak dapat dibuka.');
    return { url: url.data.signedUrl };
  });

export const reviewFollowUp = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ itemId: idSchema, decision: z.enum(['approved','revision']), note: z.string().trim().max(10000) }))
  .handler(async ({ data, context }) => {
    if (data.decision === 'revision' && !data.note) throw new Error('Isi catatan perbaikan.');
    const item = await context.supabase.from('follow_up_items').select('status').eq('id', data.itemId).single();
    if (!item.data || !canReview(item.data.status)) throw new Error('Hanya kiriman menunggu tinjauan yang dapat diperiksa.');
    const result = await context.supabase.from('follow_up_items').update({ status: data.decision, review_note: data.note, reviewed_by: context.userId, reviewed_at: new Date().toISOString() }).eq('id', data.itemId).eq('status', 'submitted').select('id').single();
    if (result.error) throw new Error('Tinjauan gagal disimpan. Muat ulang poin ini.');
    return { reviewed: true };
  });