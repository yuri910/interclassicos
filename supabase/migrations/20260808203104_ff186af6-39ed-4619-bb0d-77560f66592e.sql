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