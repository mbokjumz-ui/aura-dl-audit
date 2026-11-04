DO $change$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.protect_finalized_rab_project()'::regprocedure) INTO definition;
 IF position('jsonb_array_length(NEW.contractor_quotes) NOT BETWEEN 1 AND 3' in definition) = 0 OR position('jsonb_array_length(NEW.approvers) NOT BETWEEN 1 AND 2' in definition) = 0 THEN RAISE EXCEPTION 'Unexpected finalization validation definition'; END IF;
 definition := replace(definition, 'jsonb_array_length(NEW.contractor_quotes) NOT BETWEEN 1 AND 3', 'jsonb_array_length(NEW.contractor_quotes) < 1');
 definition := replace(definition, 'jsonb_array_length(NEW.approvers) NOT BETWEEN 1 AND 2', 'jsonb_array_length(NEW.approvers) < 1');
 definition := replace(definition, 'jsonb_array_length(NEW.acknowledgers) NOT BETWEEN 1 AND 2', 'jsonb_array_length(NEW.acknowledgers) < 1');
 definition := replace(definition, 'Masukkan 1–3 penawaran kontraktor.', 'Masukkan minimal satu penawaran kontraktor.');
 definition := replace(definition, 'Masukkan 1–2 pihak menyetujui dan 1–2 pihak mengetahui.', 'Masukkan minimal satu pihak menyetujui dan satu pihak mengetahui.');
 definition := replace(definition, 'BEGIN', 'BEGIN
  -- One-time maintenance for the exact user-requested RAB and finalized version only.
  IF current_user = ''postgres'' AND auth.uid() IS NULL AND TG_OP = ''UPDATE'' AND OLD.id = ''01a8ebca-119e-48ce-b843-8b9d45313d23''::uuid AND OLD.finalized_at = ''2026-11-04 07:39:09.976015+00''::timestamptz AND NEW.finalized_at IS NULL AND (to_jsonb(NEW) - ''finalized_at'') = (to_jsonb(OLD) - ''finalized_at'') THEN RETURN NEW; END IF;');
 EXECUTE definition;
END; $change$;