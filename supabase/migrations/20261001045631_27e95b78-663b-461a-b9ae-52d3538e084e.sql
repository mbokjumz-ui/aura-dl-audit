CREATE TABLE public.stage_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL REFERENCES public.project_stages(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL UNIQUE,
  content_type text NOT NULL,
  file_size bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stage_documents_file_size_positive CHECK (file_size > 0 AND file_size <= 20971520)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stage_documents TO authenticated;
GRANT ALL ON public.stage_documents TO service_role;
ALTER TABLE public.stage_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in users can view audit documents" ON public.stage_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed in users can add reporting documents" ON public.stage_documents FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.project_stages s WHERE s.id = stage_id AND s.stage_key IN ('pelaporan', 'closing') AND file_path LIKE s.project_id::text || '/' || s.id::text || '/%'));
CREATE POLICY "Signed in users can delete audit documents" ON public.stage_documents FOR DELETE TO authenticated USING (true);
CREATE OR REPLACE FUNCTION public.update_stage_documents_timestamp() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER stage_documents_updated_at BEFORE UPDATE ON public.stage_documents FOR EACH ROW EXECUTE FUNCTION public.update_stage_documents_timestamp();
CREATE POLICY "Signed in users can access audit files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'audit-documents');
CREATE POLICY "Signed in users can upload audit files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'audit-documents');
CREATE POLICY "Signed in users can remove audit files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'audit-documents');