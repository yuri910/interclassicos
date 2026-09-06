import type { Match, MatchEvent, Team } from "@/hooks/use-tournament";

export type StandingRow = {
  teamId: string;
  name: string;
  logoUrl: string | null;
  j: number;
  v: number;
  e: number;
  d: number;
  gp: number;
  gc: number;
  points: number;
  sg: number;
  /** Cartões somados na fase de grupos — usados só como critério de desempate (quanto mais, pior). */
  yellow: number;
  red: number;
};

export type GroupStandings = {
  group: string;
  rows: StandingRow[];
  /** Todos os jogos da fase de grupos deste grupo já foram encerrados. */
  complete: boolean;
};

/**
 * Classificação por grupo a partir da fase de grupos. Gols contabilizados
 * pela súmula (match_events) são a fonte de verdade do placar, com fallback
 * no placar gravado na partida. Usada por Classificação, Mesário e pelo
 * gerador de playoffs para que todos concordem sobre quem está classificado.
 */
export function computeGroupStandings(params: {
  teams: Team[];
  matches: Match[];
  events: MatchEvent[];
  includeLive?: boolean;
}): GroupStandings[] {
  const { teams, matches, events, includeLive = true } = params;

  type MutableRow = StandingRow;
  const rowsById = new Map<string, MutableRow>();
  const byGroup = new Map<string, MutableRow[]>();
  const teamCountByGroup = new Map<string, number>();

  for (const team of teams) {
    const g = team.group_name?.trim() || "Sem grupo";
    const row: MutableRow = {
      teamId: team.id,
      name: team.name,
      logoUrl: team.logo_url,
      j: 0,
      v: 0,
      e: 0,
      d: 0,
      gp: 0,
      gc: 0,
      points: 0,
      sg: 0,
      yellow: 0,
      red: 0,
    };
    rowsById.set(team.id, row);
    const list = byGroup.get(g) ?? [];
    list.push(row);
    byGroup.set(g, list);
    teamCountByGroup.set(g, (teamCountByGroup.get(g) ?? 0) + 1);
  }

  const goals = new Map<string, { home: number; away: number }>();
  const cards = new Map<string, { homeYellow: number; homeRed: number; awayYellow: number; awayRed: number }>();
  for (const ev of events) {
    const m = matches.find((x) => x.id === ev.match_id);
    if (!m) continue;
    if (ev.type === "gol") {
      const cur = goals.get(m.id) ?? { home: 0, away: 0 };
      if (ev.team_id === m.home_team_id) cur.home += 1;
      else if (ev.team_id === m.away_team_id) cur.away += 1;
      goals.set(m.id, cur);
    } else if (ev.type === "amarelo" || ev.type === "vermelho") {
      const cur = cards.get(m.id) ?? { homeYellow: 0, homeRed: 0, awayYellow: 0, awayRed: 0 };
      const isHome = ev.team_id === m.home_team_id;
      if (ev.type === "amarelo") {
        if (isHome) cur.homeYellow += 1;
        else cur.awayYellow += 1;
      } else {
        if (isHome) cur.homeRed += 1;
        else cur.awayRed += 1;
      }
      cards.set(m.id, cur);
    }
  }

  const finishedCountByGroup = new Map<string, number>();

  for (const m of matches) {
    if (m.phase !== "grupos") continue;
    const group = m.group_name?.trim() || "Sem grupo";
    if (m.status === "encerrada") {
      finishedCountByGroup.set(group, (finishedCountByGroup.get(group) ?? 0) + 1);
    }
    if (m.status === "agendada") continue;
    if (m.status === "em_andamento" && !includeLive) continue;

    const home = m.home_team_id ? rowsById.get(m.home_team_id) : undefined;
    const away = m.away_team_id ? rowsById.get(m.away_team_id) : undefined;
    if (!home || !away) continue;

    const scored = goals.get(m.id);
    const hs = Math.max(scored?.home ?? 0, m.home_score);
    const as = Math.max(scored?.away ?? 0, m.away_score);

    const cardCount = cards.get(m.id);
    if (cardCount) {
      home.yellow += cardCount.homeYellow;
      home.red += cardCount.homeRed;
      away.yellow += cardCount.awayYellow;
      away.red += cardCount.awayRed;
    }

    home.j += 1;
    away.j += 1;
    home.gp += hs;
    home.gc += as;
    away.gp += as;
    away.gc += hs;
    if (hs > as) {
      home.v += 1;
      away.d += 1;
    } else if (hs < as) {
      away.v += 1;
      home.d += 1;
    } else {
      home.e += 1;
      away.e += 1;
    }
  }

  for (const row of rowsById.values()) {
    row.points = row.v * 3 + row.e;
    row.sg = row.gp - row.gc;
  }

  return [...byGroup.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, rows]) => {
      // Critérios de desempate, em ordem: pontos, vitórias, saldo de gols, gols pró, cartões
      // vermelhos (menos é melhor), cartões amarelos (menos é melhor), nome (só pra garantir
      // uma ordem estável quando empata em tudo).
      const sorted = [...rows].sort(
        (a, b) =>
          b.points - a.points ||
          b.v - a.v ||
          b.sg - a.sg ||
          b.gp - a.gp ||
          a.red - b.red ||
          a.yellow - b.yellow ||
          a.name.localeCompare(b.name),
      );
      const teamCount = teamCountByGroup.get(group) ?? 0;
      const expected = teamCount > 1 ? (teamCount * (teamCount - 1)) / 2 : 0;
      const finished = finishedCountByGroup.get(group) ?? 0;
      return { group, rows: sorted, complete: expected > 0 && finished >= expected };
    });
}
