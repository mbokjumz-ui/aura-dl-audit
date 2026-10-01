import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { STAGES, formatDate, projectProgress, type Project, type Stage } from "@/lib/audit";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/proyek/")({
  head: () => ({
    meta: [
      { title: "Project Audit — AURA" },
      { name: "description", content: "Daftar project audit dan pembuatannya." },
      { property: "og:title", content: "Project Audit — AURA" },
      { property: "og:description", content: "Daftar project audit dan progresnya di AURA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProyekPage,
});

interface ProjectWithStages extends Project {
  project_stages: Stage[];
}

function ProyekPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", auditee: "", description: "", period_start: "", period_end: "" });

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

  const createProject = useMutation({
    mutationFn: async () => {
      const { data: project, error } = await supabase
        .from("projects")
        .insert({
          name: form.name,
          auditee: form.auditee || null,
          description: form.description || null,
          period_start: form.period_start || null,
          period_end: form.period_end || null,
        })
        .select()
        .single();
      if (error) throw error;
      const { error: stageError } = await supabase.from("project_stages").insert(
        STAGES.map((s, i) => ({ project_id: project.id, stage_key: s.key, sort_order: i + 1 })),
      );
      if (stageError) throw stageError;
    },
    onSuccess: () => {
      toast.success("Project dibuat dengan 5 tahap audit");
      setForm({ name: "", auditee: "", description: "", period_start: "", period_end: "" });
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["projects-with-stages"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const inputCls =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl">Project Audit</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Daftar seluruh project audit dan progresnya.
          </p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="shrink-0"
        >
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Project Baru</span>
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createProject.mutate();
          }}
          className="mb-6 space-y-3 rounded-2xl border border-border bg-card p-5"
        >
          <input
            required
            placeholder="Nama project, mis. Audit Pengelolaan Kas Cabang Surabaya"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputCls}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              placeholder="Unit / Auditee"
              value={form.auditee}
              onChange={(e) => setForm({ ...form, auditee: e.target.value })}
              className={inputCls}
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Mulai</label>
                <input
                  type="date"
                  value={form.period_start}
                  onChange={(e) => setForm({ ...form, period_start: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Selesai</label>
                <input
                  type="date"
                  value={form.period_end}
                  onChange={(e) => setForm({ ...form, period_end: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>
          </div>
          <textarea
            placeholder="Deskripsi singkat (opsional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={inputCls}
            rows={2}
          />
          <Button
            disabled={createProject.isPending}
          >
            Simpan Project
          </Button>
        </form>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Memuat data…</p>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
          Belum ada project.
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => {
            const progress = projectProgress(p.project_stages);
            return (
              <Link
                key={p.id}
                to="/proyek/$projectId"
                params={{ projectId: p.id }}
                className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-md md:p-5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold leading-snug group-hover:text-primary">{p.name}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        p.status === "selesai"
                          ? "bg-primary/10 text-primary"
                          : "bg-chart-2/15 text-chart-2"
                      }`}
                    >
                      {p.status === "selesai" ? "Selesai" : "Berjalan"}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {p.auditee} · {formatDate(p.period_start)} — {formatDate(p.period_end)}
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-xs font-semibold">{progress}%</span>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
