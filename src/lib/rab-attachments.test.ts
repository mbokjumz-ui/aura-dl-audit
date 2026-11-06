import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { mergeRabAttachments, validateRabAttachment } from "./rab-attachments";

test("Lampiran finalisasi menerima PDF dan gambar, bukan Word", () => {
  for (const ext of ["pdf", "png", "jpg", "jpeg", "webp"]) assert.ok(validateRabAttachment({ name: `file.${ext}`, size: 100 }));
  assert.throws(() => validateRabAttachment({ name: "file.docx", size: 100 }));
});
test("Cetak RAB mempertahankan form lalu semua halaman PDF dan gambar", async () => {
  const form = await PDFDocument.create(); form.addPage([100, 200]);
  const attachment = await PDFDocument.create(); attachment.addPage([300, 400]); attachment.addPage([500, 600]);
  const png = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64"));
  const blob = await mergeRabAttachments(await form.save(), [{ name: "file.pdf", type: "application/pdf", bytes: await attachment.save() }, { name: "file.png", type: "image/png", bytes: png }]);
  const result = await PDFDocument.load(await blob.arrayBuffer());
  assert.equal(result.getPageCount(), 4);
  assert.deepEqual(result.getPages().slice(0, 3).map(p => [p.getWidth(), p.getHeight()]), [[100, 200], [300, 400], [500, 600]]);
  assert.equal(result.getPage(3).getWidth(), 595.28);
});
test("Lampiran rusak membatalkan cetak, tidak dilewati diam-diam", async () => {
  const form = await PDFDocument.create(); form.addPage();
  await assert.rejects(mergeRabAttachments(await form.save(), [{ name: "rusak.pdf", type: "application/pdf", bytes: new Uint8Array([1, 2, 3]) }]));
});