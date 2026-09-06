-- Permite que staff exclua artes de marketing individualmente (só existia INSERT antes).

CREATE POLICY "marketing_stories staff delete" ON public.marketing_stories FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));
