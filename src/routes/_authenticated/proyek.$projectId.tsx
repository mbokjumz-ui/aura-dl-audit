import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Plus,
  FileText,
  Download,
  Upload,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  STAGES,
  formatDate,
  isOverdue,
  projectProgress,
  stageProgress,
  type Assignment,
  type Auditor,
  type Project,
  type Stage,
} from "@/lib/audit";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type StageDocument = {
  id: string;
  stage_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  created_at: string;
};

const allowedExtensions = ["pdf", "doc", "docx", "xls", "xlsx", "png", "jpg", "jpeg"];

export const Route = createFileRoute("/_authenticated/proyek/$projectId")({
  head: () => ({
    meta: [
      { title: "Detail Proyek — AuditFlow" },
      { name: "description", content: "Detail tahapan, ceklist tugas, dan penugasan project audit." },
      { property: "og:title", content: "Detail Proyek — AuditFlow" },
      { property: "og:description", content: "Detail tahapan, ceklist tugas, dan penugasan proyek audit di AuditFlow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProyekDetail,
});

function ProyekDetail() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newTaskFor, setNewTaskFor] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState({ title: "", due_date: "", auditor_id: "" });
  const [selectedAuditors, setSelectedAuditors] = useState<string[]>([]);
  const [assignRole, setAssignRole] = useState("anggota");

  const { data: project, isLoading, error: projectError } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, project_stages(*, stage_tasks(*))")
        .eq("id", projectId)
        .single();
      if (error) throw error;
      const sorted = {
        ...data,
        project_stages: (data.project_stages as Stage[])
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((s) => ({
            ...s,
            stage_tasks: (s.stage_tasks ?? []).sort((a, b) => a.title.localeCompare(b.title)),
          })),
      };
      return sorted as Project & { project_stages: Stage[] };
    },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["assignments", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_assignments")
        .select("*, auditors(*)")
        .eq("project_id", projectId);
      if (error) throw error;
      return data as Assignment[];
    },
  });

  const { data: documents = [], error: documentsError, isLoading: documentsLoading } = useQuery({
    queryKey: ["stage-documents", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("stage_documents")
        .select("id, stage_id, file_name, file_path, file_size, created_at, project_stages!inner(project_id)")
        .eq("project_stages.project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as StageDocument[];
    },
  });

  const { data: auditors = [] } = useQuery({
    queryKey: ["auditors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("auditors").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data as Auditor[];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    queryClient.invalidateQueries({ queryKey: ["assignments", projectId] });
    queryClient.invalidateQueries({ queryKey: ["projects-with-stages"] });
  };

  const toggleTask = useMutation({
    mutationFn: async ({ id, isDone }: { id: string; isDone: boolean }) => {
      const { error } = await supabase
        .from("stage_tasks")
        .update({ is_done: !isDone, done_at: !isDone ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  });

  const addTask = useMutation({
    mutationFn: async (stageId: string) => {
      const { error } = await supabase.from("stage_tasks").insert({
        stage_id: stageId,
        title: taskForm.title,
        due_date: taskForm.due_date || null,
        auditor_id: taskForm.auditor_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tugas ditambahkan");
      setTaskForm({ title: "", due_date: "", auditor_id: "" });
      setNewTaskFor(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const removeTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stage_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  });

  const setTargetDate = useMutation({
    mutationFn: async ({ stageId, date }: { stageId: string; date: string }) => {
      const { error } = await supabase
        .from("project_stages")
        .update({ target_date: date || null })
        .eq("id", stageId);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  });

  const addAssignment = useMutation({
    mutationFn: async () => {
      const availableIds = new Set(auditors.map((a) => a.id));
      const existingIds = new Set(assignments.map((a) => a.auditor_id));
      const ids = [...new Set(selectedAuditors)].filter((id) => availableIds.has(id) && !existingIds.has(id));
      if (ids.length === 0) throw new Error("Pilih auditor yang belum ditugaskan.");
      const { error } = await supabase.from("project_assignments").insert(
        ids.map((auditor_id) => ({ project_id: projectId, auditor_id, role: assignRole })),
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Penugasan ditambahkan");
      setSelectedAuditors([]);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const removeAssignment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_assignments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  });

  const toggleStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("projects").update({ status }).eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  });

  const uploadDocument = useMutation({
    mutationFn: async ({ stageId, file }: { stageId: string; file: File }) => {
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (!extension || !allowedExtensions.includes(extension)) throw new Error("Gunakan PDF, Word, Excel, PNG, atau JPG.");
      if (file.size === 0 || file.size > 20 * 1024 * 1024) throw new Error("Ukuran berkas harus antara 1 byte dan 20 MB.");
      const filePath = `${projectId}/${stageId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("audit-documents").upload(filePath, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { error } = await supabase.from("stage_documents").insert({
        stage_id: stageId, file_name: file.name, file_path: filePath,
        file_size: file.size, content_type: file.type || "application/octet-stream",
      });
      if (error) {
        await supabase.storage.from("audit-documents").remove([filePath]);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Dokumen diunggah");
      queryClient.invalidateQueries({ queryKey: ["stage-documents", projectId] });
    },
    onError: (e) => toast.error(e.message),
  });

  const removeDocument = useMutation({
    mutationFn: async (document: StageDocument) => {
      const { error } = await supabase.from("stage_documents").delete().eq("id", document.id);
      if (error) throw error;
      const { error: storageError } = await supabase.storage.from("audit-documents").remove([document.file_path]);
      if (storageError) throw new Error("Dokumen dihapus dari daftar, tetapi berkasnya tidak dapat dibersihkan.");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["stage-documents", projectId] }),
    onError: (e) => toast.error(e.message),
    onSuccess: () => toast.success("Dokumen dihapus"),
  });

  const deleteProject = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("projects").delete().eq("id", projectId);
      if (error) throw error;
      if (documents.length) {
        const { error: storageError } = await supabase.storage.from("audit-documents").remove(documents.map((d) => d.file_path));
        if (storageError) toast.warning("Proyek dihapus, tetapi sebagian berkas tidak dapat dibersihkan.");
      }
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects-with-stages"] });
      toast.success("Proyek dihapus");
      navigate({ to: "/proyek" });
    },
    onError: (e) => toast.error(e.message),
  });

  const openDocument = async (document: StageDocument) => {
    const { data, error } = await supabase.storage.from("audit-documents").createSignedUrl(document.file_path, 60, { download: document.file_name });
    if (error) { toast.error(error.message); return; }
    window.location.assign(data.signedUrl);
  };

  const inputCls =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  if (projectError) {
    return <div role="alert" className="text-sm text-destructive">Proyek tidak dapat dimuat. Silakan coba lagi atau kembali ke daftar proyek.</div>;
  }

  if (isLoading || !project) {
    return <p className="text-sm text-muted-foreground">Memuat data…</p>;
  }

  const progress = projectProgress(project.project_stages);
  const availableAuditors = auditors.filter((auditor) => !assignments.some((assignment) => assignment.auditor_id === auditor.id));

  return (
    <div>
      <Link
        to="/proyek"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Semua Proyek
      </Link>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl leading-tight md:text-4xl">{project.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {project.auditee} · {formatDate(project.period_start)} — {formatDate(project.period_end)}
          </p>
          {project.description && (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{project.description}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={project.status === "selesai" ? "outline" : "default"}
            disabled={toggleStatus.isPending}
            onClick={() => toggleStatus.mutate(project.status === "selesai" ? "berjalan" : "selesai")}>
            {project.status === "selesai" ? "Buka Kembali" : "Tandai Selesai"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={documentsLoading || !!documentsError || uploadDocument.isPending || removeDocument.isPending} className="text-destructive hover:text-destructive" aria-label="Hapus proyek"><Trash2 /> Hapus Proyek</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Hapus proyek ini?</AlertDialogTitle>
                <AlertDialogDescription>
                  Proyek “{project.name}”, seluruh tahapan, tugas, penugasan, dan dokumennya akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction disabled={deleteProject.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteProject.mutate()}>
                  Hapus Proyek
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="mb-8 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Progres Keseluruhan</span>
          <span className="font-bold">{progress}%</span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Tahapan */}
        <div className="space-y-4 lg:col-span-2">
          <h2 className="text-lg font-semibold">Tahapan & Ceklist Tugas</h2>
          {project.project_stages.map((stage, idx) => {
            const meta = STAGES.find((s) => s.key === stage.stage_key);
            const sp = stageProgress(stage);
            const tasks = stage.stage_tasks ?? [];
            const complete = sp === 100 && tasks.length > 0;
            return (
              <section
                key={stage.id}
                className={cn(
                  "rounded-2xl border bg-card p-5",
                  complete ? "border-primary/40" : "border-border",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
                        complete
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {complete ? <Check className="h-4 w-4" /> : idx + 1}
                    </div>
                    <div>
                      <h3 className="font-semibold">{meta?.label ?? stage.stage_key}</h3>
                      <p className="text-xs text-muted-foreground">{meta?.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    <input
                      type="date"
                      defaultValue={stage.target_date ?? ""}
                      onBlur={(e) => {
                        if (e.target.value !== (stage.target_date ?? ""))
                          setTargetDate.mutate({ stageId: stage.id, date: e.target.value });
                      }}
                      className="rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${sp}%` }} />
                  </div>
                  <span className="text-xs font-semibold">{sp}%</span>
                </div>

                <ul className="mt-4 space-y-1">
                  {tasks.map((t) => {
                    const overdue = isOverdue(t.due_date, t.is_done);
                    const assignee = auditors.find((a) => a.id === t.auditor_id);
                    return (
                      <li
                        key={t.id}
                        className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50"
                      >
                        <button
                          onClick={() => toggleTask.mutate({ id: t.id, isDone: t.is_done })}
                          aria-label={t.is_done ? "Tandai belum selesai" : "Tandai selesai"}
                          className="shrink-0"
                        >
                          {t.is_done ? (
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground" />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "text-sm",
                              t.is_done ? "text-muted-foreground line-through" : "font-medium",
                            )}
                          >
                            {t.title}
                          </p>
                          <p className={cn("text-xs", overdue ? "font-semibold text-destructive" : "text-muted-foreground")}>
                            {t.due_date ? `Target: ${formatDate(t.due_date)}` : "Tanpa target"}
                            {overdue && " · Terlambat"}
                            {assignee && ` · ${assignee.name}`}
                          </p>
                        </div>
                        <button
                          onClick={() => removeTask.mutate(t.id)}
                          className="rounded p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                          aria-label={`Hapus tugas ${t.title}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    );
                  })}
                  {tasks.length === 0 && (
                    <p className="px-2 py-2 text-xs text-muted-foreground">Belum ada tugas di tahap ini.</p>
                  )}
                </ul>

                {newTaskFor === stage.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      addTask.mutate(stage.id);
                    }}
                    className="mt-3 space-y-2 rounded-xl bg-muted/50 p-3"
                  >
                    <input
                      required
                      autoFocus
                      placeholder="Nama tugas"
                      value={taskForm.title}
                      onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                      className={inputCls}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={taskForm.due_date}
                        onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                        className={inputCls}
                      />
                      <select
                        value={taskForm.auditor_id}
                        onChange={(e) => setTaskForm({ ...taskForm, auditor_id: e.target.value })}
                        className={inputCls}
                      >
                        <option value="">Tanpa penanggung jawab</option>
                        {auditors.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                        Simpan
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewTaskFor(null)}
                        className="rounded-lg border border-input px-4 py-2 text-sm"
                      >
                        Batal
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => setNewTaskFor(stage.id)}
                    className="mt-3 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-primary hover:bg-accent"
                  >
                    <Plus className="h-3.5 w-3.5" /> Tambah Tugas
                  </button>
                )}
                {(stage.stage_key === "pelaporan" || stage.stage_key === "closing") && (
                  <div className="mt-5 border-t border-border pt-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h4 className="flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4" /> Dokumen</h4>
                      <Button size="sm" variant="outline" asChild className={uploadDocument.isPending ? "pointer-events-none opacity-50" : ""}>
                        <label className="cursor-pointer">
                          <Upload className="h-4 w-4" /> {uploadDocument.isPending && uploadDocument.variables?.stageId === stage.id ? "Mengunggah…" : "Unggah Dokumen"}
                          <input type="file" className="sr-only" disabled={uploadDocument.isPending}
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                            onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadDocument.mutate({ stageId: stage.id, file }); e.target.value = ""; }} />
                        </label>
                      </Button>
                    </div>
                    {documentsError && <p role="alert" className="text-xs text-destructive">Dokumen tidak dapat dimuat.</p>}
                    <ul className="space-y-2">
                      {documents.filter((d) => d.stage_id === stage.id).map((document) => (
                        <li key={document.id} className="flex min-w-0 items-center gap-2 text-sm">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate" title={document.file_name}>{document.file_name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{(document.file_size / 1024 / 1024).toFixed(1)} MB</span>
                          <Button size="icon" variant="ghost" title="Unduh dokumen" aria-label={`Unduh ${document.file_name}`} onClick={() => openDocument(document)}><Download /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button size="icon" variant="ghost" title="Hapus dokumen" aria-label={`Hapus ${document.file_name}`}><Trash2 className="text-destructive" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Hapus dokumen?</AlertDialogTitle><AlertDialogDescription>“{document.file_name}” akan dihapus permanen.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => removeDocument.mutate(document)}>Hapus Dokumen</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </li>
                      ))}
                      {!documentsError && !documents.some((d) => d.stage_id === stage.id) && <li className="text-xs text-muted-foreground">Belum ada dokumen.</li>}
                    </ul>
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {/* Penugasan */}
        <div>
          <h2 className="mb-4 text-lg font-semibold">Penugasan</h2>
          <section className="rounded-2xl border border-border bg-card p-5">
            <ul className="space-y-3">
              {assignments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <div>
                     <p className="text-sm font-medium">{a.auditors?.name ?? "Auditor tidak tersedia"}</p>
                    <p className="text-xs text-muted-foreground">
                       {a.role === "ketua tim" ? "Ketua Audit" : a.role === "tim pelaksana" ? "Anggota" : a.role}
                    </p>
                  </div>
                  <button
                    onClick={() => removeAssignment.mutate(a.id)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive"
                    aria-label="Hapus penugasan"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
              {assignments.length === 0 && (
                <p className="text-sm text-muted-foreground">Belum ada penugasan.</p>
              )}
            </ul>

            <div className="mt-5 border-t border-border pt-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                   <UserPlus className="h-3.5 w-3.5" /> Tambah Auditor ke Proyek
              </p>
              <div className="space-y-2">
                 <div role="group" aria-label="Pilih auditor" className="max-h-48 space-y-1 overflow-y-auto border-y border-border py-2">
                   {availableAuditors.map((auditor) => (
                     <label key={auditor.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                       <input type="checkbox" checked={selectedAuditors.includes(auditor.id)}
                         onChange={(e) => setSelectedAuditors((current) => e.target.checked ? [...current, auditor.id] : current.filter((id) => id !== auditor.id))}
                         className="accent-primary" />
                       <span>{auditor.name}</span>
                     </label>
                   ))}
                   {availableAuditors.length === 0 && <p className="text-xs text-muted-foreground">Semua auditor aktif sudah ditugaskan. Tambahkan auditor baru melalui menu Auditor.</p>}
                 </div>
                 <select aria-label="Peran auditor" value={assignRole} onChange={(e) => setAssignRole(e.target.value)} className={inputCls}>
                   <option value="ketua audit">Ketua Audit</option>
                  <option value="anggota">Anggota</option>
                  <option value="reviewer">Reviewer</option>
                </select>
                 <Button
                   disabled={selectedAuditors.length === 0 || addAssignment.isPending}
                  onClick={() => addAssignment.mutate()}
                   className="w-full"
                >
                   Tugaskan {selectedAuditors.length > 0 ? `${selectedAuditors.length} Auditor` : "Auditor"}
                 </Button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
