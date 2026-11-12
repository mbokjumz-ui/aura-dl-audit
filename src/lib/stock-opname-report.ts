import { activeRabItems, groupAmount, lineAmount, numberedRabRows, rabTotals, type OpnameItem } from "./stock-opname";
import { rabDiscountTotals, type FinalizedRab } from "./rab-finalization";

export function stockOpnameReport(items: OpnameItem[], header: Pick<FinalizedRab, "vat_included" | "discount_type" | "discount_value">) {
  const active = activeRabItems(items);
  const totals = rabTotals(active);
  const disposition = rabDiscountTotals(totals.rab, header.vat_included, header);
  const discountPercent = totals.rab > 0 ? disposition.discount / totals.rab * 100 : 0;
  const opname = rabDiscountTotals(totals.actual, header.vat_included, { discount_type: "percent", discount_value: discountPercent });
  const rows = numberedRabRows(active).map(row => {
    const group = row.children.length > 0;
    const dispositionAmount = group ? groupAmount(row.children, "quantity") : lineAmount(row.item.quantity, row.item.unit_price);
    const opnameAmount = group ? (row.children.some(i => i.actual_quantity !== null) ? groupAmount(row.children, "actual_quantity") : null)
      : row.item.actual_quantity === null ? null : lineAmount(row.item.actual_quantity, row.item.unit_price);
    const volumePercent = group || row.item.actual_quantity === null ? null : row.item.quantity > 0 ? row.item.actual_quantity / row.item.quantity * 100 : 0;
    return { ...row, dispositionAmount, opnameAmount, volumePercent };
  });
  return { rows, disposition, opname, discountPercent, workPercent: totals.rab > 0 ? totals.actual / totals.rab * 100 : 0 };
}