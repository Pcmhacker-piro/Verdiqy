CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  codeforces_handle text,
  target_rating integer NOT NULL DEFAULT 1400,
  current_streak integer NOT NULL DEFAULT 0,
  last_active_date date,
  onboarded boolean NOT NULL DEFAULT false,
  timezone text NOT NULL DEFAULT 'UTC',
  avatar_url text,
  cf_rating integer,
  cf_max_rating integer,
  cf_rank text,
  cf_title_photo text,
  cf_country text,
  cf_city text,
  cf_organization text,
  cf_first_name text,
  cf_last_name text,
  cf_registered_at timestamptz,
  cf_synced_at timestamptz,
  public_badges text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cf_contest_id integer NOT NULL,
  cf_index text NOT NULL,
  name text NOT NULL,
  rating integer,
  tags text[] NOT NULL DEFAULT '{}',
  url text NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cf_contest_id, cf_index)
);
GRANT SELECT ON public.problems TO anon, authenticated;
GRANT ALL ON public.problems TO service_role;
ALTER TABLE public.problems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "problems public read" ON public.problems FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX problems_rating_idx ON public.problems (rating);
CREATE INDEX problems_tags_idx ON public.problems USING GIN (tags);

CREATE TABLE public.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  problem_id uuid REFERENCES public.problems(id) ON DELETE SET NULL,
  cf_contest_id integer,
  cf_index text,
  verdict text NOT NULL,
  attempts integer NOT NULL DEFAULT 1,
  source text NOT NULL DEFAULT 'codeforces',
  solved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.submissions TO authenticated;
GRANT ALL ON public.submissions TO service_role;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own submissions all" ON public.submissions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX submissions_user_solved_idx ON public.submissions (user_id, solved_at DESC);

CREATE TABLE public.topic_mastery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic text NOT NULL,
  score numeric(4,3) NOT NULL DEFAULT 0.500,
  confidence integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, topic)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.topic_mastery TO authenticated;
