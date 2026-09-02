-- Schema completo do Interclássicos, consolidado a partir de todas as
-- migrations em supabase/migrations/, na ordem em que foram aplicadas.
-- Rode este arquivo inteiro (Ctrl+A, Ctrl+Enter) no SQL Editor de um
-- projeto Supabase NOVO e vazio para recriar o banco do zero.

-- ===== 20260806143435_d9db6675-1002-456d-bf46-5a9ca92a4bc2.sql =====

CREATE TYPE public.app_role AS ENUM ('admin','mesario');
CREATE TYPE public.match_phase AS ENUM ('grupos','oitavas','quartas','semi','final','terceiro');
CREATE TYPE public.match_status AS ENUM ('agendada','em_andamento','encerrada');
CREATE TYPE public.event_type AS ENUM ('gol','amarelo','vermelho');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','mesario'));
$$;

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  group_name text,
  crest_emoji text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.teams TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teams public read" ON public.teams FOR SELECT USING (true);
CREATE POLICY "teams admin write" ON public.teams FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  shirt_number int,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.players TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.players TO authenticated;
GRANT ALL ON public.players TO service_role;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "players public read" ON public.players FOR SELECT USING (true);
CREATE POLICY "players admin write" ON public.players FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase public.match_phase NOT NULL DEFAULT 'grupos',
  group_name text,
  kickoff_at timestamptz NOT NULL,
  field text NOT NULL,
  home_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  away_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  home_score int NOT NULL DEFAULT 0,
  away_score int NOT NULL DEFAULT 0,
  status public.match_status NOT NULL DEFAULT 'agendada',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.matches TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matches public read" ON public.matches FOR SELECT USING (true);
CREATE POLICY "matches admin write" ON public.matches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "matches staff update" ON public.matches FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.match_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  type public.event_type NOT NULL,
  minute int,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.match_events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_events TO authenticated;
GRANT ALL ON public.match_events TO service_role;
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events public read" ON public.match_events FOR SELECT USING (true);
CREATE POLICY "events staff insert" ON public.match_events FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "events staff update" ON public.match_events FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "events staff delete" ON public.match_events FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE INDEX idx_events_match ON public.match_events(match_id);
CREATE INDEX idx_players_team ON public.players(team_id);
CREATE INDEX idx_matches_kickoff ON public.matches(kickoff_at);

-- ===== 20260806143456 + 20260806143513: trava e libera execução das funções =====

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;

-- ===== 20260806143534: handle_new_user (primeiro usuário a logar vira admin, os demais viram mesário) =====

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE has_admin boolean;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;

  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO has_admin;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN has_admin THEN 'mesario'::public.app_role ELSE 'admin'::public.app_role END)
  ON CONFLICT DO NOTHING;

  IF NOT has_admin THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'mesario') ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== 20260808203104: edições =====

CREATE TABLE public.editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.editions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.editions TO authenticated;
GRANT ALL ON public.editions TO service_role;

ALTER TABLE public.editions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "editions public read" ON public.editions FOR SELECT USING (true);
CREATE POLICY "editions admin write" ON public.editions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_editions_updated_at BEFORE UPDATE ON public.editions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.teams ADD COLUMN edition_id uuid REFERENCES public.editions(id) ON DELETE SET NULL;
ALTER TABLE public.matches ADD COLUMN edition_id uuid REFERENCES public.editions(id) ON DELETE SET NULL;

-- ===== 20260809175915: faltas (súmula) =====

CREATE TABLE public.match_fouls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  half integer NOT NULL CHECK (half IN (1,2)),
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, team_id, half)
);

GRANT SELECT ON public.match_fouls TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_fouls TO authenticated;
GRANT ALL ON public.match_fouls TO service_role;

