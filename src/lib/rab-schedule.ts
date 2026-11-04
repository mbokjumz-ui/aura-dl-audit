import { z } from "zod";

export function workEndDate(start: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isSafeInteger(days) || days < 1) return "";
  const date = new Date(`${start}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== start) return "";
  date.setUTCDate(date.getUTCDate() + days - 1);
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() > 9999) return "";
  return date.toISOString().slice(0, 10);
}

export const rabScheduleSchema = z.object({
  workDays: z.number().int().positive(),
  workStartDate: z.string(),
}).refine(value => !!workEndDate(value.workStartDate, value.workDays), "Tanggal mulai dan jumlah hari tidak valid.");

export function scheduleDateLabel(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export function workScheduleLabel(rab: { work_duration?: string; work_duration_days?: number | null; work_start_date?: string | null; work_end_date?: string | null }) {
  if (rab.work_duration_days && rab.work_start_date && rab.work_end_date) {
    return `${rab.work_duration_days} hari kalender (${scheduleDateLabel(rab.work_start_date)} – ${scheduleDateLabel(rab.work_end_date)})`;
  }
  return rab.work_duration || "—";
}