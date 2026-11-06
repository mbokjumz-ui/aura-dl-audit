import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, MapPin } from "lucide-react";
import { requireStockPage } from "@/lib/access-client";
import { stockOpnameProjectsQuery } from "@/lib/stock-opname-query";
import { rabTotals, rupiah } from "@/lib/stock-opname";
import { StockOpnameProgress } from "@/components/StockOpnameProgress";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard-stock-opname")({
  beforeLoad: requireStockPage,
  loader: ({ context }) => context.queryClient.ensureQueryData(stockOpnameProjectsQuery),
  head: () => ({ meta: [
    { title: "Dashboard Stock Opname — AURA" },
    { name: "description", content: "Nilai RAB dan progres nilai serta item stock opname seluruh proyek di AURA." },
    { property: "og:title", content: "Dashboard Stock Opname — AURA" },
    { property: "og:description", content: "Pantau proyek, divisi, nilai RAB, dan progres stock opname." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  errorComponent: ({ error }) => <div role="alert" className="space-y-3"><p>Dashboard Stock Opname gagal dimuat: {error.message}</p><Button onClick={() => window.location.reload()}>Coba Lagi</Button></div>,
  notFoundComponent: () => <p>Dashboard Stock Opname tidak ditemukan.</p>,
  component: StockOpnameDashboard,
});

function StockOpnameDashboard() {
  const { data: projects } = useSuspenseQuery(stockOpnameProjectsQuery);
  return <div>
    <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-display text-3xl md:text-4xl">Dashboard Stock Opname</h1>
      <Button variant="outline" asChild><Link to="/stock-opname">Daftar RAB<ArrowRight /></Link></Button>
    </div>
    <div className="mb-7 flex flex-wrap items-center justify-between gap-3 border-y border-border py-4 text-sm">
      <span className="text-muted-foreground">{projects.length} proyek</span>
      <span className="font-semibold tabular-nums">Total nilai RAB (sebelum PPN): {rupiah(projects.reduce((sum, project) => sum + rabTotals(project.stock_opname_items).rab, 0))}</span>
    </div>
    {!projects.length ? <p className="py-10 text-center text-muted-foreground">Belum ada proyek Stock Opname.</p> :
      <div className="grid gap-4 lg:grid-cols-2">
        {projects.map(project => <article key={project.id} className="min-w-0 rounded-lg border border-border bg-card p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0"><h2 className="break-words font-semibold">{project.project_name}</h2>
              <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="break-words">{project.division_location || "—"}</span></p></div>
            <span className="shrink-0 text-xs font-medium text-primary">{project.status === "selesai" ? "Selesai" : "Berjalan"}</span>
          </div>
          <p className="mb-1 text-xs text-muted-foreground">Nilai proyek · RAB sebelum PPN</p>
          <p className="mb-5 break-words text-xl font-semibold tabular-nums">{rupiah(rabTotals(project.stock_opname_items).rab)}</p>
          <StockOpnameProgress items={project.stock_opname_items} />
          <Button variant="ghost" size="sm" asChild className="mt-4 w-full justify-between"><Link to="/stock-opname" search={{ rab: project.id }}>Lihat RAB<ArrowRight /></Link></Button>
        </article>)}
      </div>}
  </div>;
}