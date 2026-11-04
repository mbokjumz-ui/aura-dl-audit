DO $repair$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('public.protect_finalized_rab_project()'::regprocedure) INTO definition;
 definition := replace(definition, 'ARRAY[''status'',''completed_at'']', 'ARRAY[''status'',''completed_at'',''work_end_date'']');
 EXECUTE definition;
END; $repair$;