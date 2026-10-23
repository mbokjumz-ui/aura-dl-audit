import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { automaticArchiveHeader, copyMissingProjectDocuments } from './project-archive';

describe('Arsip otomatis lampiran Project selesai', () => {
  it('menyalin semua lampiran Pelaporan dan Closing tanpa mengubah sumber', async () => {
    const documents = [{ id: 'pelaporan-pdf' }, { id: 'closing-foto' }];
    const copied: string[] = [];
    await copyMissingProjectDocuments(documents, new Set(), async d => { copied.push(d.id); });
    assert.deepEqual(copied, ['pelaporan-pdf', 'closing-foto']);
    assert.deepEqual(documents, [{ id: 'pelaporan-pdf' }, { id: 'closing-foto' }]);
  });
  it('tidak menduplikasi lampiran ketika Project dibuka dan diselesaikan kembali', async () => {
    const copied: string[] = [];
    await copyMissingProjectDocuments([{ id: 'lama' }, { id: 'baru' }], new Set(['lama']), async d => { copied.push(d.id); });
    assert.deepEqual(copied, ['baru']);
  });
  it('menggagalkan penyelesaian jika salinan gagal', async () => {
    await assert.rejects(copyMissingProjectDocuments([{ id: 'pdf' }], new Set(), async () => { throw new Error('gagal'); }), /gagal/);
  });
  it('mengarsipkan dengan identitas Project independen pada tahun dan bulan selesai', () => {
    const header = automaticArchiveHeader({ id: 'project-a', name: 'Audit A' }, new Date('2026-10-23T16:34:00Z'));
    assert.equal(header.archive_year, 2026);
    assert.equal(header.archive_month, 10);
    assert.equal(header.project_key, 'project-a');
    assert.equal(header.project_name, 'Audit A');
    assert.equal(header.source_project_id, 'project-a');
  });
});