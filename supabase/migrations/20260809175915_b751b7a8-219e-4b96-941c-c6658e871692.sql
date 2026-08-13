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