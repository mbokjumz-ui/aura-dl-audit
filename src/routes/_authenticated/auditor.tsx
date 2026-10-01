import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Auditor, Team } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/auditor")({
  head: () => ({
    meta: [
      { title: "Tim & Auditor — AuditFlow" },
      { name: "description", content: "Kelola daftar auditor dan kelompok tim audit." },
      { property: "og:title", content: "Tim & Auditor — AuditFlow" },
      { property: "og:description", content: "Kelola daftar auditor dan kelompok tim audit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TimPage,
});

function TimPage() {
  const queryClient = useQueryClient();
  const [auditorForm, setAuditorForm] = useState({ name: "", email: "", position: "" });
  const [showAuditorForm, setShowAuditorForm] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [addingMemberTo, setAddingMemberTo] = useState<string | null>(null);
  const [selectedAuditor, setSelectedAuditor] = useState("");

  const { data: auditors = [] } = useQuery({
    queryKey: ["auditors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("auditors").select("*").order("name");
      if (error) throw error;
      return data as Auditor[];
    },
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("*, team_members(auditor_id, auditors(*))")
        .order("name");
      if (error) throw error;
      return data as Team[];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["auditors"] });
    queryClient.invalidateQueries({ queryKey: ["teams"] });
    queryClient.invalidateQueries({ queryKey: ["auditor-count"] });
  };

  const addAuditor = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("auditors").insert({
        name: auditorForm.name,
        email: auditorForm.email || null,
        position: auditorForm.position || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Auditor ditambahkan");
      setAuditorForm({ name: "", email: "", position: "" });
      setShowAuditorForm(false);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const removeAuditor = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("auditors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Auditor dihapus");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const addTeam = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("teams").insert({ name: teamName });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tim dibuat");
      setTeamName("");
      setShowTeamForm(false);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const addMember = useMutation({
    mutationFn: async ({ teamId, auditorId }: { teamId: string; auditorId: string }) => {
      const { error } = await supabase.from("team_members").insert({ team_id: teamId, auditor_id: auditorId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Anggota ditambahkan");
      setAddingMemberTo(null);
      setSelectedAuditor("");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const removeMember = useMutation({
    mutationFn: async ({ teamId, auditorId }: { teamId: string; auditorId: string }) => {
      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("team_id", teamId)
        .eq("auditor_id", auditorId);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  });

  const removeTeam = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("teams").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tim dihapus");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const inputCls =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl md:text-4xl">Tim & Auditor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kelola daftar auditor individu dan kelompok tim audit.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Auditor */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <Users className="h-4 w-4 text-primary" /> Auditor ({auditors.length})
            </h2>
            <button
              onClick={() => setShowAuditorForm(!showAuditorForm)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              <Plus className="h-3.5 w-3.5" /> Tambah
            </button>
          </div>

          {showAuditorForm && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addAuditor.mutate();
              }}
              className="mb-4 space-y-2 rounded-xl bg-muted/50 p-3"
            >
              <input
                required
                placeholder="Nama auditor"
                value={auditorForm.name}
                onChange={(e) => setAuditorForm({ ...auditorForm, name: e.target.value })}
                className={inputCls}
              />
              <input
                type="email"
                placeholder="Email (opsional)"
                value={auditorForm.email}
                onChange={(e) => setAuditorForm({ ...auditorForm, email: e.target.value })}
                className={inputCls}
              />
              <input
                placeholder="Jabatan (opsional)"
                value={auditorForm.position}
                onChange={(e) => setAuditorForm({ ...auditorForm, position: e.target.value })}
                className={inputCls}
              />
              <button className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground">
                Simpan Auditor
              </button>
            </form>
          )}

          <ul className="divide-y divide-border">
            {auditors.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                    {a.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.position ?? a.email ?? "—"}</p>
                  </div>
                </div>
                <button
                  onClick={() => removeAuditor.mutate(a.id)}
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Hapus ${a.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
            {auditors.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">Belum ada auditor.</p>
            )}
          </ul>
        </section>

        {/* Tim */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <Users className="h-4 w-4 text-primary" /> Tim ({teams.length})
            </h2>
            <button
              onClick={() => setShowTeamForm(!showTeamForm)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              <Plus className="h-3.5 w-3.5" /> Buat Tim
            </button>
          </div>

          {showTeamForm && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addTeam.mutate();
              }}
              className="mb-4 flex gap-2 rounded-xl bg-muted/50 p-3"
            >
              <input
                required
                placeholder="Nama tim"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className={inputCls}
              />
              <button className="shrink-0 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
                Simpan
              </button>
            </form>
          )}

          <div className="space-y-4">
            {teams.map((t) => {
              const memberIds = new Set((t.team_members ?? []).map((m) => m.auditor_id));
              const available = auditors.filter((a) => !memberIds.has(a.id));
              return (
                <div key={t.id} className="rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(t.team_members ?? []).length} anggota
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setAddingMemberTo(addingMemberTo === t.id ? null : t.id)}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        aria-label="Tambah anggota"
                      >
                        <UserPlus className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => removeTeam.mutate(t.id)}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Hapus ${t.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(t.team_members ?? []).map((m) =>
                      m.auditors ? (
                        <span
                          key={m.auditor_id}
                          className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground"
                        >
                          {m.auditors.name}
                          <button
                            onClick={() => removeMember.mutate({ teamId: t.id, auditorId: m.auditor_id })}
                            aria-label={`Keluarkan ${m.auditors!.name}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ) : null,
                    )}
                    {(t.team_members ?? []).length === 0 && (
                      <span className="text-xs text-muted-foreground">Belum ada anggota.</span>
                    )}
                  </div>

                  {addingMemberTo === t.id && (
                    <div className="mt-3 flex gap-2">
                      <select
                        value={selectedAuditor}
                        onChange={(e) => setSelectedAuditor(e.target.value)}
                        className={inputCls}
                      >
                        <option value="">Pilih auditor…</option>
                        {available.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                      <button
                        disabled={!selectedAuditor}
                        onClick={() => addMember.mutate({ teamId: t.id, auditorId: selectedAuditor })}
                        className="shrink-0 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                      >
                        Tambah
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {teams.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">Belum ada tim.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
