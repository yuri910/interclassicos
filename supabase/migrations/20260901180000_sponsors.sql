-- Fundo das artes de Stories (editions) e patrocinadores (com patrocinador master)

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
