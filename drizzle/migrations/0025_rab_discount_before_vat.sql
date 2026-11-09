ALTER TABLE public.stock_opname_projects ADD COLUMN discount_type text NOT NULL DEFAULT 'rupiah' CHECK (discount_type IN ('rupiah','percent')), ADD COLUMN discount_value numeric NOT NULL DEFAULT 0 CHECK (discount_value >= 0 AND discount_value <= 100000000000000 AND discount_value::text NOT IN ('NaN','Infinity','-Infinity'));
CREATE FUNCTION public.validate_rab_discount() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE subtotal numeric;
BEGIN
 IF NEW.discount_type='percent' AND NEW.discount_value>100 THEN RAISE EXCEPTION 'Diskon persen harus antara 0 dan 100.'; END IF;
 IF NEW.finalized_at IS NOT NULL THEN
 SELECT COALESCE(sum(round(i.quantity*i.unit_price,2)),0) INTO subtotal FROM public.stock_opname_items i WHERE i.rab_id=NEW.id AND NOT EXISTS (SELECT 1 FROM public.stock_opname_items c WHERE c.parent_id=i.id);
 IF NEW.discount_type='rupiah' AND NEW.discount_value>subtotal THEN RAISE EXCEPTION 'Diskon rupiah tidak boleh melebihi total RAB sebelum PPN.'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER validate_rab_discount BEFORE INSERT OR UPDATE ON public.stock_opname_projects FOR EACH ROW EXECUTE FUNCTION public.validate_rab_discount();
REVOKE ALL ON FUNCTION public.validate_rab_discount() FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.finalize_rab_discounted_disposition(_rab_id uuid, _vat_included boolean, _contractor_quotes jsonb, _approvers jsonb, _acknowledgers jsonb, _note text, _work_days integer, _work_start_date date, _down_payment_percent numeric, _responsible_position text, _discount_type text, _discount_value numeric) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE locked_at timestamptz;
BEGIN
 IF NOT (public.has_role(auth.uid(),'internal_audit') OR public.has_role(auth.uid(),'purchasing')) THEN RAISE EXCEPTION 'Akses finalisasi RAB ditolak.'; END IF;
 SELECT finalized_at INTO locked_at FROM public.stock_opname_projects WHERE id=_rab_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'RAB tidak ditemukan.'; END IF;
 IF locked_at IS NOT NULL THEN RAISE EXCEPTION 'RAB sudah final.'; END IF;
 IF _discount_type IS NULL OR _discount_type NOT IN ('rupiah','percent') OR _discount_value IS NULL OR _discount_value::text IN ('NaN','Infinity','-Infinity') OR _discount_value<0 THEN RAISE EXCEPTION 'Diskon tidak valid.'; END IF;
 UPDATE public.stock_opname_projects SET discount_type=_discount_type, discount_value=_discount_value WHERE id=_rab_id;
 PERFORM public.finalize_rab_scheduled_disposition(_rab_id,_vat_included,_contractor_quotes,_approvers,_acknowledgers,_note,_work_days,_work_start_date,_down_payment_percent,_responsible_position);
END; $$;
REVOKE ALL ON FUNCTION public.finalize_rab_discounted_disposition(uuid,boolean,jsonb,jsonb,jsonb,text,integer,date,numeric,text,text,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_rab_discounted_disposition(uuid,boolean,jsonb,jsonb,jsonb,text,integer,date,numeric,text,text,numeric) TO authenticated;