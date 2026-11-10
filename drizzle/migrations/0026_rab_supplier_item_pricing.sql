ALTER TABLE public.stock_opname_projects ADD COLUMN suppliers jsonb NOT NULL DEFAULT '[]'::jsonb, ADD COLUMN selected_price_source text NOT NULL DEFAULT 'estimate';
ALTER TABLE public.stock_opname_items ADD COLUMN estimated_unit_price numeric, ADD COLUMN supplier_prices jsonb NOT NULL DEFAULT '{}'::jsonb, ADD COLUMN is_cancelled boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.validate_rab_item_prices() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE entry record; p record;
BEGIN
 SELECT * INTO p FROM public.stock_opname_projects WHERE id=NEW.rab_id FOR UPDATE;
 IF NEW.estimated_unit_price IS NOT NULL AND (NEW.estimated_unit_price::text IN ('NaN','Infinity','-Infinity') OR NEW.estimated_unit_price<0 OR NEW.estimated_unit_price>100000000000000) THEN RAISE EXCEPTION 'Harga perkiraan tidak valid.'; END IF;
 IF jsonb_typeof(NEW.supplier_prices) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Harga supplier tidak valid.'; END IF;
 FOR entry IN SELECT * FROM jsonb_each(NEW.supplier_prices) LOOP
 IF jsonb_typeof(entry.value) IS DISTINCT FROM 'number' OR entry.value::text::numeric<0 OR entry.value::text::numeric>100000000000000 THEN RAISE EXCEPTION 'Harga supplier tidak valid.'; END IF;
 END LOOP;
 IF p.finalized_at IS NULL AND p.selected_price_source='estimate' AND (TG_OP='INSERT' OR NEW.unit_price IS DISTINCT FROM OLD.unit_price) THEN NEW.estimated_unit_price:=NEW.unit_price; END IF;
 IF p.finalized_at IS NOT NULL AND (NEW.is_cancelled OR EXISTS(SELECT 1 FROM public.stock_opname_items WHERE id=NEW.parent_id AND is_cancelled)) AND TG_OP='UPDATE' AND NEW.actual_quantity IS DISTINCT FROM OLD.actual_quantity THEN RAISE EXCEPTION 'Item batal tidak digunakan dalam stock opname.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_rab_item_prices BEFORE INSERT OR UPDATE ON public.stock_opname_items FOR EACH ROW EXECUTE FUNCTION public.validate_rab_item_prices();
CREATE OR REPLACE FUNCTION public.validate_rab_supplier_selection() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE entry jsonb; price numeric; i record; supplier_id text;
BEGIN
 IF jsonb_typeof(NEW.suppliers) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Supplier tidak valid.'; END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(NEW.suppliers) LOOP
 IF jsonb_typeof(entry) IS DISTINCT FROM 'object' OR jsonb_typeof(entry->'name') IS DISTINCT FROM 'string' OR btrim(entry->>'name')='' OR length(entry->>'name')>150 OR (entry->>'id') IS NULL THEN RAISE EXCEPTION 'Nama supplier wajib diisi.'; END IF;
 supplier_id:=(entry->>'id')::uuid::text;
 END LOOP;
 IF (SELECT count(*) FROM jsonb_array_elements(NEW.suppliers)) <> (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(NEW.suppliers)) THEN RAISE EXCEPTION 'Supplier duplikat.'; END IF;
 IF NEW.selected_price_source<>'estimate' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.suppliers) s WHERE s->>'id'=NEW.selected_price_source) THEN RAISE EXCEPTION 'Supplier pilihan tidak ditemukan.'; END IF;
 IF NEW.finalized_at IS NOT NULL AND OLD.finalized_at IS NULL THEN
 IF NOT EXISTS(SELECT 1 FROM public.stock_opname_items i WHERE i.rab_id=NEW.id AND NOT i.is_cancelled AND NOT EXISTS(SELECT 1 FROM public.stock_opname_items p WHERE p.id=i.parent_id AND p.is_cancelled) AND NOT EXISTS(SELECT 1 FROM public.stock_opname_items c WHERE c.parent_id=i.id)) THEN RAISE EXCEPTION 'RAB harus memiliki item aktif.'; END IF;
 FOR i IN SELECT * FROM public.stock_opname_items i WHERE i.rab_id=NEW.id AND NOT i.is_cancelled AND NOT EXISTS(SELECT 1 FROM public.stock_opname_items p WHERE p.id=i.parent_id AND p.is_cancelled) AND NOT EXISTS(SELECT 1 FROM public.stock_opname_items c WHERE c.parent_id=i.id) LOOP
 price:=CASE WHEN NEW.selected_price_source='estimate' THEN COALESCE(i.estimated_unit_price,i.unit_price) ELSE (i.supplier_prices->>NEW.selected_price_source)::numeric END;
 IF price IS NULL OR price IS DISTINCT FROM i.unit_price THEN RAISE EXCEPTION 'Harga item belum sesuai supplier pilihan.'; END IF;
 END LOOP;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER a_validate_rab_supplier_selection BEFORE INSERT OR UPDATE ON public.stock_opname_projects FOR EACH ROW EXECUTE FUNCTION public.validate_rab_supplier_selection();
