CREATE OR REPLACE FUNCTION public.protect_finalized_rab_item()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE old_rab uuid; new_rab uuid; locked record; is_final boolean := false;
BEGIN
  IF TG_OP = 'DELETE' AND auth.role() = 'service_role' THEN RETURN OLD; END IF;
  IF TG_OP <> 'INSERT' THEN old_rab := OLD.rab_id; END IF;
  IF TG_OP <> 'DELETE' THEN new_rab := NEW.rab_id; END IF;
  FOR locked IN SELECT id, finalized_at FROM public.stock_opname_projects WHERE id IN (old_rab, new_rab) ORDER BY id FOR UPDATE LOOP
    IF locked.finalized_at IS NOT NULL THEN is_final := true; END IF;
  END LOOP;
  IF is_final THEN
    IF TG_OP <> 'UPDATE' THEN RAISE EXCEPTION 'Poin RAB final tidak dapat ditambah atau dihapus.'; END IF;
    IF (to_jsonb(NEW) - 'actual_quantity') IS DISTINCT FROM (to_jsonb(OLD) - 'actual_quantity') THEN RAISE EXCEPTION 'Poin RAB sudah final dan tidak dapat diubah.'; END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.allow_privileged_rab_cleanup()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    OLD.finalized_at := NULL;
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER aa_privileged_rab_cleanup BEFORE DELETE ON public.stock_opname_projects FOR EACH ROW EXECUTE FUNCTION public.allow_privileged_rab_cleanup();
REVOKE ALL ON FUNCTION public.allow_privileged_rab_cleanup() FROM PUBLIC, anon, authenticated;