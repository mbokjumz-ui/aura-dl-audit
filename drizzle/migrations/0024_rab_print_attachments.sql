CREATE TABLE public.rab_print_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), rab_id uuid NOT NULL REFERENCES public.stock_opname_projects(id) ON DELETE CASCADE,
 file_name text NOT NULL, file_path text NOT NULL UNIQUE, content_type text NOT NULL CHECK(content_type IN ('application/pdf','image/jpeg','image/png','image/webp')),
 file_size bigint NOT NULL CHECK(file_size > 0 AND file_size <= 20971520), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(file_path LIKE 'rab-print/' || rab_id::text || '/%')
);
GRANT SELECT,INSERT,DELETE ON public.rab_print_documents TO authenticated;
GRANT ALL ON public.rab_print_documents TO service_role;
ALTER TABLE public.rab_print_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stock roles read print attachments" ON public.rab_print_documents FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'internal_audit') OR public.has_role(auth.uid(),'purchasing'));
CREATE POLICY "Stock roles add print attachments" ON public.rab_print_documents FOR INSERT TO authenticated WITH CHECK(public.has_role(auth.uid(),'internal_audit') OR public.has_role(auth.uid(),'purchasing'));
CREATE POLICY "Stock roles delete print attachments" ON public.rab_print_documents FOR DELETE TO authenticated USING(public.has_role(auth.uid(),'internal_audit') OR public.has_role(auth.uid(),'purchasing'));
CREATE FUNCTION public.protect_rab_print_documents() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE owner_id uuid; locked_at timestamptz;
BEGIN
 IF TG_OP='DELETE' AND auth.role()='service_role' THEN RETURN OLD; END IF;
 IF TG_OP='DELETE' THEN owner_id:=OLD.rab_id; ELSE owner_id:=NEW.rab_id; END IF;
 SELECT finalized_at INTO locked_at FROM public.stock_opname_projects WHERE id=owner_id FOR UPDATE;
 IF locked_at IS NOT NULL THEN RAISE EXCEPTION 'Lampiran cetak RAB final terkunci; buka revisi untuk mengubah lampiran.'; END IF;
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Lampiran tidak dapat diubah langsung.'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER protect_rab_print_documents BEFORE INSERT OR UPDATE OR DELETE ON public.rab_print_documents FOR EACH ROW EXECUTE FUNCTION public.protect_rab_print_documents();
CREATE POLICY "Stock roles upload print attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
 bucket_id='stock-opname-documents' AND (storage.foldername(name))[1]='rab-print' AND lower(storage.extension(name)) IN ('pdf','png','jpg','jpeg','webp') AND
 (public.has_role(auth.uid(),'internal_audit') OR public.has_role(auth.uid(),'purchasing')) AND
 EXISTS(SELECT 1 FROM public.stock_opname_projects p WHERE p.id::text=(storage.foldername(name))[2] AND p.finalized_at IS NULL)
);
CREATE POLICY "Protect finalized print attachment files" ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING (
 bucket_id <> 'stock-opname-documents' OR (storage.foldername(name))[1] <> 'rab-print' OR
 EXISTS(SELECT 1 FROM public.stock_opname_projects p WHERE p.id::text=(storage.foldername(name))[2] AND p.finalized_at IS NULL) OR
 NOT EXISTS(SELECT 1 FROM public.stock_opname_projects p WHERE p.id::text=(storage.foldername(name))[2])
);
REVOKE ALL ON FUNCTION public.protect_rab_print_documents() FROM PUBLIC;