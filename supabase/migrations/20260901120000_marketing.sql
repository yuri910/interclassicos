-- Logos de time/torneio, fila de pendências e artes geradas para Marketing

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
