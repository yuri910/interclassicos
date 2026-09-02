-- Trava de partida: evita que dois mesários abram a mesma súmula ao mesmo tempo.
-- Trava "expira" sozinha (ver STALE_MINUTES no cliente) se o mesário fechar a aba sem sair
-- normalmente da súmula, então nunca fica travada pra sempre.

CREATE TABLE public.match_locks (
  match_id uuid PRIMARY KEY REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  locked_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_locks TO authenticated;
GRANT ALL ON public.match_locks TO service_role;
ALTER TABLE public.match_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "match_locks staff read" ON public.match_locks FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "match_locks staff insert" ON public.match_locks FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "match_locks staff update" ON public.match_locks FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "match_locks staff delete" ON public.match_locks FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));