ALTER TABLE public.match_fouls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fouls public read" ON public.match_fouls FOR SELECT USING (true);
CREATE POLICY "fouls staff insert" ON public.match_fouls FOR INSERT TO authenticated WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "fouls staff update" ON public.match_fouls FOR UPDATE TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "fouls staff delete" ON public.match_fouls FOR DELETE TO authenticated USING (is_staff(auth.uid()));

CREATE TRIGGER update_match_fouls_updated_at BEFORE UPDATE ON public.match_fouls
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== 20260810135118: regras da edição + MVP da partida =====

ALTER TABLE public.editions
  ADD COLUMN IF NOT EXISTS foul_shootout_limit integer NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS yellows_for_suspension integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS games_to_reset_yellows integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS suspension_games_yellow integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS suspension_games_red integer NOT NULL DEFAULT 1;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS mvp_player_id uuid REFERENCES public.players(id) ON DELETE SET NULL;

-- ===== 20260810140000: formato (times / classificados Ouro e Prata) =====

ALTER TABLE public.editions
  ADD COLUMN IF NOT EXISTS team_count integer NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS ouro_qualifiers integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS prata_qualifiers integer NOT NULL DEFAULT 3;

-- ===== 20260901120000: logos de time/torneio, pendências e artes de Marketing =====

ALTER TABLE public.teams ADD COLUMN logo_url text;
ALTER TABLE public.editions ADD COLUMN logo_url text;

CREATE TABLE public.marketing_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE UNIQUE,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','concluida')),
  photo_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.marketing_tasks TO authenticated;
GRANT ALL ON public.marketing_tasks TO service_role;
ALTER TABLE public.marketing_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marketing_tasks staff all" ON public.marketing_tasks FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.marketing_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  story_type text NOT NULL CHECK (story_type IN ('resultado','craque')),
  image_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.marketing_stories TO authenticated;
GRANT SELECT ON public.marketing_stories TO anon;
GRANT ALL ON public.marketing_stories TO service_role;
ALTER TABLE public.marketing_stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marketing_stories public read" ON public.marketing_stories FOR SELECT USING (true);
CREATE POLICY "marketing_stories staff insert" ON public.marketing_stories FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

INSERT INTO storage.buckets (id, name, public) VALUES ('team-logos', 'team-logos', true);
CREATE POLICY "team-logos public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'team-logos');
CREATE POLICY "team-logos admin write" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'team-logos' AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (bucket_id = 'team-logos' AND public.has_role(auth.uid(),'admin'));

INSERT INTO storage.buckets (id, name, public) VALUES ('marketing', 'marketing', true);
CREATE POLICY "marketing public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'marketing');
CREATE POLICY "marketing staff write" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'marketing' AND public.is_staff(auth.uid()))
  WITH CHECK (bucket_id = 'marketing' AND public.is_staff(auth.uid()));

-- ===== 20260901180000: fundo das artes de Stories e patrocinadores =====

ALTER TABLE public.editions ADD COLUMN story_background_url text;

CREATE TABLE public.sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid REFERENCES public.editions(id) ON DELETE CASCADE,
  name text NOT NULL,
  logo_url text NOT NULL,
  is_master boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sponsors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sponsors TO authenticated;
GRANT ALL ON public.sponsors TO service_role;
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sponsors public read" ON public.sponsors FOR SELECT USING (true);
CREATE POLICY "sponsors admin write" ON public.sponsors FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ===== 20260901220000: banner de anúncio pago =====

ALTER TABLE public.editions
  ADD COLUMN ad_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN ad_banner_url text,
  ADD COLUMN ad_whatsapp_phone text;

-- ===== 20260902120000: aprovação manual de novas contas =====

CREATE POLICY "user_roles admin write" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE has_admin boolean;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;

  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO has_admin;

  -- Sem nenhum admin cadastrado ainda: esta conta é a fundadora, vira admin+mesário direto.
  -- Já existe admin: a conta fica sem papel nenhum até ser aprovada manualmente.
  IF NOT has_admin THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'mesario') ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
