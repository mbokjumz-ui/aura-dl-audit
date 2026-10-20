import { it } from 'node:test';
import assert from 'node:assert/strict';
import { hashAccessToken } from './follow-up';

const url = process.env['SUPABASE_URL'];
const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];

it('saves auditee evidence atomically and revokes links only when the matching recipient changes', { skip: !url || !key, timeout: 30000 }, async () => {
  if (!url || !key) return;
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json', Prefer: 'return=representation' };
  if (!key.startsWith('sb_')) headers['Authorization'] = `Bearer ${key}`;
  async function request(path: string, method = 'GET', body?: unknown) {
    const response = await fetch(`${url}/rest/v1/${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result = await response.json();
    assert.equal(response.ok, true, JSON.stringify(result));
    return result;
  }
  const [project] = await request('projects', 'POST', { name: `Regression follow-up ${crypto.randomUUID()}`, status: 'selesai' });
  let followId: string | undefined;
  try {
    const [follow] = await request('follow_up_projects', 'POST', { project_id: project.id, project_name: project.name, responsible_name: 'Responsible test', responsible_email: 'responsible@example.com' });
    followId = follow.id;
    const [item] = await request('follow_up_items', 'POST', { follow_up_project_id: follow.id, title: 'Regression evidence', executor_name: 'Executor test', executor_email: 'executor@example.com' });
    const expires_at = new Date(Date.now() + 86400000).toISOString();
    const [responsible] = await request('follow_up_access', 'POST', { follow_up_project_id: follow.id, recipient_role: 'responsible', token_hash: await hashAccessToken(crypto.randomUUID()), expires_at });
    const [executor] = await request('follow_up_access', 'POST', { follow_up_project_id: follow.id, item_id: item.id, recipient_role: 'executor', token_hash: await hashAccessToken(crypto.randomUUID()), expires_at });
    const submission = await request('rpc/submit_follow_up', 'POST', { _access_id: executor.id, _item_id: item.id, _description: 'Evidence submitted by auditee', _documents: [{ file_name: 'evidence.pdf', file_path: `${item.id}/${crypto.randomUUID()}.pdf`, content_type: 'application/pdf', file_size: 40 }] });
    const [saved] = await request(`follow_up_items?id=eq.${item.id}&select=status,follow_up_submissions(id,description,follow_up_documents(file_name,file_size))`);
    assert.equal(saved.status, 'submitted');
    assert.equal(saved.follow_up_submissions[0].id, submission);
    assert.equal(saved.follow_up_submissions[0].description, 'Evidence submitted by auditee');
    assert.equal(saved.follow_up_submissions[0].follow_up_documents[0].file_size, 40);
    const [unchanged] = await request(`follow_up_access?id=eq.${executor.id}&select=revoked_at`);
    assert.equal(unchanged.revoked_at, null);
    await request(`follow_up_items?id=eq.${item.id}`, 'PATCH', { status: 'revision' });
    await request(`follow_up_items?id=eq.${item.id}`, 'PATCH', { executor_name: 'New executor' });
    const [revokedExecutor] = await request(`follow_up_access?id=eq.${executor.id}&select=revoked_at`);
    assert.equal(typeof revokedExecutor.revoked_at, 'string');
    const [stillResponsible] = await request(`follow_up_access?id=eq.${responsible.id}&select=revoked_at`);
    assert.equal(stillResponsible.revoked_at, null);
    await request(`follow_up_projects?id=eq.${follow.id}`, 'PATCH', { responsible_email: 'changed@example.com' });
    const [revokedResponsible] = await request(`follow_up_access?id=eq.${responsible.id}&select=revoked_at`);
    assert.equal(typeof revokedResponsible.revoked_at, 'string');
  } finally {
    // Submissions reference access records: remove them first, then the test project.
    if (followId) {
      const items = await request(`follow_up_items?follow_up_project_id=eq.${followId}&select=id`);
      for (const item of items) await request(`follow_up_submissions?item_id=eq.${item.id}`, 'DELETE');
      await request(`follow_up_projects?id=eq.${followId}`, 'DELETE');
    }
    await request(`projects?id=eq.${project.id}`, 'DELETE');
  }
});