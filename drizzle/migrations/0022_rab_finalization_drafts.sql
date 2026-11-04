ALTER TABLE public.stock_opname_projects ADD COLUMN finalization_draft jsonb;
COMMENT ON COLUMN public.stock_opname_projects.finalization_draft IS 'Editable partial finalization inputs; does not finalize or change the approved budget.';
CREATE OR REPLACE FUNCTION public.save_rab_finalization_draft(_rab_id uuid, _draft jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE locked_at timestamptz;
BEGIN
 IF NOT (public.has_role(auth.uid(), 'internal_audit') OR public.has_role(auth.uid(), 'purchasing')) THEN RAISE EXCEPTION 'Akses draft finalisasi ditolak.'; END IF;
 SELECT finalized_at INTO locked_at FROM public.stock_opname_projects WHERE id = _rab_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'RAB tidak ditemukan.'; END IF;
 IF locked_at IS NOT NULL THEN RAISE EXCEPTION 'RAB sudah final dan tidak dapat diubah.'; END IF;
 IF _draft IS NULL OR jsonb_typeof(_draft) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Draft tidak valid.'; END IF;
 UPDATE public.stock_opname_projects SET finalization_draft = _draft WHERE id = _rab_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_rab_finalization_draft(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_rab_finalization_draft(uuid,jsonb) TO authenticated;