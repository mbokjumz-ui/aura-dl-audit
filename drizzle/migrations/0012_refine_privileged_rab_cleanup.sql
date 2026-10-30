DROP TRIGGER aa_privileged_rab_cleanup ON public.stock_opname_projects;
CREATE OR REPLACE FUNCTION public.protect_finalized_rab_project()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE entry jsonb;
BEGIN
  IF TG_OP = 'DELETE' AND auth.role() = 'service_role' THEN RETURN OLD; END IF;
  IF TG_OP <> 'INSERT' AND OLD.finalized_at IS NOT NULL THEN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'RAB final tidak dapat dihapus.'; END IF;
    IF (to_jsonb(NEW) - ARRAY['status','completed_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','completed_at']) THEN RAISE EXCEPTION 'RAB sudah final dan tidak dapat diubah.'; END IF;
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