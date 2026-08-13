ALTER TABLE public.editions
  ADD COLUMN IF NOT EXISTS team_count integer NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS ouro_qualifiers integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS prata_qualifiers integer NOT NULL DEFAULT 3;
