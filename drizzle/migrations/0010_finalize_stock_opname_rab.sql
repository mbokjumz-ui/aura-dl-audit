ALTER TABLE public.stock_opname_projects
  ADD COLUMN finalized_at timestamptz,
  ADD COLUMN vat_included boolean NOT NULL DEFAULT false,
  ADD COLUMN contractor_quotes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN approvers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN acknowledgers jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.protect_finalized_rab_project()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE entry jsonb;
BEGIN
  IF TG_OP <> 'INSERT' AND OLD.finalized_at IS NOT NULL THEN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'RAB final tidak dapat dihapus.'; END IF;
    IF (to_jsonb(NEW) - ARRAY['status','completed_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','completed_at']) THEN
      RAISE EXCEPTION 'RAB sudah final dan tidak dapat diubah.';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF NEW.finalized_at IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN RAISE EXCEPTION 'Buat rincian RAB sebelum finalisasi.'; END IF;
    IF NOT (public.has_role(auth.uid(), 'internal_audit') OR public.has_role(auth.uid(), 'purchasing')) THEN RAISE EXCEPTION 'Akses finalisasi RAB ditolak.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.stock_opname_items i WHERE i.rab_id = NEW.id AND NOT EXISTS (SELECT 1 FROM public.stock_opname_items c WHERE c.parent_id = i.id)) THEN RAISE EXCEPTION 'RAB harus memiliki poin pengerjaan.'; END IF;
    IF jsonb_typeof(NEW.contractor_quotes) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Masukkan 1–3 penawaran kontraktor.'; END IF;
    IF jsonb_array_length(NEW.contractor_quotes) NOT BETWEEN 1 AND 3 THEN RAISE EXCEPTION 'Masukkan 1–3 penawaran kontraktor.'; END IF;
    FOR entry IN SELECT value FROM jsonb_array_elements(NEW.contractor_quotes) LOOP
      IF jsonb_typeof(entry) IS DISTINCT FROM 'object' OR jsonb_typeof(entry->'name') IS DISTINCT FROM 'string' OR btrim(entry->>'name') = '' OR length(entry->>'name') > 150 OR jsonb_typeof(entry->'amount') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Nama dan nilai penawaran kontraktor wajib diisi.'; END IF;
      IF (entry->>'amount')::numeric < 0 OR (entry->>'amount')::numeric > 100000000000000 THEN RAISE EXCEPTION 'Nilai penawaran tidak valid.'; END IF;
    END LOOP;
    IF jsonb_typeof(NEW.approvers) IS DISTINCT FROM 'array' OR jsonb_typeof(NEW.acknowledgers) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Masukkan 1–2 pihak menyetujui dan 1–2 pihak mengetahui.'; END IF;
    IF jsonb_array_length(NEW.approvers) NOT BETWEEN 1 AND 2 OR jsonb_array_length(NEW.acknowledgers) NOT BETWEEN 1 AND 2 THEN RAISE EXCEPTION 'Masukkan 1–2 pihak menyetujui dan 1–2 pihak mengetahui.'; END IF;
    FOR entry IN SELECT value FROM jsonb_array_elements(NEW.approvers || NEW.acknowledgers) LOOP
      IF jsonb_typeof(entry) IS DISTINCT FROM 'object' OR jsonb_typeof(entry->'name') IS DISTINCT FROM 'string' OR jsonb_typeof(entry->'position') IS DISTINCT FROM 'string' OR btrim(entry->>'name') = '' OR btrim(entry->>'position') = '' OR length(entry->>'name') > 150 OR length(entry->>'position') > 150 THEN RAISE EXCEPTION 'Nama dan jabatan pihak menyetujui/mengetahui wajib diisi.'; END IF;
    END LOOP;
    NEW.finalized_at := clock_timestamp();
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_finalized_rab_project BEFORE INSERT OR UPDATE OR DELETE ON public.stock_opname_projects FOR EACH ROW EXECUTE FUNCTION public.protect_finalized_rab_project();

CREATE OR REPLACE FUNCTION public.protect_finalized_rab_item()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE old_rab uuid; new_rab uuid; locked record; is_final boolean := false;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_rab := OLD.rab_id; END IF;
  IF TG_OP <> 'DELETE' THEN new_rab := NEW.rab_id; END IF;
  FOR locked IN SELECT id, finalized_at FROM public.stock_opname_projects WHERE id IN (old_rab, new_rab) ORDER BY id FOR UPDATE LOOP
    IF locked.finalized_at IS NOT NULL THEN is_final := true; END IF;
  END LOOP;
  IF is_final THEN
    IF TG_OP <> 'UPDATE' THEN RAISE EXCEPTION 'Poin RAB final tidak dapat ditambah atau dihapus.'; END IF;
    IF (to_jsonb(NEW) - 'actual_quantity') IS DISTINCT FROM (to_jsonb(OLD) - 'actual_quantity') THEN RAISE EXCEPTION 'Poin RAB sudah final dan tidak dapat diubah.'; END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_finalized_rab_item BEFORE INSERT OR UPDATE OR DELETE ON public.stock_opname_items FOR EACH ROW EXECUTE FUNCTION public.protect_finalized_rab_item();

CREATE OR REPLACE FUNCTION public.finalize_stock_opname_rab(_rab_id uuid, _vat_included boolean, _contractor_quotes jsonb, _approvers jsonb, _acknowledgers jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE current_finalized timestamptz;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'internal_audit') OR public.has_role(auth.uid(), 'purchasing')) THEN RAISE EXCEPTION 'Akses finalisasi RAB ditolak.'; END IF;
  SELECT finalized_at INTO current_finalized FROM public.stock_opname_projects WHERE id = _rab_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RAB tidak ditemukan.'; END IF;
  IF current_finalized IS NOT NULL THEN RAISE EXCEPTION 'RAB sudah final.'; END IF;
  UPDATE public.stock_opname_projects SET finalized_at = clock_timestamp(), vat_included = _vat_included, contractor_quotes = _contractor_quotes, approvers = _approvers, acknowledgers = _acknowledgers WHERE id = _rab_id;
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_stock_opname_rab(uuid, boolean, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_stock_opname_rab(uuid, boolean, jsonb, jsonb, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.protect_finalized_rab_project() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_finalized_rab_item() FROM PUBLIC, anon, authenticated;