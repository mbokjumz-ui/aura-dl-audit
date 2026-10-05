import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Masuk — AURA" },
      { name: "description", content: "Masuk atau daftar ke AURA untuk memonitor progres audit internal." },
      { property: "og:title", content: "Masuk — AURA" },
      { property: "og:description", content: "Masuk atau daftar ke AURA untuk memonitor progres audit internal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const LOVABLE_HOSTS = ["lovable.app", "lovableproject.com", "lovableproject-dev.com", "lovable.dev"];

function isLovableHost(hostname: string) {
  return LOVABLE_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`));
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Pendaftaran berhasil! Silakan cek email Anda untuk konfirmasi.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    // Lovable's OAuth broker (/~oauth/initiate) only exists on Lovable hosting.
    // Elsewhere (e.g. Netlify) use Supabase's own Google OAuth redirect flow.
    if (!isLovableHost(window.location.hostname)) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth` },
      });
      if (error) toast.error("Gagal masuk dengan Google");
      return;
    }

    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Gagal masuk dengan Google");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ClipboardCheck className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-display text-3xl">AURA</h1>
          <p className="mt-1 text-xs text-muted-foreground">Audit Updates, Review &amp; Action</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login" ? "Masuk ke akun Anda" : "Buat akun baru"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-6">
          {mode === "signup" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">Nama lengkap</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="Nama Anda"
              />
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="nama@perusahaan.co.id"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Kata sandi</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="Minimal 6 karakter"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login" ? "Masuk" : "Daftar"}
          </button>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            atau
            <div className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
          >
            Lanjutkan dengan Google
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {mode === "login" ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
          <button
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="font-semibold text-primary hover:underline"
          >
            {mode === "login" ? "Daftar" : "Masuk"}
          </button>
        </p>
      </div>
    </div>
  );
}
