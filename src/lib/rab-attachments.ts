import { PDFDocument } from "pdf-lib";

export const RAB_ATTACHMENT_ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp";
export function validateRabAttachment(file: { name: string; size: number }) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
  const type = ext ? types[ext] : undefined;
  if (!ext || !type) throw new Error("Gunakan PDF, PNG, JPG, atau WebP.");
  if (file.size <= 0 || file.size > 20 * 1024 * 1024) throw new Error("Ukuran berkas harus antara 1 byte dan 20 MB.");
  return { ext, type };
}
export type PdfAttachment = { name: string; type: string; bytes: Uint8Array };
export async function mergeRabAttachments(form: Uint8Array, attachments: PdfAttachment[]) {
  const output = await PDFDocument.load(form);
  for (const attachment of attachments) {
    try {
      if (attachment.type === "application/pdf") {
        const source = await PDFDocument.load(attachment.bytes);
        if (!source.getPageCount()) throw new Error("PDF kosong");
        for (const page of await output.copyPages(source, source.getPageIndices())) output.addPage(page);
      } else {
        let bytes = attachment.bytes;
        if (attachment.type === "image/webp") {
          const image = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: attachment.type }));
          const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
          const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Gambar gagal dibaca");
          ctx.drawImage(image, 0, 0); image.close();
          const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Gambar gagal dikonversi")), "image/png"));
          bytes = new Uint8Array(await blob.arrayBuffer());
        }
        const image = attachment.type === "image/jpeg" ? await output.embedJpg(bytes) : await output.embedPng(bytes);
        const page = output.addPage([595.28, 841.89]);
        const scale = Math.min(563.28 / image.width, 809.89 / image.height);
        const width = image.width * scale, height = image.height * scale;
        page.drawImage(image, { x: (595.28 - width) / 2, y: (841.89 - height) / 2, width, height });
      }
    } catch { throw new Error(`Lampiran ${attachment.name} tidak dapat digabung. Gunakan PDF tanpa sandi atau gambar yang valid.`); }
  }
  return new Blob([new Uint8Array(await output.save())], { type: "application/pdf" });
}