CREATE OR REPLACE FUNCTION public.validate_rab_discount() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE subtotal numeric;
BEGIN
 IF NEW.discount_type='percent' AND NEW.discount_value>100 THEN RAISE EXCEPTION 'Diskon persen harus antara 0 dan 100.'; END IF;
 IF NEW.finalized_at IS NOT NULL THEN
 SELECT COALESCE(sum(round(i.quantity*i.unit_price,2)),0) INTO subtotal FROM public.stock_opname_items i WHERE i.rab_id=NEW.id AND NOT i.is_cancelled AND NOT EXISTS(SELECT 1 FROM public.stock_opname_items p WHERE p.id=i.parent_id AND p.is_cancelled) AND NOT EXISTS(SELECT 1 FROM public.stock_opname_items c WHERE c.parent_id=i.id);
 IF NEW.discount_type='rupiah' AND NEW.discount_value>subtotal THEN RAISE EXCEPTION 'Diskon rupiah tidak boleh melebihi total RAB sebelum PPN.'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.finalize_rab_supplier_disposition(_rab_id uuid,_source text,_vat_included boolean,_approvers jsonb,_acknowledgers jsonb,_note text,_work_days integer,_work_start_date date,_down_payment_percent numeric,_responsible_position text,_discount_type text,_discount_value numeric) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE p record; quotes jsonb; i record; price numeric;
BEGIN
 IF NOT(public.has_role(auth.uid(),'internal_audit') OR public.has_role(auth.uid(),'purchasing')) THEN RAISE EXCEPTION 'Akses finalisasi RAB ditolak.'; END IF;
 SELECT * INTO p FROM public.stock_opname_projects WHERE id=_rab_id FOR UPDATE;
 IF NOT FOUND OR p.finalized_at IS NOT NULL THEN RAISE EXCEPTION 'RAB tidak ditemukan atau sudah final.'; END IF;
 UPDATE public.stock_opname_projects SET selected_price_source=_source WHERE id=_rab_id;
 FOR i IN SELECT * FROM public.stock_opname_items i WHERE i.rab_id=_rab_id AND NOT i.is_cancelled AND NOT EXISTS(SELECT 1 FROM public.stock_opname_items parent WHERE parent.id=i.parent_id AND parent.is_cancelled) AND NOT EXISTS(SELECT 1 FROM public.stock_opname_items c WHERE c.parent_id=i.id) LOOP
 price:=CASE WHEN _source='estimate' THEN COALESCE(i.estimated_unit_price,i.unit_price) ELSE (i.supplier_prices->>_source)::numeric END;
 IF price IS NULL THEN RAISE EXCEPTION 'Harga supplier belum lengkap pada item %.',i.description; END IF;
 UPDATE public.stock_opname_items SET estimated_unit_price=COALESCE(estimated_unit_price,unit_price),unit_price=price WHERE id=i.id;
 END LOOP;
 SELECT jsonb_agg(jsonb_build_object('name',s.name,'amount',s.amount)) INTO quotes FROM (
 SELECT 'Perkiraan Pembelian' AS name, COALESCE(sum(round(i.quantity*COALESCE(i.estimated_unit_price,i.unit_price),2)),0) AS amount FROM public.stock_opname_items i WHERE i.rab_id=_rab_id AND NOT i.is_cancelled AND NOT EXISTS(SELECT 1 FROM public.stock_opname_items parent WHERE parent.id=i.parent_id AND parent.is_cancelled) AND NOT EXISTS(SELECT 1 FROM public.stock_opname_items c WHERE c.parent_id=i.id)
 UNION ALL
 SELECT supplier->>'name',sum(round(i.quantity*(i.supplier_prices->>(supplier->>'id'))::numeric,2)) FROM jsonb_array_elements(p.suppliers) supplier CROSS JOIN public.stock_opname_items i WHERE i.rab_id=_rab_id AND NOT i.is_cancelled AND NOT EXISTS(SELECT 1 FROM public.stock_opname_items parent WHERE parent.id=i.parent_id AND parent.is_cancelled) AND NOT EXISTS(SELECT 1 FROM public.stock_opname_items c WHERE c.parent_id=i.id) GROUP BY supplier HAVING count(*)=count(i.supplier_prices->>(supplier->>'id'))
 ) s;
 PERFORM public.finalize_rab_discounted_disposition(_rab_id,_vat_included,quotes,_approvers,_acknowledgers,_note,_work_days,_work_start_date,_down_payment_percent,_responsible_position,_discount_type,_discount_value);
END $$;
REVOKE ALL ON FUNCTION public.finalize_rab_supplier_disposition(uuid,text,boolean,jsonb,jsonb,text,integer,date,numeric,text,text,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finalize_rab_supplier_disposition(uuid,text,boolean,jsonb,jsonb,text,integer,date,numeric,text,text,numeric) TO authenticated;