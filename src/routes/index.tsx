import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ClipboardCheck, FolderKanban, ListChecks, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AuditFlow — Monitoring Progres Audit Internal" },
      {
        name: "description",
        content:
          "Aplikasi monitoring progres kerja tim internal audit: kelola auditor, tim, penugasan project, dan lacak tahapan dari perencanaan hingga closing.",
      },
      { property: "og:title", content: "AuditFlow — Monitoring Progres Audit Internal" },
      {
        property: "og:description",
        content:
          "Kelola tim audit, penugasan project, dan progres lima tahap audit dalam satu aplikasi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 md:px-8">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ClipboardCheck className="h-4.5 w-4.5" />
          </div>
          <span className="font-display text-xl">AuditFlow</span>
        </div>
        <Link
          to="/auth"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Masuk
        </Link>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-12 md:px-8 md:pt-20">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">
          Internal Audit Monitor
        </p>
        <h1 className="mt-4 max-w-2xl font-display text-4xl leading-tight md:text-6xl">
          Pantau progres audit tim Anda, dari perencanaan sampai closing.
        </h1>
        <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
          Kelola daftar auditor dan tim, tugaskan mereka ke project audit, dan lacak
          setiap tahap kerja dengan ceklist tugas serta tanggal target yang jelas.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/auth"
            className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Mulai Sekarang
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-20 md:grid-cols-3 md:px-8">
        {[
          {
            icon: Users,
            title: "Kelola Tim & Auditor",
            desc: "Daftarkan auditor individu dan kelompok tim dalam satu tempat.",
          },
          {
            icon: FolderKanban,
            title: "Penugasan Proyek",
            desc: "Assign auditor atau tim ke project audit dengan peran masing-masing.",
          },
          {
            icon: ListChecks,
            title: "Ceklist 5 Tahap",
            desc: "Perencanaan, persiapan, pelaksanaan, pelaporan, dan closing — lengkap dengan tanggal target.",
          },
        ].map((f) => (
          <div key={f.title} className="rounded-2xl border border-border bg-card p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-semibold">{f.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
