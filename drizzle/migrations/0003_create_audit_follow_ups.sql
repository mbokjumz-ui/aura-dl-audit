CREATE TABLE public.follow_up_projects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid UNIQUE REFERENCES public.projects(id) ON DELETE SET NULL, project_name text NOT NULL, responsible_name text NOT NULL, responsible_email text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follow_up_projects TO authenticated;
GRANT ALL ON public.follow_up_projects TO service_role;
ALTER TABLE public.follow_up_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal auditors manage follow up projects" ON public.follow_up_projects FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TABLE public.follow_up_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), follow_up_project_id uuid NOT NULL REFERENCES public.follow_up_projects(id) ON DELETE CASCADE, title text NOT NULL, description text NOT NULL DEFAULT '', executor_name text NOT NULL, executor_email text NOT NULL, due_date date, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','submitted','revision','approved')), review_note text NOT NULL DEFAULT '', reviewed_by uuid, reviewed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follow_up_items TO authenticated;
GRANT ALL ON public.follow_up_items TO service_role;
ALTER TABLE public.follow_up_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal auditors manage follow up items" ON public.follow_up_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TABLE public.follow_up_access (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), follow_up_project_id uuid NOT NULL REFERENCES public.follow_up_projects(id) ON DELETE CASCADE, item_id uuid REFERENCES public.follow_up_items(id) ON DELETE CASCADE, recipient_role text NOT NULL CHECK(recipient_role IN ('responsible','executor')), token_hash text UNIQUE NOT NULL, expires_at timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), CHECK((recipient_role = 'responsible' AND item_id IS NULL) OR (recipient_role = 'executor' AND item_id IS NOT NULL))
);
GRANT ALL ON public.follow_up_access TO service_role;
ALTER TABLE public.follow_up_access ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.follow_up_submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), item_id uuid NOT NULL REFERENCES public.follow_up_items(id) ON DELETE CASCADE, access_id uuid REFERENCES public.follow_up_access(id), author_role text NOT NULL, description text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.follow_up_submissions TO authenticated;
GRANT ALL ON public.follow_up_submissions TO service_role;
ALTER TABLE public.follow_up_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal auditors read submissions" ON public.follow_up_submissions FOR SELECT TO authenticated USING (true);
CREATE TABLE public.follow_up_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), submission_id uuid NOT NULL REFERENCES public.follow_up_submissions(id) ON DELETE CASCADE, file_name text NOT NULL, file_path text UNIQUE NOT NULL, content_type text NOT NULL, file_size bigint NOT NULL CHECK(file_size > 0 AND file_size <= 20971520)
);
GRANT SELECT ON public.follow_up_documents TO authenticated;
GRANT ALL ON public.follow_up_documents TO service_role;
ALTER TABLE public.follow_up_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal auditors read evidence metadata" ON public.follow_up_documents FOR SELECT TO authenticated USING (true);
CREATE FUNCTION public.validate_follow_up_project() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN IF TG_OP = 'INSERT' AND NOT EXISTS(SELECT 1 FROM public.projects WHERE id = NEW.project_id AND status = 'selesai') THEN RAISE EXCEPTION 'Tindak lanjut hanya untuk Project selesai'; END IF; RETURN NEW; END $$;
CREATE TRIGGER validate_follow_up_project BEFORE INSERT ON public.follow_up_projects FOR EACH ROW EXECUTE FUNCTION public.validate_follow_up_project();
CREATE FUNCTION public.submit_follow_up(_access_id uuid, _item_id uuid, _description text, _documents jsonb) RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$ DECLARE a public.follow_up_access; i public.follow_up_items; sid uuid; BEGIN SELECT * INTO a FROM public.follow_up_access WHERE id = _access_id AND revoked_at IS NULL AND expires_at > now(); IF NOT FOUND THEN RAISE EXCEPTION 'Link tidak berlaku'; END IF; SELECT * INTO i FROM public.follow_up_items WHERE id = _item_id FOR UPDATE; IF NOT FOUND OR i.follow_up_project_id <> a.follow_up_project_id OR (a.item_id IS NOT NULL AND a.item_id <> i.id) THEN RAISE EXCEPTION 'Akses ditolak'; END IF; IF i.status NOT IN ('pending','revision') THEN RAISE EXCEPTION 'Poin tidak dapat diperbarui'; END IF; IF length(trim(_description)) = 0 OR jsonb_array_length(_documents) = 0 THEN RAISE EXCEPTION 'Keterangan dan bukti wajib diisi'; END IF; INSERT INTO public.follow_up_submissions(item_id,access_id,author_role,description) VALUES(i.id,a.id,a.recipient_role,_description) RETURNING id INTO sid; INSERT INTO public.follow_up_documents(submission_id,file_name,file_path,content_type,file_size) SELECT sid, d->>'file_name', d->>'file_path', d->>'content_type', (d->>'file_size')::bigint FROM jsonb_array_elements(_documents) d; UPDATE public.follow_up_items SET status='submitted', review_note='', reviewed_by=NULL, reviewed_at=NULL WHERE id=i.id; RETURN sid; END $$;
REVOKE ALL ON FUNCTION public.submit_follow_up(uuid,uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_follow_up(uuid,uuid,text,jsonb) TO service_role;
CREATE POLICY "Internal auditors read follow up evidence" ON storage.objects FOR SELECT TO authenticated USING(bucket_id='follow-up-evidence' AND EXISTS(SELECT 1 FROM public.follow_up_documents d WHERE d.file_path=name));