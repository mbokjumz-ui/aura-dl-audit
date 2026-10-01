import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, FolderKanban, ListChecks, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  currentStage,
  formatDate,
  isOverdue,
  projectProgress,
  stageLabel,
  type Project,
  type Stage,
} from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dasbor — AuditFlow" },
      { name: "description", content: "Ringkasan progres seluruh project audit internal." },
      { property: "og:title", content: "Dasbor — AuditFlow" },
      { property: "og:description", content: "Ringkasan progres seluruh proyek audit internal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

interface ProjectWithStages extends Project {
  project_stages: Stage[];
}

function Dashboard() {
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects-with-stages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, project_stages(*, stage_tasks(*))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ProjectWithStages[];
    },
  });

  const { data: auditorCount = 0 } = useQuery({
    queryKey: ["auditor-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("auditors")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const allTasks = projects.flatMap((p) => p.project_stages.flatMap((s) => s.stage_tasks ?? []));
  const doneTasks = allTasks.filter((t) => t.is_done).length;
  const overdueTasks = allTasks.filter((t) => isOverdue(t.due_date, t.is_done)).length;

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl md:text-4xl">Dasbor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ringkasan progres seluruh project audit yang sedang berjalan.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {[
          { icon: FolderKanban, label: "Proyek Aktif", value: projects.filter((p) => p.status === "berjalan").length },
          { icon: Users, label: "Auditor Aktif", value: auditorCount },
          { icon: ListChecks, label: "Tugas Selesai", value: `${doneTasks}/${allTasks.length}` },
          { icon: AlertTriangle, label: "Tugas Terlambat", value: overdueTasks, danger: overdueTasks > 0 },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4 md:p-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <s.icon className="h-4 w-4" />
              <span className="text-xs font-medium md:text-sm">{s.label}</span>
            </div>
            <p className={`mt-2 text-2xl font-bold md:text-3xl ${s.danger ? "text-destructive" : ""}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <h2 className="mb-4 mt-10 text-lg font-semibold">Progres Proyek</h2>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Memuat data…</p>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-muted-foreground">Belum ada project. Buat project pertama Anda.</p>
          <Link
            to="/proyek"
            className="mt-4 inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Buat Proyek
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => {
            const progress = projectProgress(p.project_stages);
            const current = currentStage(p.project_stages);
            return (
              <Link
                key={p.id}
                to="/proyek/$projectId"
                params={{ projectId: p.id }}
                className="group rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold leading-snug group-hover:text-primary">{p.name}</h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">{p.auditee}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Tahap: <span className="font-medium text-foreground">{current ? stageLabel(current.stage_key) : "—"}</span>
                    </span>
                    <span className="font-semibold text-foreground">{progress}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {formatDate(p.period_start)} — {formatDate(p.period_end)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
