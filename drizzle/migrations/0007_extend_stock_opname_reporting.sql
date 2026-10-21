ALTER TABLE public.stock_opname_projects ADD COLUMN responsible_name text NOT NULL DEFAULT '', ADD COLUMN auditor_name text NOT NULL DEFAULT '', ADD COLUMN status text NOT NULL DEFAULT 'berjalan' CHECK (status IN ('berjalan','selesai')), ADD COLUMN completed_at timestamptz;
CREATE TABLE public.stock_opname_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 item_id uuid NOT NULL REFERENCES public.stock_opname_items(id) ON DELETE CASCADE,
 file_name text NOT NULL,
 file_path text NOT NULL UNIQUE,
 content_type text NOT NULL,
 file_size bigint NOT NULL CHECK (file_size > 0 AND file_size <= 20971520),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.stock_opname_documents TO authenticated;
GRANT ALL ON public.stock_opname_documents TO service_role;
ALTER TABLE public.stock_opname_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal users read opname documents" ON public.stock_opname_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Internal users add opname documents" ON public.stock_opname_documents FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.stock_opname_items i WHERE i.id = item_id AND file_path LIKE i.id::text || '/%'));
CREATE POLICY "Internal users delete opname documents" ON public.stock_opname_documents FOR DELETE TO authenticated USING (true);
CREATE POLICY "Internal users read opname files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'stock-opname-documents');
CREATE POLICY "Internal users add opname files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'stock-opname-documents' AND EXISTS (SELECT 1 FROM public.stock_opname_items i WHERE i.id::text = (storage.foldername(name))[1]));
CREATE POLICY "Internal users delete opname files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'stock-opname-documents');