import type { Match, MatchEvent, Player } from "@/hooks/use-tournament";
import { formatDate } from "@/lib/tournament";

export type TournamentRules = {
  foul_shootout_limit: number;
  yellows_for_suspension: number;
  games_to_reset_yellows: number;
  suspension_games_yellow: number;
  suspension_games_red: number;
};

export type Suspension = {
  playerId: string;
  playerName: string;
  teamId: string;
  reason: string;
};

/** Jogos já encerrados do time antes da partida atual, em ordem cronológica. */
function priorGames(matches: Match[], teamId: string, before: string) {
  return matches
    .filter(
      (m) =>
        m.status === "encerrada" &&
        (m.home_team_id === teamId || m.away_team_id === teamId) &&
        new Date(m.kickoff_at).getTime() < new Date(before).getTime(),
    )
    .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime());
}

/** Fase de grupos é um "bloco"; qualquer fase de mata-mata (oitavas/quartas/semi/final) é outro. */
function stageBucket(phase: string) {
  return phase === "grupos" ? "grupos" : "mata-mata";
}

/**
 * Calcula quais atletas dos dois times estão suspensos para a partida informada,
 * considerando as regras da edição (vermelhos e acúmulo de amarelos).
 */
export function computeSuspensions(params: {
  match: Match;
  matches: Match[];
  events: MatchEvent[];
  players: Player[];
  rules: TournamentRules;
}): Suspension[] {
  const { match, matches, events, players, rules } = params;
  const teamIds = [match.home_team_id, match.away_team_id].filter((t): t is string => Boolean(t));
  const out: Suspension[] = [];

  for (const teamId of teamIds) {
    const games = priorGames(matches, teamId, match.kickoff_at);
    if (games.length === 0) continue;
    // Amarelo zera ao entrar no mata-mata: só conta os jogos anteriores dentro do mesmo bloco
    // (fase de grupos ou mata-mata) da partida atual — cartão acumulado nos grupos não segue
    // pro mata-mata, a contagem recomeça do zero conforme as regras do torneio.
    const yellowGames = games.filter((g) => stageBucket(g.phase) === stageBucket(match.phase));
    const squad = players.filter((p) => p.team_id === teamId);

    for (const player of squad) {
      const redPerGame = games.map((g) =>
        events.some((e) => e.match_id === g.id && e.player_id === player.id && e.type === "vermelho"),
      );
      const perYellowGame = yellowGames.map((g) => ({
        yellows: events.filter((e) => e.match_id === g.id && e.player_id === player.id && e.type === "amarelo")
          .length,
      }));

      // Vermelho: suspenso pelos N jogos seguintes (vale mesmo trocando de fase).
      const lastRed = redPerGame.map((red, i) => (red ? i : -1)).filter((i) => i >= 0).pop();
      if (lastRed !== undefined && games.length - 1 - lastRed < rules.suspension_games_red) {
        out.push({
          playerId: player.id,
          playerName: player.name,
          teamId,
          reason: `Expulso em ${formatDate(games[lastRed]!.kickoff_at)} — cumpre ${rules.suspension_games_red} jogo(s) de suspensão`,
        });
        continue;
      }

      // Amarelos: acúmulo com reinício opcional da contagem, sempre dentro do bloco atual.
      let counter = 0;
      let trigger = -1;
      perYellowGame.forEach((g, i) => {
        if (
          rules.games_to_reset_yellows > 0 &&
          i > 0 &&
          i % rules.games_to_reset_yellows === 0 &&
          trigger < 0
        ) {
          counter = 0;
        }
        counter += g.yellows;
        if (rules.yellows_for_suspension > 0 && counter >= rules.yellows_for_suspension) {
          trigger = i;
          counter = 0;
        }
      });
      if (trigger >= 0 && yellowGames.length - 1 - trigger < rules.suspension_games_yellow) {
        out.push({
          playerId: player.id,
          playerName: player.name,
          teamId,
          reason: `Atingiu ${rules.yellows_for_suspension} cartões amarelos — cumpre ${rules.suspension_games_yellow} jogo(s) de suspensão`,
        });
      }
    }
  }

  return out;
}
