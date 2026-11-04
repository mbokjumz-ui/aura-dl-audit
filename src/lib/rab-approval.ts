import { validateArchiveFile } from "./archive";

export function validateRabApprovalPdf(file: { name: string; size: number }) {
  if (validateArchiveFile(file) !== "pdf") throw new Error("Dokumen RAB yang ditandatangani harus berupa PDF.");
  return "pdf";
}