import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

test("supplier finalization is atomic, keeps cancelled rows and protects both roles", async () => {
  const url=process.env["SUPABASE_URL"], key=process.env["SUPABASE_SERVICE_ROLE_KEY"], pub=process.env["SUPABASE_PUBLISHABLE_KEY"];
  assert.ok(url && key && pub);
  const admin=createClient(url,key,{auth:{persistSession:false}});
  for(const role of ["internal_audit","purchasing"]) {
    let userId:string|undefined, rabId:string|undefined;
    try {
      const email=`pricing-${crypto.randomUUID()}@example.com`,password=crypto.randomUUID()+"aA1";
      const created=await admin.auth.admin.createUser({email,password,email_confirm:true});
      assert.equal(created.error,null); assert.ok(created.data.user); userId=created.data.user.id;
      assert.equal((await admin.from("user_roles").insert({user_id:userId,role})).error,null);
      const client:SupabaseClient=createClient(url,pub,{auth:{persistSession:false}});
      assert.equal((await client.auth.signInWithPassword({email,password})).error,null);
      const a=crypto.randomUUID(),b=crypto.randomUUID();
      const rab=await client.from("stock_opname_projects").insert({project_name:"Uji harga supplier",suppliers:[{id:a,name:"Supplier A"},{id:b,name:"Supplier B"}]}).select("id").single();
      assert.equal(rab.error,null); rabId=rab.data?.id; assert.ok(rabId);
      const inserted=await client.from("stock_opname_items").insert([{rab_id:rabId,description:"Aktif",quantity:2,unit_price:100,supplier_prices:{[a]:80},is_cancelled:false}, {rab_id:rabId,description:"Batal",quantity:10,unit_price:999,supplier_prices:{},is_cancelled:true}]).select();
      assert.equal(inserted.error,null);
      const active=inserted.data?.find((i:{description:string})=>i.description==="Aktif"); assert.ok(active);
      const args={_rab_id:rabId,_source:b,_vat_included:true,_approvers:[{name:"A",position:"Manajer"}],_acknowledgers:[{name:"B",position:"Manajer"}],_note:"",_work_days:2,_work_start_date:"2026-11-10",_down_payment_percent:0,_responsible_position:"Manajer",_discount_type:"percent",_discount_value:10};
      assert.ok((await client.rpc("finalize_rab_supplier_disposition",args)).error);
      assert.equal((await client.from("stock_opname_projects").select("selected_price_source").eq("id",rabId).single()).data?.selected_price_source,"estimate");
      assert.equal((await client.rpc("finalize_rab_supplier_disposition",{...args,_source:a})).error,null);
      const saved=await client.from("stock_opname_projects").select("*,stock_opname_items(*)").eq("id",rabId).single();
      assert.equal(saved.data?.selected_price_source,a); assert.ok(saved.data?.finalized_at);
      assert.equal(saved.data?.stock_opname_items.length,2);
      assert.equal(saved.data?.stock_opname_items.find((i:{description:string})=>i.description==="Aktif").unit_price,80);
      assert.equal(saved.data?.stock_opname_items.find((i:{description:string})=>i.description==="Aktif").estimated_unit_price,100);
      assert.deepEqual(saved.data?.contractor_quotes.map((c:{amount:number})=>c.amount),[200,160]);
      assert.ok((await client.from("stock_opname_items").update({is_cancelled:true}).eq("id",active.id)).error);
      const actual=await client.from("stock_opname_items").update({actual_quantity:1}).eq("id",active.id);
      if(role==="purchasing") assert.ok(actual.error); else assert.equal(actual.error,null);
      assert.equal((await client.rpc("reopen_rab_revision",{_rab_id:rabId,_reason:"Ganti sumber harga"})).error,null);
      assert.equal((await client.rpc("finalize_rab_supplier_disposition",{...args,_source:"estimate"})).error,null);
      assert.equal((await client.from("stock_opname_items").select("unit_price").eq("id",active.id).single()).data?.unit_price,100);
    } finally {
      if(rabId) assert.equal((await admin.from("stock_opname_projects").delete().eq("id",rabId)).error,null);
      if(userId) assert.equal((await admin.auth.admin.deleteUser(userId)).error,null);
    }
  }
});