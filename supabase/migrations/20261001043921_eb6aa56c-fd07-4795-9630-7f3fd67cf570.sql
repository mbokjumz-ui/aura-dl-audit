CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.auditors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  position TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auditors TO authenticated;
GRANT ALL ON public.auditors TO service_role;
ALTER TABLE public.auditors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage auditors" ON public.auditors FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage teams" ON public.teams FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  auditor_id UUID NOT NULL REFERENCES public.auditors(id) ON DELETE CASCADE,
  UNIQUE (team_id, auditor_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage team members" ON public.team_members FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  auditee TEXT,
  description TEXT,
  period_start DATE,
  period_end DATE,
  status TEXT NOT NULL DEFAULT 'berjalan',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage projects" ON public.projects FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.project_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  auditor_id UUID REFERENCES public.auditors(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'anggota',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_assignments TO authenticated;
GRANT ALL ON public.project_assignments TO service_role;
ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage assignments" ON public.project_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.project_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stage_key TEXT NOT NULL,
  target_date DATE,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE (project_id, stage_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_stages TO authenticated;
GRANT ALL ON public.project_stages TO service_role;
ALTER TABLE public.project_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage stages" ON public.project_stages FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.stage_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stage_id UUID NOT NULL REFERENCES public.project_stages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date DATE,
  is_done BOOLEAN NOT NULL DEFAULT false,
  done_at TIMESTAMPTZ,
  auditor_id UUID REFERENCES public.auditors(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stage_tasks TO authenticated;
GRANT ALL ON public.stage_tasks TO service_role;
ALTER TABLE public.stage_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage tasks" ON public.stage_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Data contoh
INSERT INTO public.auditors (name, email, position) VALUES
  ('Budi Santoso', 'budi.santoso@perusahaan.co.id', 'Kepala Audit Internal'),
  ('Siti Rahayu', 'siti.rahayu@perusahaan.co.id', 'Auditor Senior'),
  ('Andi Wijaya', 'andi.wijaya@perusahaan.co.id', 'Auditor'),
  ('Dewi Lestari', 'dewi.lestari@perusahaan.co.id', 'Auditor'),
  ('Rizky Pratama', 'rizky.pratama@perusahaan.co.id', 'Auditor Junior');

INSERT INTO public.teams (name, description) VALUES
  ('Tim Audit Operasional', 'Fokus pada audit proses operasional dan cabang'),
  ('Tim Audit Keuangan', 'Fokus pada audit laporan keuangan dan pengendalian kas');

INSERT INTO public.team_members (team_id, auditor_id)
SELECT t.id, a.id FROM public.teams t, public.auditors a
WHERE (t.name = 'Tim Audit Operasional' AND a.name IN ('Siti Rahayu', 'Andi Wijaya', 'Rizky Pratama'))
   OR (t.name = 'Tim Audit Keuangan' AND a.name IN ('Siti Rahayu', 'Dewi Lestari'));

INSERT INTO public.projects (name, auditee, description, period_start, period_end, status) VALUES
  ('Audit Pengelolaan Kas Cabang Jakarta', 'Cabang Jakarta', 'Audit atas pengelolaan kas kecil dan kas besar cabang Jakarta periode 2026.', '2026-09-15', '2026-11-30', 'berjalan'),
  ('Audit Proses Pengadaan Barang', 'Divisi Pengadaan', 'Audit kepatuhan proses pengadaan barang dan jasa tahun anggaran 2026.', '2026-10-01', '2026-12-15', 'berjalan');

INSERT INTO public.project_stages (project_id, stage_key, target_date, sort_order)
SELECT p.id, s.stage_key, s.target_date, s.sort_order
FROM public.projects p
CROSS JOIN (VALUES
  ('perencanaan', '2026-09-25'::date, 1),
  ('persiapan', '2026-10-05'::date, 2),
  ('pelaksanaan', '2026-11-05'::date, 3),
  ('pelaporan', '2026-11-20'::date, 4),
  ('closing', '2026-11-30'::date, 5)
) AS s(stage_key, target_date, sort_order)
WHERE p.name = 'Audit Pengelolaan Kas Cabang Jakarta';

INSERT INTO public.project_stages (project_id, stage_key, target_date, sort_order)
SELECT p.id, s.stage_key, s.target_date, s.sort_order
FROM public.projects p
CROSS JOIN (VALUES
  ('perencanaan', '2026-10-10'::date, 1),
  ('persiapan', '2026-10-20'::date, 2),
  ('pelaksanaan', '2026-11-20'::date, 3),
  ('pelaporan', '2026-12-05'::date, 4),
  ('closing', '2026-12-15'::date, 5)
) AS s(stage_key, target_date, sort_order)
WHERE p.name = 'Audit Proses Pengadaan Barang';

INSERT INTO public.project_assignments (project_id, auditor_id, team_id, role)
SELECT p.id, a.id, NULL, 'ketua tim'
FROM public.projects p, public.auditors a
WHERE p.name = 'Audit Pengelolaan Kas Cabang Jakarta' AND a.name = 'Siti Rahayu';

INSERT INTO public.project_assignments (project_id, auditor_id, team_id, role)
SELECT p.id, NULL, t.id, 'tim pelaksana'
FROM public.projects p, public.teams t
WHERE p.name = 'Audit Pengelolaan Kas Cabang Jakarta' AND t.name = 'Tim Audit Operasional';

INSERT INTO public.project_assignments (project_id, auditor_id, team_id, role)
SELECT p.id, NULL, t.id, 'tim pelaksana'
FROM public.projects p, public.teams t
WHERE p.name = 'Audit Proses Pengadaan Barang' AND t.name = 'Tim Audit Keuangan';

INSERT INTO public.stage_tasks (stage_id, title, due_date, is_done)
SELECT st.id, t.title, t.due_date, t.is_done
FROM public.project_stages st
JOIN public.projects p ON p.id = st.project_id AND p.name = 'Audit Pengelolaan Kas Cabang Jakarta'
JOIN (VALUES
  ('perencanaan', 'Menyusun program kerja audit', '2026-09-20'::date, true),
  ('perencanaan', 'Menentukan ruang lingkup dan objek audit', '2026-09-22'::date, true),
  ('perencanaan', 'Penugasan tim audit', '2026-09-25'::date, true),
  ('persiapan', 'Mengumpulkan data awal dari auditee', '2026-10-01'::date, true),
  ('persiapan', 'Menyusun kertas kerja pemeriksaan', '2026-10-05'::date, false),
  ('pelaksanaan', 'Pemeriksaan dokumen kas kecil', '2026-10-20'::date, false),
  ('pelaksanaan', 'Wawancara dengan kasir cabang', '2026-10-25'::date, false),
  ('pelaksanaan', 'Uji petik transaksi kas besar', '2026-11-05'::date, false),
  ('pelaporan', 'Menyusun draf laporan hasil audit', '2026-11-15'::date, false),
  ('pelaporan', 'Review laporan oleh Kepala Audit', '2026-11-20'::date, false),
  ('closing', 'Finalisasi dan distribusi laporan', '2026-11-28'::date, false),
  ('closing', 'Arsip kertas kerja audit', '2026-11-30'::date, false)
) AS t(stage_key, title, due_date, is_done) ON t.stage_key = st.stage_key;