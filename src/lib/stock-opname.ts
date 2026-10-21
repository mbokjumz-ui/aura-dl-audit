export type OpnameItem = {
  id: string;
  parent_id: string | null;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  actual_quantity: number | null;
  sort_order: number;
};

export const lineAmount = (qty: number, price: number) => Math.round(Number(qty) * Number(price) * 100) / 100;

/** Leaf rows carry values; a level-1 point with sub-points is a group whose amount is its children's sum. */
export function rabTree(items: OpnameItem[]) {
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  return sorted.filter(i => !i.parent_id).map(point => ({ point, children: sorted.filter(c => c.parent_id === point.id) }));
}

export function leaves(items: OpnameItem[]) {
  return items.filter(i => !items.some(c => c.parent_id === i.id));
}

export function rabTotals(items: OpnameItem[]) {
  let rab = 0, actual = 0, counted = 0;
  const rows = leaves(items);
  for (const i of rows) {
    rab += lineAmount(i.quantity, i.unit_price);
    if (i.actual_quantity !== null) { actual += lineAmount(i.actual_quantity, i.unit_price); counted++; }
  }
  rab = Math.round(rab * 100) / 100; actual = Math.round(actual * 100) / 100;
  return { rab, actual, difference: Math.round((actual - rab) * 100) / 100, counted, total: rows.length };
}

export function groupAmount(children: OpnameItem[], field: "quantity" | "actual_quantity") {
  return children.reduce((s, c) => s + lineAmount(c[field] ?? 0, c.unit_price), 0);
}

export function numberedRabRows(items: OpnameItem[]) {
  return rabTree(items).flatMap(({ point, children }, index) => [
    { item: point, number: String(index + 1), children, level: 0 },
    ...children.map((item, childIndex) => ({ item, number: `${index + 1}.${childIndex + 1}`, children: [] as OpnameItem[], level: 1 })),
  ]);
}

export function opnameCompletion(done: boolean, now = new Date()) {
  return { status: done ? "selesai" : "berjalan", completed_at: done ? now.toISOString() : null };
}

export const rupiah = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 2 }).format(n);
