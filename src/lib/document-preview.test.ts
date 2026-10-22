import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewKind } from './document-preview';

test('gambar PNG dan JPG memiliki pratinjau gambar', () => {
  assert.equal(previewKind('bukti.PNG'), 'image');
  assert.equal(previewKind('foto.jpg'), 'image');
  assert.equal(previewKind('foto.jpeg'), 'image');
});
test('PDF memiliki pratinjau PDF', () => assert.equal(previewKind('laporan.pdf'), 'pdf'));
test('Word DOCX dibaca lokal tanpa viewer publik', () => assert.equal(previewKind('audit.docx'), 'word'));
test('Excel XLS dan XLSX memiliki pratinjau lembar kerja', () => {
  assert.equal(previewKind('RAB.xls'), 'excel');
  assert.equal(previewKind('RAB.xlsx'), 'excel');
});
test('Word biner lama tidak disalahartikan sebagai DOCX', () => assert.equal(previewKind('laporan.doc'), 'unsupported'));