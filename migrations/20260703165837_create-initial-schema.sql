-- Initial schema for JobPilot

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  phone text,
  location text,
  current_title text,
  experience_level text,
  years_experience integer,
  skills text[] DEFAULT ARRAY[]::text[],
  industries text[] DEFAULT ARRAY[]::text[],
  work_experience jsonb DEFAULT '[]'::jsonb,
  education jsonb DEFAULT '{}'::jsonb,
  job_titles_seeking text[] DEFAULT ARRAY[]::text[],
  remote_preference text,
  preferred_locations text[] DEFAULT ARRAY[]::text[],
  salary_expectation text,
  cover_letter_tone text,
  linkedin_url text,
  portfolio_url text,
  work_authorization text,
  resume_pdf_url text,
  is_complete boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running',
  job_title_searched text,
  location_searched text,
  jobs_found integer DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'search',
  source_url text,
  external_apply_url text,
  title text NOT NULL,
  company text NOT NULL,
  location text,
  salary text,
  job_type text,
  about_role text,
  responsibilities text[] DEFAULT ARRAY[]::text[],
  requirements text[] DEFAULT ARRAY[]::text[],
  nice_to_have text[] DEFAULT ARRAY[]::text[],
  benefits text[] DEFAULT ARRAY[]::text[],
  about_company text,
  match_score integer DEFAULT 0,
  match_reason text,
  company_research jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  run_id uuid REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_user_id ON public.agent_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON public.jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_run_id ON public.jobs(run_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_user_id ON public.agent_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_job_id ON public.agent_logs(job_id);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_owner_select ON public.profiles;
CREATE POLICY profiles_owner_select ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS profiles_owner_insert ON public.profiles;
CREATE POLICY profiles_owner_insert ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS profiles_owner_update ON public.profiles;
CREATE POLICY profiles_owner_update ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS profiles_owner_delete ON public.profiles;
CREATE POLICY profiles_owner_delete ON public.profiles
  FOR DELETE USING (auth.uid() = id);

DROP POLICY IF EXISTS agent_runs_owner_select ON public.agent_runs;
CREATE POLICY agent_runs_owner_select ON public.agent_runs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS agent_runs_owner_insert ON public.agent_runs;
CREATE POLICY agent_runs_owner_insert ON public.agent_runs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS agent_runs_owner_update ON public.agent_runs;
CREATE POLICY agent_runs_owner_update ON public.agent_runs
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS agent_runs_owner_delete ON public.agent_runs;
CREATE POLICY agent_runs_owner_delete ON public.agent_runs
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS jobs_owner_select ON public.jobs;
CREATE POLICY jobs_owner_select ON public.jobs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS jobs_owner_insert ON public.jobs;
CREATE POLICY jobs_owner_insert ON public.jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS jobs_owner_update ON public.jobs;
CREATE POLICY jobs_owner_update ON public.jobs
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS jobs_owner_delete ON public.jobs;
CREATE POLICY jobs_owner_delete ON public.jobs
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS agent_logs_owner_select ON public.agent_logs;
CREATE POLICY agent_logs_owner_select ON public.agent_logs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS agent_logs_owner_insert ON public.agent_logs;
CREATE POLICY agent_logs_owner_insert ON public.agent_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS agent_logs_owner_update ON public.agent_logs;
CREATE POLICY agent_logs_owner_update ON public.agent_logs
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS agent_logs_owner_delete ON public.agent_logs;
CREATE POLICY agent_logs_owner_delete ON public.agent_logs
  FOR DELETE USING (auth.uid() = user_id);

-- Storage bucket expectations for resumes.
-- The application will use the private 'resumes' bucket for uploaded PDF files.
-- Bucket creation is handled through the InsForge storage API and is intentionally left out of SQL migrations.
