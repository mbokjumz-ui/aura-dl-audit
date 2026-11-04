ALTER TABLE public.stock_opname_projects ADD COLUMN disposition_note text NOT NULL DEFAULT '', ADD COLUMN work_duration text NOT NULL DEFAULT '', ADD COLUMN down_payment_percent numeric NOT NULL DEFAULT 0 CHECK (down_payment_percent BETWEEN 0 AND 100), ADD COLUMN responsible_position text NOT NULL DEFAULT '';
CREATE OR REPLACE FUNCTION public.finalize_rab_disposition(_rab_id uuid, _vat_included boolean, _contractor_quotes jsonb, _approvers jsonb, _acknowledgers jsonb, _note text, _work_duration text, _down_payment_percent numeric, _responsible_position text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE current_finalized timestamptz;
BEGIN
 IF NOT (public.has_role(auth.uid(), 'internal_audit') OR public.has_role(auth.uid(), 'purchasing')) THEN RAISE EXCEPTION 'Akses finalisasi RAB ditolak.'; END IF;
 SELECT finalized_at INTO current_finalized FROM public.stock_opname_projects WHERE id = _rab_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'RAB tidak ditemukan.'; END IF;
 IF current_finalized IS NOT NULL THEN RAISE EXCEPTION 'RAB sudah final.'; END IF;
 IF _note IS NULL OR length(_note)>5000 OR _work_duration IS NULL OR length(_work_duration)>150 OR btrim(_work_duration)='' OR _responsible_position IS NULL OR length(_responsible_position)>150 OR btrim(_responsible_position)='' OR _down_payment_percent IS NULL OR _down_payment_percent NOT BETWEEN 0 AND 100 OR _down_payment_percent::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Lengkapi lama pekerjaan, jabatan penanggung jawab dan DP antara 0–100 persen.'; END IF;
 UPDATE public.stock_opname_projects SET disposition_note=btrim(_note), work_duration=btrim(_work_duration), down_payment_percent=_down_payment_percent, responsible_position=btrim(_responsible_position) WHERE id=_rab_id;
 PERFORM public.finalize_stock_opname_rab(_rab_id,_vat_included,_contractor_quotes,_approvers,_acknowledgers);
END; $$;
REVOKE ALL ON FUNCTION public.finalize_rab_disposition(uuid,boolean,jsonb,jsonb,jsonb,text,text,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_rab_disposition(uuid,boolean,jsonb,jsonb,jsonb,text,text,numeric,text) TO authenticated;