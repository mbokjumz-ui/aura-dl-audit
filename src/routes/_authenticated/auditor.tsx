import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Auditor } from "@/lib/audit";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/auditor")({
  head: () => ({
    meta: [
      { title: "Auditor — AuditFlow" },
      { name: "description", content: "Kelola daftar auditor audit internal." },
      { property: "og:title", content: "Auditor — AuditFlow" },
      { property: "og:description", content: "Kelola daftar auditor audit internal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuditorPage,
});

function AuditorPage() {
  const queryClient = useQueryClient();
  const [auditorForm, setAuditorForm] = useState({ name: "", email: "", position: "" });
  const [showAuditorForm, setShowAuditorForm] = useState(false);

  const { data: auditors = [] } = useQuery({
    queryKey: ["auditors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("auditors").select("*").order("name");
      if (error) throw error;
      return data as Auditor[];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["auditors"] });
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

  const inputCls =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl md:text-4xl">Auditor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kelola daftar auditor untuk penugasan proyek.
        </p>
      </div>

      <div className="max-w-3xl">
        <section className="border-t border-border pt-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <Users className="h-4 w-4 text-primary" /> Auditor ({auditors.length})
            </h2>
            <Button size="sm"
              onClick={() => setShowAuditorForm(!showAuditorForm)}
            >
              <Plus className="h-3.5 w-3.5" /> Tambah
            </Button>
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
              <Button disabled={addAuditor.isPending} className="w-full">
                Simpan Auditor
              </Button>
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
                <Button variant="ghost" size="icon"
                  onClick={() => removeAuditor.mutate(a.id)}
                  disabled={removeAuditor.isPending}
                  aria-label={`Hapus ${a.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
            {auditors.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">Belum ada auditor.</p>
            )}
          </ul>
        </section>

      </div>
    </div>
  );
}
