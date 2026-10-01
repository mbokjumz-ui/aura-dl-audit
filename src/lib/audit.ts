export const STAGES = [
  { key: "perencanaan", label: "Perencanaan", description: "Program kerja, ruang lingkup, dan penugasan" },
  { key: "persiapan", label: "Persiapan", description: "Pengumpulan data awal dan kertas kerja" },
  { key: "pelaksanaan", label: "Pelaksanaan", description: "Pemeriksaan lapangan dan pengujian" },
  { key: "pelaporan", label: "Pelaporan", description: "Penyusunan dan review laporan hasil audit" },
  { key: "closing", label: "Closing", description: "Finalisasi, distribusi, dan pengarsipan" },
] as const;

export type StageKey = (typeof STAGES)[number]["key"];

export function stageLabel(key: string): string {
  return STAGES.find((s) => s.key === key)?.label ?? key;
}

export interface Auditor {
  id: string;
  name: string;
  email: string | null;
  position: string | null;
  is_active: boolean;
}

export interface Project {
  id: string;
  name: string;
  auditee: string | null;
  description: string | null;
  period_start: string | null;
  period_end: string | null;
  status: string;
}

export interface Stage {
  id: string;
  project_id: string;
  stage_key: string;
  target_date: string | null;
  sort_order: number;
  stage_tasks?: Task[];
}

export interface Task {
  id: string;
  stage_id: string;
  title: string;
  due_date: string | null;
  is_done: boolean;
  done_at: string | null;
  auditor_id: string | null;
}

export interface Assignment {
  id: string;
  project_id: string;
  auditor_id: string;
  role: string | null;
  auditors: Auditor | null;
}

export function stageProgress(stage: Stage): number {
  const tasks = stage.stage_tasks ?? [];
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => t.is_done).length;
  return Math.round((done / tasks.length) * 100);
}

export function projectProgress(stages: Stage[]): number {
  const tasks = stages.flatMap((s) => s.stage_tasks ?? []);
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => t.is_done).length;
  return Math.round((done / tasks.length) * 100);
}

export function currentStage(stages: Stage[]): Stage | null {
  const sorted = [...stages].sort((a, b) => a.sort_order - b.sort_order);
  return sorted.find((s) => stageProgress(s) < 100) ?? sorted[sorted.length - 1] ?? null;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function isOverdue(dueDate: string | null, isDone: boolean): boolean {
  if (!dueDate || isDone) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dueDate + "T00:00:00") < today;
}
