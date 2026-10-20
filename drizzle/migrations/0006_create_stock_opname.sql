CREATE TABLE public.stock_opname_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name text NOT NULL,
  division_location text NOT NULL DEFAULT '',
  disposition_number text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.stock_opname_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rab_id uuid NOT NULL REFERENCES public.stock_opname_projects(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.stock_opname_items(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit text NOT NULL DEFAULT '',
  unit_price numeric NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  actual_quantity numeric CHECK (actual_quantity IS NULL OR actual_quantity >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.stock_opname_items(rab_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_opname_projects TO authenticated;
GRANT ALL ON public.stock_opname_projects TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_opname_items TO authenticated;
GRANT ALL ON public.stock_opname_items TO service_role;
ALTER TABLE public.stock_opname_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_opname_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in users manage stock opname projects" ON public.stock_opname_projects FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Signed in users manage stock opname items" ON public.stock_opname_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE OR REPLACE FUNCTION public.validate_stock_opname_parent() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.stock_opname_items p WHERE p.id = NEW.parent_id AND p.rab_id = NEW.rab_id AND p.parent_id IS NULL
  ) THEN RAISE EXCEPTION 'Sub-poin hanya boleh dua level dalam RAB yang sama'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER stock_opname_parent_check BEFORE INSERT OR UPDATE ON public.stock_opname_items FOR EACH ROW EXECUTE FUNCTION public.validate_stock_opname_parent();