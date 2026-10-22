export function previewKind(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg'].includes(ext ?? '')) return 'image';
  if (ext === 'docx') return 'word';
  if (ext === 'xls' || ext === 'xlsx') return 'excel';
  return 'unsupported';
}

export async function privateDocumentUrl(bucket: string, path: string, name: string, download = false) {
  const { supabase } = await import('@/integrations/supabase/client');
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60, download ? { download: name } : undefined);
  if (error) throw new Error('Dokumen tidak dapat dibuka. Silakan coba lagi.');
  return data.signedUrl;
}