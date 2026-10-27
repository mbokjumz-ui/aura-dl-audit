CREATE TYPE public.app_role AS ENUM ('internal_audit', 'purchasing');
CREATE TABLE public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, role public.app_role NOT NULL, UNIQUE(user_id, role));
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
CREATE POLICY "Read own role or audit managed accounts" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'internal_audit'));
INSERT INTO public.user_roles(user_id, role) SELECT id, 'internal_audit'::public.app_role FROM auth.users ON CONFLICT DO NOTHING;
DO $$ DECLARE t text; BEGIN
FOREACH t IN ARRAY ARRAY['auditors','projects','project_assignments','project_stages','stage_tasks','stage_documents','archive_findings','archive_documents','iso_objects','iso_documents','follow_up_projects','follow_up_items','follow_up_submissions','follow_up_documents','follow_up_access'] LOOP
EXECUTE format('CREATE POLICY "Internal audit role required" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''internal_audit'')) WITH CHECK (public.has_role(auth.uid(), ''internal_audit''))', t);
END LOOP;
FOREACH t IN ARRAY ARRAY['stock_opname_projects','stock_opname_items','stock_opname_documents'] LOOP
EXECUTE format('CREATE POLICY "Stock opname role required" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''internal_audit'') OR public.has_role(auth.uid(), ''purchasing'')) WITH CHECK (public.has_role(auth.uid(), ''internal_audit'') OR public.has_role(auth.uid(), ''purchasing''))', t);
END LOOP; END $$;
CREATE POLICY "Profile scope by role" ON public.profiles AS RESTRICTIVE FOR ALL TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'internal_audit')) WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'internal_audit'));
CREATE POLICY "Audit file role boundary" ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated USING (bucket_id NOT IN ('audit-documents','archive-documents','iso-documents','follow-up-evidence') OR public.has_role(auth.uid(), 'internal_audit')) WITH CHECK (bucket_id NOT IN ('audit-documents','archive-documents','iso-documents','follow-up-evidence') OR public.has_role(auth.uid(), 'internal_audit'));
CREATE POLICY "Opname file role boundary" ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated USING (bucket_id <> 'stock-opname-documents' OR public.has_role(auth.uid(), 'internal_audit') OR public.has_role(auth.uid(), 'purchasing')) WITH CHECK (bucket_id <> 'stock-opname-documents' OR public.has_role(auth.uid(), 'internal_audit') OR public.has_role(auth.uid(), 'purchasing'));
CREATE FUNCTION public.protect_actual_opname() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$ BEGIN
IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'internal_audit') THEN IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
IF NOT public.has_role(auth.uid(), 'purchasing') THEN RAISE EXCEPTION 'Akses Stock Opname ditolak.'; END IF;
IF TG_OP = 'INSERT' THEN IF NEW.actual_quantity IS NOT NULL THEN RAISE EXCEPTION 'Hanya Internal Audit boleh mengisi jumlah riil.'; END IF;
ELSIF TG_OP = 'UPDATE' THEN IF NEW.actual_quantity IS DISTINCT FROM OLD.actual_quantity THEN RAISE EXCEPTION 'Hanya Internal Audit boleh mengubah jumlah riil.'; END IF;
IF OLD.actual_quantity IS NOT NULL AND (NEW.parent_id IS DISTINCT FROM OLD.parent_id OR NEW.rab_id IS DISTINCT FROM OLD.rab_id) THEN RAISE EXCEPTION 'Poin dengan hasil opname tidak dapat dipindahkan oleh Pembelian.'; END IF;
ELSE IF OLD.actual_quantity IS NOT NULL OR EXISTS(SELECT 1 FROM public.stock_opname_items WHERE parent_id = OLD.id AND actual_quantity IS NOT NULL) THEN RAISE EXCEPTION 'Poin dengan hasil opname hanya dapat dihapus Internal Audit.'; END IF; RETURN OLD; END IF; RETURN NEW; END $$;
CREATE TRIGGER protect_actual_opname BEFORE INSERT OR UPDATE OR DELETE ON public.stock_opname_items FOR EACH ROW EXECUTE FUNCTION public.protect_actual_opname();
CREATE FUNCTION public.protect_opname_completion() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$ BEGIN
IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'internal_audit') THEN IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
IF NOT public.has_role(auth.uid(), 'purchasing') THEN RAISE EXCEPTION 'Akses Stock Opname ditolak.'; END IF;
IF TG_OP = 'INSERT' THEN IF NEW.status <> 'berjalan' OR NEW.completed_at IS NOT NULL THEN RAISE EXCEPTION 'Penyelesaian Stock Opname hanya oleh Internal Audit.'; END IF;
ELSIF TG_OP = 'UPDATE' THEN IF NEW.status IS DISTINCT FROM OLD.status OR NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN RAISE EXCEPTION 'Penyelesaian Stock Opname hanya oleh Internal Audit.'; END IF;
ELSE IF EXISTS(SELECT 1 FROM public.stock_opname_items WHERE rab_id = OLD.id AND actual_quantity IS NOT NULL) THEN RAISE EXCEPTION 'RAB dengan hasil opname hanya dapat dihapus Internal Audit.'; END IF; RETURN OLD; END IF; RETURN NEW; END $$;
CREATE TRIGGER protect_opname_completion BEFORE INSERT OR UPDATE OR DELETE ON public.stock_opname_projects FOR EACH ROW EXECUTE FUNCTION public.protect_opname_completion();