import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { accessAllows, canReview, canSubmit, eligibleProject, hashAccessToken, validateEvidence } from './follow-up';
describe('Tindak lanjut audit', () => {
  it('hanya Project selesai dapat diberi tindak lanjut', () => { assert.equal(eligibleProject('selesai'), true); assert.equal(eligibleProject('berjalan'), false); });
  it('kiriman auditee belum selesai sebelum auditor menyetujui', () => { assert.equal(canReview('submitted'), true); assert.equal(canReview('pending'), false); assert.equal(canSubmit('approved'), false); assert.equal(canSubmit('submitted'), false); assert.equal(canSubmit('revision'), true); });
  it('penanggung jawab dapat mengakses seluruh poin dalam satu Project saja', () => { const a = { follow_up_project_id: 'a', item_id: null }; assert.equal(accessAllows(a, { id: '1', follow_up_project_id: 'a' }), true); assert.equal(accessAllows(a, { id: '2', follow_up_project_id: 'a' }), true); assert.equal(accessAllows(a, { id: '3', follow_up_project_id: 'b' }), false); });
  it('pelaksana hanya mengakses poin yang ditugaskan', () => { const a = { follow_up_project_id: 'a', item_id: '1' }; assert.equal(accessAllows(a, { id: '1', follow_up_project_id: 'a' }), true); assert.equal(accessAllows(a, { id: '2', follow_up_project_id: 'a' }), false); });
  it('memvalidasi bukti privat', () => { assert.throws(() => validateEvidence({ name: 'x.html', size: 3 })); assert.throws(() => validateEvidence({ name: 'x.pdf', size: 20971521 })); assert.doesNotThrow(() => validateEvidence({ name: 'x.pdf', size: 20971520 })); });
  it('menyimpan sidik token bukan link rahasia', async () => { const h = await hashAccessToken('secret'); assert.equal(h.length, 64); assert.notEqual(h, 'secret'); assert.equal(h, await hashAccessToken('secret')); });
});