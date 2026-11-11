CREATE OR REPLACE FUNCTION public.validate_rab_supplier_selection() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE entry jsonb; price numeric; v_item record; supplier_id text;
BEGIN
 IF jsonb_typeof(NEW.suppliers) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Supplier tidak valid.'; END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(NEW.suppliers) LOOP
 IF jsonb_typeof(entry) IS DISTINCT FROM 'object' OR jsonb_typeof(entry->'name') IS DISTINCT FROM 'string' OR btrim(entry->>'name')='' OR length(entry->>'name')>150 OR (entry->>'id') IS NULL THEN RAISE EXCEPTION 'Nama supplier wajib diisi.'; END IF;
 supplier_id:=(entry->>'id')::uuid::text;
 END LOOP;
 IF (SELECT count(*) FROM jsonb_array_elements(NEW.suppliers)) <> (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(NEW.suppliers)) THEN RAISE EXCEPTION 'Supplier duplikat.'; END IF;
 IF NEW.selected_price_source<>'estimate' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.suppliers) s WHERE s->>'id'=NEW.selected_price_source) THEN RAISE EXCEPTION 'Supplier pilihan tidak ditemukan.'; END IF;
 IF TG_OP='UPDATE' AND NEW.finalized_at IS NOT NULL AND OLD.finalized_at IS NULL THEN
 IF NOT EXISTS(SELECT 1 FROM public.stock_opname_items i WHERE i.rab_id=NEW.id AND NOT i.is_cancelled AND NOT EXISTS(SELECT 1 FROM public.stock_opname_items p WHERE p.id=i.parent_id AND p.is_cancelled) AND NOT EXISTS(SELECT 1 FROM public.stock_opname_items c WHERE c.parent_id=i.id)) THEN RAISE EXCEPTION 'RAB harus memiliki item aktif.'; END IF;
 FOR v_item IN SELECT * FROM public.stock_opname_items i WHERE i.rab_id=NEW.id AND NOT i.is_cancelled AND NOT EXISTS(SELECT 1 FROM public.stock_opname_items p WHERE p.id=i.parent_id AND p.is_cancelled) AND NOT EXISTS(SELECT 1 FROM public.stock_opname_items c WHERE c.parent_id=i.id) LOOP
 price:=CASE WHEN NEW.selected_price_source='estimate' THEN COALESCE(v_item.estimated_unit_price,v_item.unit_price) ELSE (v_item.supplier_prices->>NEW.selected_price_source)::numeric END;
 IF price IS NULL OR price IS DISTINCT FROM v_item.unit_price THEN RAISE EXCEPTION 'Harga item belum sesuai supplier pilihan.'; END IF;
 END LOOP;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.finalize_rab_supplier_disposition(_rab_id uuid,_source text,_vat_included boolean,_approvers jsonb,_acknowledgers jsonb,_note text,_work_days integer,_work_start_date date,_down_payment_percent numeric,_responsible_position text,_discount_type text,_discount_value numeric) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE p record; quotes jsonb; v_item record; price numeric;
BEGIN
 IF NOT(public.has_role(auth.uid(),'internal_audit') OR public.has_role(auth.uid(),'purchasing')) THEN RAISE EXCEPTION 'Akses finalisasi RAB ditolak.'; END IF;
 SELECT * INTO p FROM public.stock_opname_projects WHERE id=_rab_id FOR UPDATE;
 IF NOT FOUND OR p.finalized_at IS NOT NULL THEN RAISE EXCEPTION 'RAB tidak ditemukan atau sudah final.'; END IF;
 UPDATE public.stock_opname_projects SET selected_price_source=_source WHERE id=_rab_id;
 FOR v_item IN SELECT * FROM public.stock_opname_items i WHERE i.rab_id=_rab_id AND NOT i.is_cancelled AND NOT EXISTS(SELECT 1 FROM public.stock_opname_items parent WHERE parent.id=i.parent_id AND parent.is_cancelled) AND NOT EXISTS(SELECT 1 FROM public.stock_opname_items c WHERE c.parent_id=i.id) LOOP
 price:=CASE WHEN _source='estimate' THEN COALESCE(v_item.estimated_unit_price,v_item.unit_price) ELSE (v_item.supplier_prices->>_source)::numeric END;
 IF price IS NULL THEN RAISE EXCEPTION 'Harga supplier belum lengkap pada item %.',v_item.description; END IF;
 UPDATE public.stock_opname_items SET estimated_unit_price=COALESCE(estimated_unit_price,unit_price),unit_price=price WHERE id=v_item.id;
 END LOOP;
 SELECT jsonb_agg(jsonb_build_object('name',s.name,'amount',s.amount) ORDER BY s.ord) INTO quotes FROM (
 SELECT 0::bigint AS ord,'Perkiraan Pembelian' AS name, COALESCE(sum(round(i.quantity*COALESCE(i.estimated_unit_price,i.unit_price),2)),0) AS amount FROM public.stock_opname_items i WHERE i.rab_id=_rab_id AND NOT i.is_cancelled AND NOT EXISTS(SELECT 1 FROM public.stock_opname_items parent WHERE parent.id=i.parent_id AND parent.is_cancelled) AND NOT EXISTS(SELECT 1 FROM public.stock_opname_items c WHERE c.parent_id=i.id)
 UNION ALL
 SELECT supplier.ord,supplier.value->>'name',sum(round(i.quantity*(i.supplier_prices->>(supplier.value->>'id'))::numeric,2)) FROM jsonb_array_elements(p.suppliers) WITH ORDINALITY supplier(value,ord) CROSS JOIN public.stock_opname_items i WHERE i.rab_id=_rab_id AND NOT i.is_cancelled AND NOT EXISTS(SELECT 1 FROM public.stock_opname_items parent WHERE parent.id=i.parent_id AND parent.is_cancelled) AND NOT EXISTS(SELECT 1 FROM public.stock_opname_items c WHERE c.parent_id=i.id) GROUP BY supplier.value,supplier.ord HAVING count(*)=count(i.supplier_prices->>(supplier.value->>'id'))
 ) s;
 PERFORM public.finalize_rab_discounted_disposition(_rab_id,_vat_included,quotes,_approvers,_acknowledgers,_note,_work_days,_work_start_date,_down_payment_percent,_responsible_position,_discount_type,_discount_value);
END $$;