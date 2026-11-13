import { z } from "zod";
import { rabDiscountSchema, type FinalizedRab } from "./rab-finalization";

export type SourceDiscount = { discount_type: "rupiah" | "percent"; discount_value: number };
const discountSchema = z.object({ discount_type: z.enum(["rupiah", "percent"]), discount_value: z.number() }).refine(d => rabDiscountSchema.safeParse({ discountType: d.discount_type, discountValue: d.discount_value }).success);
export const sourceDiscountsSchema = z.record(discountSchema);
export function sourceDiscount(rab: Pick<FinalizedRab, "source_discounts" | "selected_price_source" | "discount_type" | "discount_value"> & { finalization_draft?: unknown }, source: string): SourceDiscount {
  const parsed = sourceDiscountsSchema.safeParse(rab.source_discounts);
  if (parsed.success) return parsed.data[source] ?? { discount_type: "rupiah", discount_value: 0 };
  const draft = z.object({ selectedPriceSource: z.string().default("estimate"), discountType: z.enum(["rupiah", "percent"]), discountValue: z.string() }).safeParse(rab.finalization_draft);
  if (draft.success && source === draft.data.selectedPriceSource) return { discount_type: draft.data.discountType, discount_value: Number(draft.data.discountValue) || 0 };
  return source === (rab.selected_price_source ?? "estimate") ? { discount_type: rab.discount_type === "percent" ? "percent" : "rupiah", discount_value: rab.discount_value ?? 0 } : { discount_type: "rupiah", discount_value: 0 };
}