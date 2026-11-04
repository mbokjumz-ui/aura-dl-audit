DO $retire$ DECLARE fn text; definition text; BEGIN
 FOREACH fn IN ARRAY ARRAY['public.protect_finalized_rab_project()', 'public.protect_opname_completion()'] LOOP
  SELECT pg_get_functiondef(fn::regprocedure) INTO definition;
  definition := regexp_replace(definition, E'  -- One-time[^\n]*\n  IF current_user = ''postgres''[^\n]*THEN RETURN NEW; END IF;\n', '');
  IF position('01a8ebca-119e-48ce-b843-8b9d45313d23' in definition) > 0 THEN RAISE EXCEPTION 'Maintenance exception was not removed'; END IF;
  EXECUTE definition;
 END LOOP;
END; $retire$;