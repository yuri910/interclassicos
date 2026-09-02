import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Team = {
  id: string;
  name: string;
  group_name: string | null;
  edition_id: string | null;
  crest_emoji: string | null;
  logo_url: string | null;
};

export type Player = {
  id: string;
  team_id: string;
  name: string;
  shirt_number: number | null;
};

export type Match = {
  id: string;
  phase: string;
  group_name: string | null;
  kickoff_at: string;
  field: string;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number;
  away_score: number;
  status: string;
  mvp_player_id: string | null;
  edition_id: string | null;
};

export type MatchEvent = {
  id: string;
  match_id: string;
  player_id: string;
  team_id: string;
  type: "gol" | "amarelo" | "vermelho";
  minute: number | null;
};

export type Edition = {
  id: string;
  name: string;
  year: number;
  is_active: boolean;
  foul_shootout_limit: number;
  yellows_for_suspension: number;
  games_to_reset_yellows: number;
  suspension_games_yellow: number;
  suspension_games_red: number;
  team_count: number;
  ouro_qualifiers: number;
  prata_qualifiers: number;
  logo_url: string | null;
  story_background_url: string | null;
  ad_enabled: boolean;
  ad_banner_url: string | null;
  ad_whatsapp_phone: string | null;
};

export const DEFAULT_RULES = {
  foul_shootout_limit: 6,
  yellows_for_suspension: 3,
  games_to_reset_yellows: 0,
  suspension_games_yellow: 1,
  suspension_games_red: 1,
};

const LIVE = { refetchInterval: 15000, refetchOnWindowFocus: true } as const;

export function useEditions() {
  return useQuery({
    queryKey: ["editions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("editions")
        .select(
          "id, name, year, is_active, foul_shootout_limit, yellows_for_suspension, games_to_reset_yellows, suspension_games_yellow, suspension_games_red, team_count, ouro_qualifiers, prata_qualifiers, logo_url, story_background_url, ad_enabled, ad_banner_url, ad_whatsapp_phone",
        )
        .order("year", { ascending: false })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Edition[];
    },
  });
}

/** Regras vigentes: da edição ativa, com fallback nos padrões. */
export function useActiveRules() {
  const { data: editions } = useEditions();
  const active = (editions ?? []).find((e) => e.is_active) ?? editions?.[0];
  return {
    edition: active ?? null,
    rules: {
      foul_shootout_limit: active?.foul_shootout_limit ?? DEFAULT_RULES.foul_shootout_limit,
      yellows_for_suspension:
        active?.yellows_for_suspension ?? DEFAULT_RULES.yellows_for_suspension,
      games_to_reset_yellows:
        active?.games_to_reset_yellows ?? DEFAULT_RULES.games_to_reset_yellows,
      suspension_games_yellow:
        active?.suspension_games_yellow ?? DEFAULT_RULES.suspension_games_yellow,
      suspension_games_red: active?.suspension_games_red ?? DEFAULT_RULES.suspension_games_red,
    },
  };
}

export function useTeams() {
  return useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, group_name, edition_id, crest_emoji, logo_url")
        .order("group_name", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Team[];
    },
  });
}

export function usePlayers() {
  return useQuery({
    queryKey: ["players"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, team_id, name, shirt_number")
        .order("shirt_number", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as Player[];
    },
  });
}

export function useMatches() {
  return useQuery({
    queryKey: ["matches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select(
          "id, phase, group_name, kickoff_at, field, home_team_id, away_team_id, home_score, away_score, status, mvp_player_id, edition_id",
        )
        .order("kickoff_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Match[];
    },
    ...LIVE,
  });
}

export type MatchFoul = {
  id: string;
  match_id: string;
  team_id: string;
  half: number;
  count: number;
};

export function useFouls(matchId?: string) {
  return useQuery({
    queryKey: ["fouls", matchId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("match_fouls").select("id, match_id, team_id, half, count");
      if (matchId) q = q.eq("match_id", matchId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as MatchFoul[];
    },
    ...LIVE,
  });
}

export function useEvents(matchId?: string) {
  return useQuery({
    queryKey: ["events", matchId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("match_events").select("id, match_id, player_id, team_id, type, minute");
      if (matchId) q = q.eq("match_id", matchId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as MatchEvent[];
    },
    ...LIVE,
  });
}
