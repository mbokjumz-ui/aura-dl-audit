CREATE OR REPLACE FUNCTION public.revoke_changed_follow_up_recipient()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'follow_up_projects' THEN
    IF NEW.responsible_email IS DISTINCT FROM OLD.responsible_email
       OR NEW.responsible_name IS DISTINCT FROM OLD.responsible_name THEN
      UPDATE public.follow_up_access SET revoked_at = now()
      WHERE follow_up_project_id = NEW.id AND recipient_role = 'responsible' AND revoked_at IS NULL;
    END IF;
  ELSIF TG_TABLE_NAME = 'follow_up_items' THEN
    IF NEW.executor_email IS DISTINCT FROM OLD.executor_email
       OR NEW.executor_name IS DISTINCT FROM OLD.executor_name THEN
      UPDATE public.follow_up_access SET revoked_at = now()
      WHERE item_id = NEW.id AND recipient_role = 'executor' AND revoked_at IS NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_changed_follow_up_recipient() FROM PUBLIC, anon, authenticated;