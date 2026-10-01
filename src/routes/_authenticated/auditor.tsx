import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Auditor } from "@/lib/audit";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/auditor")({
  head: () => ({
    meta: [
      { title: "Auditor — AURA" },
      { name: "description", content: "Kelola daftar auditor audit internal." },
      { property: "og:title", content: "Auditor — AURA" },
      { property: "og:description", content: "Kelola daftar auditor audit internal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuditorPage,
});

function AuditorPage() {
  const queryClient = useQueryClient();
  const [auditorForm, setAuditorForm] = useState({ name: "", email: "", position: "", whatsapp_number: "" });
  const [showAuditorForm, setShowAuditorForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", position: "", whatsapp_number: "" });

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
        name: auditorForm.name.trim(),
        email: auditorForm.email.trim() || null,
        position: auditorForm.position.trim() || null,
        whatsapp_number: auditorForm.whatsapp_number.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Auditor ditambahkan");
      setAuditorForm({ name: "", email: "", position: "", whatsapp_number: "" });
      setShowAuditorForm(false);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateAuditor = useMutation({
    mutationFn: async () => {
      if (!editingId) throw new Error("Pilih auditor untuk diedit.");
      const { error } = await supabase.from("auditors").update({
        name: editForm.name.trim(),
        email: editForm.email.trim() || null,
        position: editForm.position.trim() || null,
        whatsapp_number: editForm.whatsapp_number.trim() || null,
      }).eq("id", editingId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Auditor diperbarui");
      setEditingId(null);
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const beginEdit = (auditor: Auditor) => {
    setEditingId(auditor.id);
    setEditForm({
      name: auditor.name,
      email: auditor.email ?? "",
      position: auditor.position ?? "",
      whatsapp_number: auditor.whatsapp_number ?? "",
    });
  };

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
              <input
                type="tel"
                aria-label="Nomor WhatsApp"
                placeholder="Nomor WhatsApp (opsional)"
                value={auditorForm.whatsapp_number}
                onChange={(e) => setAuditorForm({ ...auditorForm, whatsapp_number: e.target.value })}
                className={inputCls}
              />
              <Button disabled={addAuditor.isPending} className="w-full">
                Simpan Auditor
              </Button>
            </form>
          )}

          <ul className="divide-y divide-border">
            {auditors.map((a) => (
              <li key={a.id} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                    {a.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.position ?? a.email ?? "—"}</p>
                    {a.whatsapp_number && <p className="text-xs text-muted-foreground">WA: {a.whatsapp_number}</p>}
                  </div>
                </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => beginEdit(a)} aria-label={`Edit ${a.name}`} title={`Edit ${a.name}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon"
                      onClick={() => removeAuditor.mutate(a.id)}
                      disabled={removeAuditor.isPending}
                      aria-label={`Hapus ${a.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {editingId === a.id && (
                  <form onSubmit={(e) => { e.preventDefault(); updateAuditor.mutate(); }} className="mt-3 grid gap-2 rounded-md bg-muted/50 p-3 sm:grid-cols-2">
                    <label className="text-xs font-medium">Nama
                      <input required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className={`mt-1 ${inputCls}`} />
                    </label>
                    <label className="text-xs font-medium">Email
                      <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className={`mt-1 ${inputCls}`} />
                    </label>
                    <label className="text-xs font-medium">Jabatan
                      <input value={editForm.position} onChange={(e) => setEditForm({ ...editForm, position: e.target.value })} className={`mt-1 ${inputCls}`} />
                    </label>
                    <label className="text-xs font-medium">Nomor WhatsApp
                      <input type="tel" value={editForm.whatsapp_number} onChange={(e) => setEditForm({ ...editForm, whatsapp_number: e.target.value })} className={`mt-1 ${inputCls}`} />
                    </label>
                    <div className="flex gap-2 sm:col-span-2">
                      <Button type="submit" size="sm" disabled={updateAuditor.isPending}>Simpan</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)}>Batal</Button>
                    </div>
                  </form>
                )}
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
