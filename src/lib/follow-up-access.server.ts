import { z } from 'zod';
import { hashAccessToken } from './follow-up';

export async function resolveAccess(token: string) {
  z.string().regex(/^[a-f0-9]{64}$/).parse(token);
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await supabaseAdmin.from('follow_up_access').select('*').eq('token_hash', await hashAccessToken(token)).is('revoked_at', null).gt('expires_at', new Date().toISOString()).single();
  if (error || !data) throw new Error('Link tidak berlaku atau sudah kedaluwarsa. Hubungi auditor untuk link baru.');
  return { access: data, db: supabaseAdmin };
}