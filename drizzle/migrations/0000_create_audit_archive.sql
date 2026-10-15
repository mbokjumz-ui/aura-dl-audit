CREATE TABLE public.archive_findings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 archive_year integer NOT NULL,
 archive_month integer NOT NULL CHECK (archive_month BETWEEN 1 AND 12),
 project_key uuid NOT NULL,
 project_name text NOT NULL,
 finding_number text NOT NULL CHECK (length(trim(finding_number)) > 0),
 title text NOT NULL CHECK (length(trim(title)) > 0),
 description text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (archive_year, archive_month, project_key, finding_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.archive_findings TO authenticated;
GRANT ALL ON public.archive_findings TO service_role;
ALTER TABLE public.archive_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in users manage archive findings" ON public.archive_findings FOR ALL TO authenticated USING (true) WITH CHECK (true);
COMMENT ON COLUMN public.archive_findings.project_key IS 'Independent project identity: archive remains available if the operational project is deleted.';
CREATE TABLE public.archive_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 finding_id uuid NOT NULL REFERENCES public.archive_findings(id) ON DELETE CASCADE,
 file_name text NOT NULL,
 file_path text NOT NULL UNIQUE,
 content_type text NOT NULL,
 file_size bigint NOT NULL CHECK (file_size > 0 AND file_size <= 20971520),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.archive_documents TO authenticated;
GRANT ALL ON public.archive_documents TO service_role;
ALTER TABLE public.archive_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in users read archive documents" ON public.archive_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed in users add archive documents" ON public.archive_documents FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.archive_findings f WHERE f.id = finding_id AND file_path LIKE f.id::text || '/%'));
CREATE POLICY "Signed in users delete archive documents" ON public.archive_documents FOR DELETE TO authenticated USING (true);