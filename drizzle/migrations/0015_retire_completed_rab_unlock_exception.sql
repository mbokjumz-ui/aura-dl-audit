DO $maintenance$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('public.protect_finalized_rab_project()'::regprocedure) INTO definition;
 definition := replace(definition, '
  -- One-time user-requested maintenance, unavailable to application roles.
  IF current_user = ''postgres'' AND auth.uid() IS NULL AND TG_OP = ''UPDATE'' AND OLD.id = ''66bf8ba4-6856-4307-8dac-fe382d39c734''::uuid AND OLD.finalized_at = ''2026-10-30 02:55:17.843587+00''::timestamptz AND NEW.finalized_at IS NULL AND (to_jsonb(NEW) - ''finalized_at'') = (to_jsonb(OLD) - ''finalized_at'') THEN RETURN NEW; END IF;', '');
 EXECUTE definition;
END; $maintenance$;