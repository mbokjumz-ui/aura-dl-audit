import { test } from "node:test";
import assert from "node:assert/strict";
import { pricedRabItems, priceComparisons, sourcePrice } from "./rab-pricing";
import { activeRabItems, rabTotals, opnameProgress, type OpnameItem } from "./stock-opname";
import { dispositionAmounts } from "./rab-disposition";
const a = "00000000-0000-4000-8000-000000000001", b = "00000000-0000-4000-8000-000000000002";
const item = (p: Partial<OpnameItem>): OpnameItem => ({ id: "i", description: "Pekerjaan", parent_id: null, quantity: 2, unit: "unit", unit_price: 100, estimated_unit_price: 100, actual_quantity: null, sort_order: 0, supplier_prices: { [a]: 80, [b]: 90 }, ...p });
test("each supplier has its own price and comparison total", () => {
  assert.deepEqual(priceComparisons([item({})], [{ id:a, name:"Supplier A" }, { id:b, name:"Supplier B" }]).map(c => c.amount), [200,160,180]);
});
test("selected supplier becomes the effective price without overwriting estimate", () => {
  const selected = pricedRabItems([item({})], a);
  assert.equal(selected[0]?.unit_price,80); assert.equal(sourcePrice(selected[0] as OpnameItem,"estimate"),100);
  assert.equal(dispositionAmounts(selected,false).totals.total,160);
});
test("cancelled items remain stored but contribute nothing to totals and progress", () => {
  const items = [item({ id:"active",actual_quantity:1 }),item({ id:"cancel",is_cancelled:true,actual_quantity:2 })];
  assert.equal(items.length,2); assert.equal(rabTotals(items).rab,200); assert.equal(opnameProgress(items).total,1);
  assert.deepEqual(dispositionAmounts(items,false).rows.map(r=>r.item.id),["active"]);
});
test("cancelled parent excludes its children and empty groups never become priced leaves", () => {
  assert.equal(rabTotals([item({id:"parent",is_cancelled:true}),item({parent_id:"parent"})]).rab,0);
  assert.deepEqual(activeRabItems([item({id:"parent"}),item({parent_id:"parent",is_cancelled:true})]),[]);
});
test("missing supplier quotes block selection while explicit zero is valid", () => {
  assert.throws(()=>pricedRabItems([item({supplier_prices:{}})],a));
  assert.equal(pricedRabItems([item({supplier_prices:{[a]:0}})],a)[0]?.unit_price,0);
});