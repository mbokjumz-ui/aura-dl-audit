import type { Tables } from "@/integrations/supabase/types";

export type Finding = Tables<"archive_findings">;
export const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const ARCHIVE_BUCKET = "archive-documents";
export const FILE_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg";

export function validateArchiveFile(file: { name: string; size: number }) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !["pdf", "doc", "docx", "xls", "xlsx", "png", "jpg", "jpeg"].includes(extension)) throw new Error("Gunakan PDF, Word, Excel, PNG, atau JPG.");
  if (file.size === 0 || file.size > 20 * 1024 * 1024) throw new Error("Ukuran berkas harus antara 1 byte dan 20 MB.");
  return extension;
}

export function archiveBranch(findings: Finding[], year?: number, month?: number, project?: string) {
  return findings.filter(f => (year === undefined || f.archive_year === year) && (month === undefined || f.archive_month === month) && (project === undefined || f.project_key === project));
}