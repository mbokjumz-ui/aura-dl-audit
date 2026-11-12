import { rabDiscountTotals, type FinalizedRab } from "./rab-finalization";
import { priceComparisons, readSuppliers } from "./rab-pricing";
import type { OpnameItem } from "./stock-opname";

export function rabComparisonReport(items: OpnameItem[], header: Pick<FinalizedRab, "suppliers" | "discount_type" | "discount_value">) {
  return priceComparisons(items, readSuppliers(header.suppliers)).map(source => ({
    ...source,
    totals: source.amount === null ? null : rabDiscountTotals(source.amount, false, header),
  }));
}