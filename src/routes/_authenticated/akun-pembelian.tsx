import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { requireAuditPage } from "@/lib/access-client";
import { createPurchasingAccount, listPurchasingAccounts } from "@/lib/purchasing-accounts.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/akun-pembelian")({
  beforeLoad: requireAuditPage,
  head: () => ({ meta: [
    { title: "Akun Pembelian — AURA" },
    { name: "description", content: "Kelola akun tim pembelian project di AURA." },
    { property: "og:title", content: "Akun Pembelian — AURA" },
    { property: "og:description", content: "Akun bernama untuk tim pembelian project." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: AccountsPage,
});

function AccountsPage() {
  const list = useServerFn(listPurchasingAccounts);
  const create = useServerFn(createPurchasingAccount);
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });
  const accounts = useQuery({ queryKey: ["purchasing-accounts"], queryFn: () => list() });
  const save = useMutation({ mutationFn: () => create({ data: { ...form, origin: window.location.origin } }), onSuccess: result => {
    setOpen(false); setForm({ fullName: "", email: "", password: "" });
    client.invalidateQueries({ queryKey: ["purchasing-accounts"] });
    toast.success(result.confirmationSent ? "Akun dibuat. Email konfirmasi telah dikirim." : "Akun dibuat. Email konfirmasi belum terkirim; gunakan Kirim ulang di halaman login Pembelian.");
  }, onError: e => toast.error(e.message) });
  return <div>
    <div className="mb-7 flex flex-wrap items-center justify-between gap-3"><h1 className="font-display text-3xl md:text-4xl">Akun Pembelian</h1><Button onClick={() => setOpen(true)}><Plus />Tambah Akun</Button></div>
    {accounts.isPending ? <p>Memuat akun…</p> : accounts.error ? <p role="alert" className="text-destructive">Daftar akun gagal dimuat. <Button variant="outline" onClick={() => accounts.refetch()}>Coba Lagi</Button></p> : <ul className="divide-y divide-border border-t border-border">{accounts.data?.map(account => <li key={account.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><p className="break-words font-medium">{account.fullName}</p><p className="break-all text-sm text-muted-foreground">{account.email}</p></div><span className="text-sm text-muted-foreground">{account.confirmed ? "Aktif" : "Menunggu konfirmasi email"}</span></li>)}{!accounts.data?.length && <li className="py-10 text-center text-muted-foreground">Belum ada akun Pembelian.</li>}</ul>}
    <Dialog open={open} onOpenChange={value => !save.isPending && setOpen(value)}><DialogContent><DialogHeader><DialogTitle>Tambah Akun Pembelian</DialogTitle></DialogHeader>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
        <label className="block space-y-1 text-sm font-medium">Nama lengkap<Input required value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} /></label>
        <label className="block space-y-1 text-sm font-medium">Email<Input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
        <label className="block space-y-1 text-sm font-medium">Kata sandi<Input required type="password" minLength={8} autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></label>
        <Button className="w-full" disabled={save.isPending}>{save.isPending ? "Menyimpan…" : "Buat Akun"}</Button>
      </form>
    </DialogContent></Dialog>
  </div>;
}