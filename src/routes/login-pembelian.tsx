import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Calculator, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { readAppRole } from "@/lib/access-client";
import { roleHome } from "@/lib/access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/login-pembelian")({ head: () => ({ meta: [
  { title: "Masuk Pembelian — AURA" }, { name: "description", content: "Login tim pembelian project untuk Stock Opname AURA." },
  { property: "og:title", content: "Masuk Pembelian — AURA" }, { property: "og:description", content: "Akses khusus tim pembelian project." },
  { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
] }), component: PurchasingLogin });

function PurchasingLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  useEffect(() => { readAppRole().then(role => { if (role) navigate({ to: roleHome(role), replace: true }); }).catch(() => toast.error("Hak akses gagal dimuat.")); }, [navigate]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true);
    try {
      const result = await supabase.auth.signInWithPassword({ email, password });
      if (result.error) { if (result.error.code === "email_not_confirmed") setPending(true); throw result.error; }
      const role = await readAppRole();
      if (role !== "purchasing") { await supabase.auth.signOut(); throw new Error("Halaman ini khusus akun Pembelian."); }
      navigate({ to: "/stock-opname", replace: true });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Login gagal."); } finally { setLoading(false); }
  }
  async function resend() {
    setLoading(true);
    try {
      const result = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${window.location.origin}/login-pembelian` } });
      if (result.error) throw result.error;
      toast.success("Email konfirmasi dikirim ulang.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Email gagal dikirim."); } finally { setLoading(false); }
  }
  return <div className="flex min-h-screen items-center justify-center bg-background px-4"><div className="w-full max-w-sm">
    <div className="mb-8 text-center"><Calculator className="mx-auto h-10 w-10 text-primary" /><h1 className="mt-4 font-display text-3xl">AURA · Pembelian</h1><p className="mt-2 text-sm text-muted-foreground">Masuk ke akun Pembelian</p></div>
    <form className="space-y-4" onSubmit={submit}>
      <label className="block space-y-1 text-sm font-medium">Email<Input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label className="block space-y-1 text-sm font-medium">Kata sandi<Input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
      <Button className="w-full" disabled={loading}>{loading && <Loader2 className="animate-spin" />}Masuk Pembelian</Button>
      {pending && <Button type="button" variant="outline" className="w-full" disabled={loading} onClick={resend}>Kirim ulang email konfirmasi</Button>}
    </form>
    <Button asChild variant="link" className="mt-5 w-full"><Link to="/auth">Masuk Internal Audit</Link></Button>
  </div></div>;
}