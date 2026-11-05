ALTER TABLE public.stock_opname_projects ADD COLUMN revision_number integer NOT NULL DEFAULT 0 CHECK (revision_number >= 0), ADD COLUMN signed_locked_at timestamptz;
CREATE TABLE public.rab_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), rab_id uuid NOT NULL REFERENCES public.stock_opname_projects(id) ON DELETE CASCADE,
 revision_number integer NOT NULL CHECK (revision_number > 0), reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 5000),
 created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(rab_id,revision_number)
);
GRANT SELECT ON public.rab_revisions TO authenticated;
GRANT ALL ON public.rab_revisions TO service_role;
ALTER TABLE public.rab_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stock roles read revision history" ON public.rab_revisions FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'internal_audit') OR public.has_role(auth.uid(),'purchasing'));
CREATE FUNCTION public.protect_rab_revision_state() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.revision_number <> 0 OR NEW.signed_locked_at IS NOT NULL THEN RAISE EXCEPTION 'Status revisi tidak dapat diisi langsung.'; END IF;
 ELSE
  IF OLD.signed_locked_at IS NOT NULL AND (NEW.signed_locked_at IS DISTINCT FROM OLD.signed_locked_at OR NEW.finalized_at IS NULL) THEN RAISE EXCEPTION 'RAB ditandatangani terkunci permanen.'; END IF;
  IF current_user <> 'postgres' AND (NEW.revision_number IS DISTINCT FROM OLD.revision_number OR NEW.signed_locked_at IS DISTINCT FROM OLD.signed_locked_at OR (OLD.finalized_at IS NOT NULL AND NEW.finalized_at IS NULL)) THEN RAISE EXCEPTION 'Gunakan pembukaan revisi dengan alasan.'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER aa_protect_rab_revision_state BEFORE INSERT OR UPDATE ON public.stock_opname_projects FOR EACH ROW EXECUTE FUNCTION public.protect_rab_revision_state();
DO $$ DECLARE body text; BEGIN
 SELECT pg_get_functiondef('public.protect_finalized_rab_project()'::regprocedure) INTO body;
 body := replace(body, 'IF TG_OP <> ''INSERT'' AND OLD.finalized_at IS NOT NULL THEN', 'IF TG_OP = ''UPDATE'' AND current_user = ''postgres'' AND (to_jsonb(NEW) - ARRAY[''finalized_at'',''revision_number'',''signed_locked_at'',''finalization_draft'',''work_end_date'']) IS NOT DISTINCT FROM (to_jsonb(OLD) - ARRAY[''finalized_at'',''revision_number'',''signed_locked_at'',''finalization_draft'',''work_end_date'']) THEN RETURN NEW; END IF;
  IF TG_OP <> ''INSERT'' AND OLD.finalized_at IS NOT NULL THEN');
 EXECUTE body;
END $$;
CREATE FUNCTION public.reopen_rab_revision(_rab_id uuid, _reason text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rab public.stock_opname_projects; next_revision integer;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'internal_audit') OR public.has_role(auth.uid(),'purchasing')) THEN RAISE EXCEPTION 'Akses revisi RAB ditolak.'; END IF;
 IF _reason IS NULL OR length(btrim(_reason)) NOT BETWEEN 1 AND 5000 THEN RAISE EXCEPTION 'Keterangan alasan revisi wajib diisi (maksimal 5000 karakter).'; END IF;
 SELECT * INTO rab FROM public.stock_opname_projects WHERE id=_rab_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'RAB tidak ditemukan.'; END IF;
 IF rab.signed_locked_at IS NOT NULL OR EXISTS(SELECT 1 FROM public.rab_approval_documents WHERE rab_id=_rab_id) THEN RAISE EXCEPTION 'RAB ditandatangani terkunci permanen dan tidak dapat direvisi.'; END IF;
 IF rab.finalized_at IS NULL THEN RAISE EXCEPTION 'RAB sudah terbuka; finalisasi dahulu sebelum revisi berikutnya.'; END IF;
 next_revision := rab.revision_number + 1;
 INSERT INTO public.rab_revisions(rab_id,revision_number,reason,created_by) VALUES (_rab_id,next_revision,btrim(_reason),auth.uid());
 UPDATE public.stock_opname_projects SET finalized_at=NULL, revision_number=next_revision, finalization_draft=NULL WHERE id=_rab_id;
 RETURN next_revision;
END; $$;
REVOKE ALL ON FUNCTION public.reopen_rab_revision(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reopen_rab_revision(uuid,text) TO authenticated;
CREATE FUNCTION public.lock_signed_rab() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rab public.stock_opname_projects;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'internal_audit') OR public.has_role(auth.uid(),'purchasing')) THEN RAISE EXCEPTION 'Akses PDF persetujuan ditolak.'; END IF;
 SELECT * INTO rab FROM public.stock_opname_projects WHERE id=NEW.rab_id FOR UPDATE;
 IF NOT FOUND OR rab.finalized_at IS NULL THEN RAISE EXCEPTION 'Finalisasi RAB sebelum mengunggah PDF ditandatangani.'; END IF;
 UPDATE public.stock_opname_projects SET signed_locked_at=coalesce(signed_locked_at,clock_timestamp()) WHERE id=NEW.rab_id;
 RETURN NEW;
END; $$;
CREATE TRIGGER lock_signed_rab BEFORE INSERT ON public.rab_approval_documents FOR EACH ROW EXECUTE FUNCTION public.lock_signed_rab();
UPDATE public.stock_opname_projects p SET signed_locked_at=d.created_at FROM (SELECT rab_id,min(created_at) AS created_at FROM public.rab_approval_documents GROUP BY rab_id) d WHERE p.id=d.rab_id;
REVOKE ALL ON FUNCTION public.lock_signed_rab() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_rab_revision_state() FROM PUBLIC;