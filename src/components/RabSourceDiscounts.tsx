import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sourceDiscount, type SourceDiscount } from "@/lib/rab-source-discounts";
import { priceComparisons, readSuppliers } from "@/lib/rab-pricing";
import { rabDiscountTotals, validateRabDiscount, type FinalizedRab } from "@/lib/rab-finalization";
import { rupiah, type OpnameItem } from "@/lib/stock-opname";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function RabSourceDiscounts({ rab, items, editable, onSaved }: { rab: FinalizedRab & { id: string }; items: OpnameItem[]; editable: boolean; onSaved: () => void }) {
  return <section className="mt-5 border-y border-border py-4"><h2 className="mb-3 font-semibold">Diskon Perkiraan Pembelian & Supplier</h2><div className="divide-y divide-border">{priceComparisons(items, readSuppliers(rab.suppliers)).map(source => {
    const discount = sourceDiscount(rab, source.id);
    return <DiscountRow key={`${source.id}:${discount.discount_type}:${discount.discount_value}`} rabId={rab.id} source={source} discount={discount} editable={editable} onSaved={onSaved} />;
  })}</div></section>;
}

function DiscountRow({ rabId, source, discount, editable, onSaved }: { rabId: string; source: { id: string; name: string; amount: number | null }; discount: SourceDiscount; editable: boolean; onSaved: () => void }) {
  const [mode, setMode] = useState(discount.discount_type);
  const [value, setValue] = useState(String(discount.discount_value));
  const save = useMutation({ mutationFn: async () => {
    if (source.amount === null && mode === "rupiah" && Number(value) > 0) throw new Error("Lengkapi harga supplier sebelum mengisi diskon rupiah.");
    validateRabDiscount(source.amount ?? 0, mode, Number(value));
    const { error } = await supabase.rpc("save_rab_source_discount", { _rab_id: rabId, _source: source.id, _discount_type: mode, _discount_value: Number(value) });
    if (error) throw error;
  }, onSuccess: () => { onSaved(); toast.success(`Diskon ${source.name} disimpan.`); }, onError: e => toast.error(e.message) });
  const totals = source.amount === null ? null : rabDiscountTotals(source.amount, false, discount);
  return <form className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
    <div className="min-w-0"><h3 className="break-words text-sm font-semibold">{source.name}</h3><p className="mt-1 text-xs text-muted-foreground">Jumlah: {source.amount === null ? "Harga belum lengkap" : rupiah(source.amount)}{totals && ` · Setelah diskon: ${rupiah(totals.total)}`}</p></div>
    {editable ? <div className="flex flex-wrap items-end gap-2"><label className="space-y-1 text-xs">Jenis diskon<Select value={mode} onValueChange={v => { setMode(v === "percent" ? "percent" : "rupiah"); setValue("0"); }} disabled={save.isPending}><SelectTrigger className="w-28" aria-label={`Jenis diskon ${source.name}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="rupiah">Rupiah (Rp)</SelectItem><SelectItem value="percent">Persen (%)</SelectItem></SelectContent></Select></label><label className="space-y-1 text-xs">Diskon {mode === "percent" ? "(%)" : "(Rp)"}<Input className="w-36" aria-label={`Diskon ${source.name}`} type="number" min="0" max={mode === "percent" ? 100 : source.amount ?? 0} step="0.01" value={value} disabled={save.isPending} onChange={e => setValue(e.target.value)} /></label><Button type="submit" variant="outline" size="icon" disabled={save.isPending} title={`Simpan diskon ${source.name}`} aria-label={`Simpan diskon ${source.name}`}><Save /></Button></div> : <p className="text-sm">Diskon: {discount.discount_type === "percent" ? `${discount.discount_value}%` : rupiah(discount.discount_value)}</p>}
  </form>;
}