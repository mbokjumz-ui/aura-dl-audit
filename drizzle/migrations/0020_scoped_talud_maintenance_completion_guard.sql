DO $maintenance$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('public.protect_opname_completion()'::regprocedure) INTO definition;
 definition := replace(definition, 'BEGIN', 'BEGIN
  -- One-time maintenance; no application user can use this path.
  IF current_user = ''postgres'' AND auth.uid() IS NULL AND TG_OP = ''UPDATE'' AND OLD.id = ''01a8ebca-119e-48ce-b843-8b9d45313d23''::uuid AND OLD.finalized_at = ''2026-11-04 07:39:09.976015+00''::timestamptz AND NEW.finalized_at IS NULL AND (to_jsonb(NEW) - ARRAY[''finalized_at'',''work_end_date'']) = (to_jsonb(OLD) - ARRAY[''finalized_at'',''work_end_date'']) THEN RETURN NEW; END IF;');
 EXECUTE definition;
END; $maintenance$;