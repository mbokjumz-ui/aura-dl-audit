ALTER TABLE public.archive_findings ADD COLUMN source_project_id uuid;
CREATE UNIQUE INDEX archive_findings_source_project_unique ON public.archive_findings(source_project_id) WHERE source_project_id IS NOT NULL;
COMMENT ON COLUMN public.archive_findings.source_project_id IS 'Independent source identity for automatic completed-project archives; intentionally no foreign key so project deletion preserves archives.';
ALTER TABLE public.archive_documents ADD COLUMN source_document_id uuid;
CREATE UNIQUE INDEX archive_documents_source_unique ON public.archive_documents(finding_id, source_document_id) WHERE source_document_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.finish_archived_project(_project_id uuid, _finding_id uuid) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 PERFORM 1 FROM public.projects WHERE id = _project_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Project tidak ditemukan'; END IF;
 IF EXISTS (SELECT 1 FROM public.stage_documents d JOIN public.project_stages s ON s.id=d.stage_id WHERE s.project_id=_project_id) THEN
  IF NOT EXISTS (SELECT 1 FROM public.archive_findings WHERE id=_finding_id AND source_project_id=_project_id) THEN RAISE EXCEPTION 'Arsip Project belum tersedia'; END IF;
  IF EXISTS (SELECT 1 FROM public.stage_documents d JOIN public.project_stages s ON s.id=d.stage_id WHERE s.project_id=_project_id AND NOT EXISTS (SELECT 1 FROM public.archive_documents a WHERE a.finding_id=_finding_id AND a.source_document_id=d.id AND a.file_path LIKE _finding_id::text || '/%')) THEN RAISE EXCEPTION 'Lampiran belum seluruhnya diarsipkan. Silakan coba lagi.'; END IF;
 END IF;
 UPDATE public.projects SET status='selesai' WHERE id=_project_id;
END; $$;
REVOKE ALL ON FUNCTION public.finish_archived_project(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finish_archived_project(uuid, uuid) TO authenticated;