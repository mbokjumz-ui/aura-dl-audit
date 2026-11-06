import { Progress } from "@/components/ui/progress";
import { opnameProgress, rupiah, type OpnameItem } from "@/lib/stock-opname";

export function StockOpnameProgress({ items }: { items: OpnameItem[] }) {
  const totals = opnameProgress(items);
  return <div className="grid min-w-0 gap-4 text-left">
    {[
      { label: "Progres nilai opname", percent: totals.amountPercent, detail: `${rupiah(totals.actual)} / ${rupiah(totals.rab)}`, tone: "[&>div]:bg-chart-1" },
      { label: "Progres item opname", percent: totals.itemPercent, detail: `${totals.counted} / ${totals.total} item`, tone: "[&>div]:bg-chart-2" },
    ].map(row => <div key={row.label} className="min-w-0 space-y-1.5">
      <div className="flex items-start justify-between gap-3 text-xs"><span className="font-medium">{row.label}</span><span className="shrink-0 font-semibold tabular-nums">{row.percent.toLocaleString("id-ID")}%</span></div>
      <Progress aria-label={row.label} aria-valuetext={`${row.percent.toLocaleString("id-ID")}%`} value={Math.min(100, Math.max(0, row.percent))} className={`bg-muted ${row.tone}`} />
      <p className="break-words text-xs font-normal tabular-nums text-muted-foreground">{row.detail}</p>
    </div>)}
  </div>;
}