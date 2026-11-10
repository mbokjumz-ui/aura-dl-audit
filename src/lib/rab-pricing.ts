import { z } from "zod";
import { activeRabItems, leaves, lineAmount, rabTotals, type OpnameItem } from "./stock-opname";

export const supplierSchema = z.array(z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(150) })).refine(rows => new Set(rows.map(r => r.id)).size === rows.length);
export type RabSupplier = z.infer<typeof supplierSchema>[number];
export const supplierPricesSchema = z.record(z.string().uuid(), z.number().finite().min(0).max(100000000000000));
export function readSuppliers(value: unknown): RabSupplier[] {
  const result = supplierSchema.safeParse(value);
  return result.success ? result.data : [];
}
export function readSupplierPrices(value: unknown): Record<string, number> {
  const result = supplierPricesSchema.safeParse(value);
  return result.success ? result.data : {};
}
export function sourcePrice(item: OpnameItem, source: string): number | null {
  return source === "estimate" ? item.estimated_unit_price ?? item.unit_price : readSupplierPrices(item.supplier_prices)[source] ?? null;
}
export function pricedRabItems(items: OpnameItem[], source: string): OpnameItem[] {
  const active = activeRabItems(items);
  const leafIds = new Set(leaves(active).map(i => i.id));
  return active.map(i => {
    const price = sourcePrice(i, source);
    if (leafIds.has(i.id) && price === null) throw new Error(`Harga supplier belum diisi untuk ${i.description}.`);
    return { ...i, unit_price: price ?? 0 };
  });
}
export function priceComparisons(items: OpnameItem[], suppliers: RabSupplier[]) {
  const active = activeRabItems(items);
  return [{ id: "estimate", name: "Perkiraan Pembelian" }, ...suppliers].map(source => {
    const complete = leaves(active).every(i => sourcePrice(i, source.id) !== null);
    return { ...source, complete, amount: complete ? rabTotals(pricedRabItems(items, source.id)).rab : null };
  });
}
export function comparisonAmount(item: OpnameItem, source: string): number | null {
  const price = sourcePrice(item, source);
  return price === null ? null : lineAmount(item.quantity, price);
}