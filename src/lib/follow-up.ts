export const FOLLOW_UP_BUCKET = 'follow-up-evidence';
export const FOLLOW_UP_STATUS = { pending: 'Belum dikirim', submitted: 'Menunggu tinjauan', revision: 'Perlu perbaikan', approved: 'Selesai' } as const;
export type FollowUpStatus = keyof typeof FOLLOW_UP_STATUS;
export function canSubmit(status: string) { return status === 'pending' || status === 'revision'; }
export function canReview(status: string) { return status === 'submitted'; }
export function eligibleProject(status: string) { return status === 'selesai'; }
export function accessAllows(access: { follow_up_project_id: string; item_id: string | null }, item: { id: string; follow_up_project_id: string }) {
  return access.follow_up_project_id === item.follow_up_project_id && (access.item_id === null || access.item_id === item.id);
}
export function validateEvidence(file: { name: string; size: number }) {
  if (!/\.(pdf|doc|docx|xls|xlsx|png|jpg|jpeg)$/i.test(file.name)) throw new Error('Bukti harus PDF, Word, Excel, PNG, atau JPG.');
  if (file.size <= 0 || file.size > 20 * 1024 * 1024) throw new Error('Ukuran setiap bukti maksimal 20 MB dan tidak boleh kosong.');
}
export async function hashAccessToken(token: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))).map(b => b.toString(16).padStart(2, '0')).join('');
}