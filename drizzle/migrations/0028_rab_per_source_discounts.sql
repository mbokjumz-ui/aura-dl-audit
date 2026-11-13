ALTER TABLE public.stock_opname_projects ADD COLUMN source_discounts jsonb;
COMMENT ON COLUMN public.stock_opname_projects.source_discounts IS 'Per-source discounts; null retains legacy selected-source discount and draft. discount_type/value remain final snapshots.';
CREATE FUNCTION public.rab_source_discount(_discounts jsonb,_source text,_selected text,_type text,_value numeric,_draft jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT CASE WHEN _discounts IS NOT NULL THEN COALESCE(_discounts->_source,jsonb_build_object('discount_type','rupiah','discount_value',0)) WHEN _draft->>'discountType' IN ('rupiah','percent') AND COALESCE(_draft->>'discountValue','') ~ '^[0-9]+(\.[0-9]+)?$' AND _source=COALESCE(_draft->>'selectedPriceSource',_selected) THEN jsonb_build_object('discount_type',_draft->>'discountType','discount_value',(_draft->>'discountValue')::numeric) WHEN _source=_selected THEN jsonb_build_object('discount_type',_type,'discount_value',_value) ELSE jsonb_build_object('discount_type','rupiah','discount_value',0) END $$;
CREATE FUNCTION public.validate_rab_source_discounts() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ DECLARE entry record; v numeric; BEGIN
 IF TG_OP='UPDATE' AND OLD.finalized_at IS NOT NULL AND NEW.source_discounts IS DISTINCT FROM OLD.source_discounts THEN RAISE EXCEPTION 'Diskon RAB final tidak dapat diubah.'; END IF;
 IF NEW.source_discounts IS NULL THEN RETURN NEW; END IF;
 IF jsonb_typeof(NEW.source_discounts) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Diskon tidak valid.'; END IF;
 FOR entry IN SELECT * FROM jsonb_each(NEW.source_discounts) LOOP
 IF entry.key<>'estimate' THEN PERFORM entry.key::uuid; END IF;
 IF jsonb_typeof(entry.value) IS DISTINCT FROM 'object' OR (entry.value->>'discount_type') IS NULL OR entry.value->>'discount_type' NOT IN ('rupiah','percent') OR jsonb_typeof(entry.value->'discount_value') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Diskon tidak valid.'; END IF;
 v:=(entry.value->>'discount_value')::numeric;
 IF v<0 OR v>100000000000000 OR (entry.value->>'discount_type'='percent' AND v>100) THEN RAISE EXCEPTION 'Diskon tidak valid.'; END IF;
 END LOOP; RETURN NEW; END $$;
CREATE TRIGGER validate_rab_source_discounts BEFORE INSERT OR UPDATE ON public.stock_opname_projects FOR EACH ROW EXECUTE FUNCTION public.validate_rab_source_discounts();
CREATE FUNCTION public.save_rab_source_discount(_rab_id uuid,_source text,_discount_type text,_discount_value numeric) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$ DECLARE p record; subtotal numeric; incomplete boolean; legacy_source text; BEGIN
 IF NOT(public.has_role(auth.uid(),'internal_audit') OR public.has_role(auth.uid(),'purchasing')) THEN RAISE EXCEPTION 'Akses diskon RAB ditolak.'; END IF;
 SELECT * INTO p FROM public.stock_opname_projects WHERE id=_rab_id FOR UPDATE;
 IF NOT FOUND OR p.finalized_at IS NOT NULL THEN RAISE EXCEPTION 'RAB tidak ditemukan atau sudah final.'; END IF;
 IF _source IS NULL OR (_source<>'estimate' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p.suppliers) s WHERE s->>'id'=_source)) THEN RAISE EXCEPTION 'Supplier tidak ditemukan.'; END IF;
 IF _discount_type IS NULL OR _discount_type NOT IN ('rupiah','percent') OR _discount_value IS NULL OR _discount_value::text IN ('NaN','Infinity','-Infinity') OR _discount_value<0 OR _discount_value>100000000000000 OR (_discount_type='percent' AND _discount_value>100) THEN RAISE EXCEPTION 'Diskon tidak valid.'; END IF;
 SELECT COALESCE(sum(round(i.quantity*CASE WHEN _source='estimate' THEN COALESCE(i.estimated_unit_price,i.unit_price) ELSE (i.supplier_prices->>_source)::numeric END,2)),0),COALESCE(bool_or(_source<>'estimate' AND (i.supplier_prices->>_source) IS NULL),false) INTO subtotal,incomplete FROM public.stock_opname_items i WHERE i.rab_id=_rab_id AND NOT i.is_cancelled AND NOT EXISTS(SELECT 1 FROM public.stock_opname_items p WHERE p.id=i.parent_id AND p.is_cancelled) AND NOT EXISTS(SELECT 1 FROM public.stock_opname_items c WHERE c.parent_id=i.id);
 IF _discount_type='rupiah' AND _discount_value>0 AND (incomplete OR _discount_value>subtotal) THEN RAISE EXCEPTION 'Lengkapi harga supplier; diskon rupiah tidak boleh melebihi total sebelum PPN.'; END IF;
 legacy_source:=COALESCE(p.finalization_draft->>'selectedPriceSource',p.selected_price_source);
 UPDATE public.stock_opname_projects SET source_discounts=COALESCE(p.source_discounts,jsonb_build_object(legacy_source,public.rab_source_discount(NULL,legacy_source,p.selected_price_source,p.discount_type,p.discount_value,p.finalization_draft)))||jsonb_build_object(_source,jsonb_build_object('discount_type',_discount_type,'discount_value',_discount_value)) WHERE id=_rab_id;
 END $$;
REVOKE ALL ON FUNCTION public.save_rab_source_discount(uuid,text,text,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_rab_source_discount(uuid,text,text,numeric) TO authenticated;
DO $$ DECLARE body text; BEGIN
 SELECT pg_get_functiondef('public.finalize_rab_supplier_disposition(uuid,text,boolean,jsonb,jsonb,text,integer,date,numeric,text,text,numeric)'::regprocedure) INTO body;
 body:=replace(body,'_responsible_position,_discount_type,_discount_value);','_responsible_position,public.rab_source_discount(p.source_discounts,_source,p.selected_price_source,p.discount_type,p.discount_value,p.finalization_draft)->>''discount_type'',(public.rab_source_discount(p.source_discounts,_source,p.selected_price_source,p.discount_type,p.discount_value,p.finalization_draft)->>''discount_value'')::numeric);'); EXECUTE body;
END $$;