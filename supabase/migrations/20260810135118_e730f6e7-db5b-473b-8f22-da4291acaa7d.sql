ALTER TABLE public.editions
  ADD COLUMN IF NOT EXISTS foul_shootout_limit integer NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS yellows_for_suspension integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS games_to_reset_yellows integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS suspension_games_yellow integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS suspension_games_red integer NOT NULL DEFAULT 1;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS mvp_player_id uuid REFERENCES public.players(id) ON DELETE SET NULL;