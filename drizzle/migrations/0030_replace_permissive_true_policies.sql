DO $$
DECLARE p record; r text; ia text := 'public.has_role(auth.uid(), ''internal_audit''::public.app_role)'; st text;
BEGIN
 st := '(' || ia || ' OR public.has_role(auth.uid(), ''purchasing''::public.app_role))';
 FOR p IN SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname='public' AND permissive='PERMISSIVE' AND (qual='true' OR with_check='true') LOOP
  r := CASE WHEN p.tablename LIKE 'stock_opname%' THEN st WHEN p.tablename='profiles' THEN '((id = auth.uid()) OR ' || ia || ')' ELSE ia END;
  IF p.cmd = 'INSERT' THEN EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (%s)', p.policyname, p.tablename, r);
  ELSIF p.cmd IN ('SELECT','DELETE') THEN EXECUTE format('ALTER POLICY %I ON public.%I USING (%s)', p.policyname, p.tablename, r);
  ELSE EXECUTE format('ALTER POLICY %I ON public.%I USING (%s) WITH CHECK (%s)', p.policyname, p.tablename, r, r); END IF;
 END LOOP;
 FOR p IN SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND permissive='PERMISSIVE' LOOP
  r := CASE WHEN coalesce(p.qual,p.with_check) LIKE '%stock-opname-documents%' THEN st ELSE ia END;
  IF p.qual IS NOT NULL AND p.qual NOT LIKE '%has_role%' THEN EXECUTE format('ALTER POLICY %I ON storage.objects USING ((%s) AND %s)', p.policyname, p.qual, r); END IF;
  IF p.with_check IS NOT NULL AND p.with_check NOT LIKE '%has_role%' THEN EXECUTE format('ALTER POLICY %I ON storage.objects WITH CHECK ((%s) AND %s)', p.policyname, p.with_check, r); END IF;
 END LOOP;
END $$;