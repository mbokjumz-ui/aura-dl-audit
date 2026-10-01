ALTER TABLE public.project_assignments DROP COLUMN team_id;
ALTER TABLE public.project_assignments ALTER COLUMN auditor_id SET NOT NULL;
ALTER TABLE public.project_assignments ADD CONSTRAINT project_assignments_project_auditor_unique UNIQUE (project_id, auditor_id);
DROP TABLE public.team_members;
DROP TABLE public.teams;