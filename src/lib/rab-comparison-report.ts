import { rabDiscountTotals, type FinalizedRab } from "./rab-finalization";
import { priceComparisons, readSuppliers } from "./rab-pricing";
import type { OpnameItem } from "./stock-opname";
import { sourceDiscount } from "./rab-source-discounts";

export function rabComparisonReport(items: OpnameItem[], header: Pick<FinalizedRab, "suppliers" | "source_discounts" | "selected_price_source" | "discount_type" | "discount_value">) {
  return priceComparisons(items, readSuppliers(header.suppliers)).map(source => ({
    ...source,
    totals: source.amount === null ? null : rabDiscountTotals(source.amount, false, sourceDiscount(header, source.id)),
  }));
}