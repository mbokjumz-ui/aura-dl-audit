ALTER TABLE public.stock_opname_projects ADD COLUMN work_duration_days integer, ADD COLUMN work_start_date date, ADD COLUMN work_end_date date GENERATED ALWAYS AS (work_start_date + (work_duration_days - 1)) STORED;
ALTER TABLE public.stock_opname_projects ADD CONSTRAINT valid_rab_work_schedule CHECK ((work_duration_days IS NULL AND work_start_date IS NULL) OR (work_duration_days IS NOT NULL AND work_duration_days > 0 AND work_start_date IS NOT NULL AND work_start_date >= DATE '0001-01-01' AND work_start_date + (work_duration_days - 1) <= DATE '9999-12-31'));
CREATE FUNCTION public.finalize_rab_scheduled_disposition(_rab_id uuid, _vat_included boolean, _contractor_quotes jsonb, _approvers jsonb, _acknowledgers jsonb, _note text, _work_days integer, _work_start_date date, _down_payment_percent numeric, _responsible_position text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path TO public AS $$
DECLARE current_finalized timestamptz;
BEGIN
 IF NOT (public.has_role(auth.uid(), 'internal_audit') OR public.has_role(auth.uid(), 'purchasing')) THEN RAISE EXCEPTION 'Akses finalisasi RAB ditolak.'; END IF;
 SELECT finalized_at INTO current_finalized FROM public.stock_opname_projects WHERE id=_rab_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'RAB tidak ditemukan.'; END IF;
 IF current_finalized IS NOT NULL THEN RAISE EXCEPTION 'RAB sudah final.'; END IF;
 IF _work_days IS NULL OR _work_days < 1 OR _work_start_date IS NULL THEN RAISE EXCEPTION 'Masukkan jumlah hari positif dan tanggal mulai.'; END IF;
 UPDATE public.stock_opname_projects SET work_duration_days=_work_days, work_start_date=_work_start_date WHERE id=_rab_id;
 PERFORM public.finalize_rab_disposition(_rab_id,_vat_included,_contractor_quotes,_approvers,_acknowledgers,_note,_work_days::text || ' hari kalender',_down_payment_percent,_responsible_position);
END; $$;
REVOKE ALL ON FUNCTION public.finalize_rab_scheduled_disposition(uuid,boolean,jsonb,jsonb,jsonb,text,integer,date,numeric,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finalize_rab_scheduled_disposition(uuid,boolean,jsonb,jsonb,jsonb,text,integer,date,numeric,text) TO authenticated;
DO $maintenance$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('public.protect_finalized_rab_project()'::regprocedure) INTO definition;
 definition := replace(definition, 'BEGIN', 'BEGIN
  -- One-time user-requested maintenance, unavailable to application roles.
  IF current_user = ''postgres'' AND auth.uid() IS NULL AND TG_OP = ''UPDATE'' AND OLD.id = ''66bf8ba4-6856-4307-8dac-fe382d39c734''::uuid AND OLD.finalized_at = ''2026-10-30 02:55:17.843587+00''::timestamptz AND NEW.finalized_at IS NULL AND (to_jsonb(NEW) - ''finalized_at'') = (to_jsonb(OLD) - ''finalized_at'') THEN RETURN NEW; END IF;');
 EXECUTE definition;
END; $maintenance$;