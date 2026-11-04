DO $repair$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('public.protect_finalized_rab_project()'::regprocedure) INTO definition;
 definition := replace(definition, '(to_jsonb(NEW) - ''finalized_at'') = (to_jsonb(OLD) - ''finalized_at'')', '(to_jsonb(NEW) - ARRAY[''finalized_at'',''work_end_date'']) = (to_jsonb(OLD) - ARRAY[''finalized_at'',''work_end_date''])');
 EXECUTE definition;
END; $repair$;