CREATE TABLE public.iso_objects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 archive_year integer NOT NULL,
 object_name text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (archive_year, object_name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.iso_objects TO authenticated;
GRANT ALL ON public.iso_objects TO service_role;
ALTER TABLE public.iso_objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in users manage ISO objects" ON public.iso_objects FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TABLE public.iso_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 object_id uuid NOT NULL REFERENCES public.iso_objects(id) ON DELETE CASCADE,
 file_name text NOT NULL,
 file_path text NOT NULL UNIQUE,
 content_type text NOT NULL,
 file_size bigint NOT NULL CHECK (file_size > 0 AND file_size <= 20971520),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.iso_documents TO authenticated;
GRANT ALL ON public.iso_documents TO service_role;
ALTER TABLE public.iso_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in users read ISO documents" ON public.iso_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed in users add ISO documents" ON public.iso_documents FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.iso_objects o WHERE o.id = object_id AND file_path LIKE o.id::text || '/%'));
CREATE POLICY "Signed in users delete ISO documents" ON public.iso_documents FOR DELETE TO authenticated USING (true);
CREATE POLICY "Signed in users read ISO files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'iso-documents');
CREATE POLICY "Signed in users upload ISO files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'iso-documents' AND EXISTS (SELECT 1 FROM public.iso_objects o WHERE o.id::text = (storage.foldername(name))[1]));
CREATE POLICY "Signed in users delete ISO files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'iso-documents');