GRANT ALL ON public.topic_mastery TO service_role;
ALTER TABLE public.topic_mastery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mastery all" ON public.topic_mastery FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.daily_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_date date NOT NULL DEFAULT CURRENT_DATE,
  coach_note text,
  problem_ids uuid[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'not_started',
  task_count integer NOT NULL DEFAULT 0,
  xp_earned integer NOT NULL DEFAULT 0,
  ai_summary text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, plan_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_plans TO authenticated;
GRANT ALL ON public.daily_plans TO service_role;
ALTER TABLE public.daily_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own plan all" ON public.daily_plans FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  problem_id uuid NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  rationale text,
  focus_topic text,
  est_minutes integer,
  position integer NOT NULL DEFAULT 0,
  kind text NOT NULL DEFAULT 'focus',
  xp_reward integer NOT NULL DEFAULT 100,
  ai_feedback text,
  reviewed_at timestamptz,
  plan_id uuid REFERENCES public.daily_plans(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recommendations TO authenticated;
GRANT ALL ON public.recommendations TO service_role;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own recs all" ON public.recommendations FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX recs_user_status_idx ON public.recommendations (user_id, status, created_at DESC);
CREATE INDEX recommendations_plan_position_idx ON public.recommendations(plan_id, position);
CREATE UNIQUE INDEX recommendations_one_active_per_plan ON public.recommendations(plan_id)
  WHERE status = 'active' AND plan_id IS NOT NULL;
CREATE INDEX recommendations_plan_position_status_idx ON public.recommendations(plan_id, position, status);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.mentor_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Mentor briefing',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mentor_conversations_messages_is_array CHECK (jsonb_typeof(messages) = 'array')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentor_conversations TO authenticated;
GRANT ALL ON public.mentor_conversations TO service_role;
ALTER TABLE public.mentor_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mentor conversations read" ON public.mentor_conversations FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own mentor conversations insert" ON public.mentor_conversations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own mentor conversations update" ON public.mentor_conversations FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own mentor conversations delete" ON public.mentor_conversations FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER mentor_conversations_updated_at BEFORE UPDATE ON public.mentor_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "avatars owner insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars owner read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE TABLE public.bug_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 2000),
  page_url text,
  severity text NOT NULL DEFAULT 'normal' CHECK (severity IN ('low', 'normal', 'high')),
  browser jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'triaged', 'fixed', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.bug_reports TO authenticated;
GRANT ALL ON public.bug_reports TO service_role;
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bug reports insert" ON public.bug_reports FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own bug reports read" ON public.bug_reports FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage bug reports" ON public.bug_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX bug_reports_user_created_idx ON public.bug_reports (user_id, created_at DESC);
CREATE INDEX bug_reports_status_created_idx ON public.bug_reports (status, created_at DESC);
CREATE TRIGGER bug_reports_updated_at BEFORE UPDATE ON public.bug_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.custom_sheets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  min_rating INT NOT NULL,
  max_rating INT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  contest TEXT,
  problem_count INT NOT NULL DEFAULT 0,
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  legacy_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX custom_sheets_user_id_idx ON public.custom_sheets(user_id, archived_at NULLS FIRST, created_at DESC);
CREATE UNIQUE INDEX custom_sheets_user_legacy_idx ON public.custom_sheets(user_id, legacy_id) WHERE legacy_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_sheets TO authenticated;
GRANT ALL ON public.custom_sheets TO service_role;
ALTER TABLE public.custom_sheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_sheets_select" ON public.custom_sheets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own_sheets_insert" ON public.custom_sheets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_sheets_update" ON public.custom_sheets FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_sheets_delete" ON public.custom_sheets FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER custom_sheets_updated_at BEFORE UPDATE ON public.custom_sheets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.custom_sheet_problems (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sheet_id UUID NOT NULL REFERENCES public.custom_sheets(id) ON DELETE CASCADE,
  position INT NOT NULL,
  key TEXT NOT NULL,
  contest_id INT,
  problem_index TEXT NOT NULL,
  name TEXT NOT NULL,
  rating INT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX custom_sheet_problems_sheet_idx ON public.custom_sheet_problems(sheet_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_sheet_problems TO authenticated;
GRANT ALL ON public.custom_sheet_problems TO service_role;
ALTER TABLE public.custom_sheet_problems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_sheet_problems_select" ON public.custom_sheet_problems FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.custom_sheets s WHERE s.id = sheet_id AND s.user_id = auth.uid()));
CREATE POLICY "own_sheet_problems_insert" ON public.custom_sheet_problems FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.custom_sheets s WHERE s.id = sheet_id AND s.user_id = auth.uid()));
CREATE POLICY "own_sheet_problems_update" ON public.custom_sheet_problems FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.custom_sheets s WHERE s.id = sheet_id AND s.user_id = auth.uid()));
CREATE POLICY "own_sheet_problems_delete" ON public.custom_sheet_problems FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.custom_sheets s WHERE s.id = sheet_id AND s.user_id = auth.uid()));

CREATE TABLE public.bug_report_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  bug_report_id UUID REFERENCES public.bug_reports(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('opened','submitted','failed','cancelled')),
  page_url TEXT,
  severity TEXT CHECK (severity IN ('low','normal','high')),
  error_message TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.bug_report_events TO authenticated, anon;
GRANT SELECT ON public.bug_report_events TO authenticated;
GRANT ALL ON public.bug_report_events TO service_role;
ALTER TABLE public.bug_report_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can log a bug report event" ON public.bug_report_events FOR INSERT
  TO authenticated, anon WITH CHECK (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "Admins can read bug report events" ON public.bug_report_events FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_bug_report_events_created_at ON public.bug_report_events (created_at DESC);
CREATE INDEX idx_bug_report_events_type ON public.bug_report_events (event_type);

CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;