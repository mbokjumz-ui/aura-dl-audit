import { z } from "zod";
import { type OpnameItem, activeRabItems, leaves, rabTotals } from "./stock-opname";

export type PurchaseApproval = { purchase_approval_required?: boolean; purchase_approved_at?: string | null; purchase_printed_at?: string | null };
export function purchasePermissions(rab: PurchaseApproval) {
  const gated = rab.purchase_approval_required === true;
  const approved = !!rab.purchase_approved_at;
  return { gated, approved, editEstimate: !gated || !approved, editSuppliers: !gated || approved, canFinalize: !gated || approved };
}
const snapshotItem = z.object({ id: z.string(), parent_id: z.string().nullable(), description: z.string(), quantity: z.number(), unit: z.string(), unit_price: z.number(), estimated_unit_price: z.number(), is_cancelled: z.boolean(), sort_order: z.number(), actual_quantity: z.number().nullable() });
export const purchaseSnapshotSchema = z.object({ project_name: z.string(), division_location: z.string(), disposition_number: z.string(), responsible_name: z.string(), auditor_name: z.string(), discount: z.object({ discount_type: z.enum(["rupiah", "percent"]), discount_value: z.number() }), items: z.array(snapshotItem) });
export type PurchaseSnapshot = z.infer<typeof purchaseSnapshotSchema>;
export function purchaseEstimateReady(items: OpnameItem[]) {
  const rows = leaves(activeRabItems(items));
  return rows.length > 0 && rows.every(i => i.description.trim() && i.unit.trim() && i.quantity > 0 && (i.estimated_unit_price ?? i.unit_price) > 0);
}
export function purchaseEstimateTotal(items: OpnameItem[]) {
  return rabTotals(activeRabItems(items).map(i => ({ ...i, unit_price: i.estimated_unit_price ?? i.unit_price }))).rab;
}