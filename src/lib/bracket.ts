import type { Match } from "@/hooks/use-tournament";
import type { GroupStandings } from "@/lib/standings";
import { phaseLabel } from "@/lib/tournament";

export type Series = "Ouro" | "Prata";

export type QualifierSlot =
  | { kind: "team"; teamId: string; name: string; rank: number; group: string }
  | { kind: "placeholder"; label: string; rank: number; group: string }
  | { kind: "bye" };

export type BracketSlot =
  | { kind: "team"; teamId: string; name: string }
  | { kind: "placeholder"; label: string }
  | { kind: "bye" };

export type BracketMatchup = {
  key: string;
  home: BracketSlot;
  away: BracketSlot;
  match: Match | null;
};

export type BracketRound = {
  phase: "oitavas" | "quartas" | "semi" | "final";
  label: string;
  matchups: BracketMatchup[];
};

export type SeriesBracketData = {
  series: Series;
  rounds: BracketRound[];
};

/**
 * Vagas de um grupo para a série (Ouro = melhores colocados, Prata =
 * últimos colocados). Sempre retorna `spots` posições, mesmo com o grupo
 * incompleto — nesse caso a vaga vira um placeholder pela posição
 * ("Vaga 2º Lugar do Grupo A") em vez do time.
 *
 * `spots` pode ultrapassar o tamanho do grupo (configuração de Ouro + Prata
 * maior que o grupo comporta) — quem já classificou para a Série Ouro não
 * pode também disputar a Prata, então `excludeTopRanks` (só usado calculando
 * a Prata) corta as posições já reservadas pela Ouro: essas vagas viram
 * placeholder em vez de reaproveitar o time. As posições que não existem de
 * fato (rank fora de [1, teamCount]) também viram um placeholder informativo.
 */
function groupQualifiers(
  standing: GroupStandings | undefined,
  group: string,
  spots: number,
  fromBottom: boolean,
  excludeTopRanks: number,
): QualifierSlot[] {
  const teamCount = standing?.rows.length ?? 0;
  const out: QualifierSlot[] = [];
  for (let i = 0; i < spots; i++) {
    const rankIndex = fromBottom ? teamCount - spots + i : i;
    const rank = rankIndex + 1;
    if (rank < 1 || rank > teamCount) {
      out.push({
        kind: "placeholder",
        label: `Vaga extra do Grupo ${group} (grupo tem só ${teamCount} ${teamCount === 1 ? "time" : "times"})`,
        rank,
        group,
      });
      continue;
    }
    if (fromBottom && rank <= excludeTopRanks) {
      out.push({
        kind: "placeholder",
        label: `Vaga do Grupo ${group} já classificada para a Série Ouro`,
        rank,
        group,
      });
      continue;
    }
    const row = standing?.complete ? standing.rows[rankIndex] : undefined;
    if (row) {
      out.push({ kind: "team", teamId: row.teamId, name: row.name, rank, group });
    } else {
      out.push({
        kind: "placeholder",
        label: `Vaga ${rank}º Lugar do Grupo ${group}`,
        rank,
        group,
      });
    }
  }
  return out;
}

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Vagas da série somando todos os grupos — não só A e B. Times de todos os
 * grupos configurados na edição disputam a mesma Série Ouro/Prata.
 *
 * Seed geral por classificação: os classificados de todos os grupos entram
 * numa lista só, primeiro por posição (todos os 1º lugares antes de todos
 * os 2º lugares, já que grupos podem ter tamanhos/adversários diferentes e
 * pontuação não é diretamente comparável entre eles) e, dentro da mesma
 * posição, por força real (pontos, saldo, gols pró) como desempate.
 *
 * A quantidade de classificados raramente fecha numa potência de 2 (ex.: 3
 * grupos × 2 vagas = 6 times) — a lista é completada com "folgas" (byes) até
 * a próxima potência de 2, que caem sobre os melhores seeds (ficam no fim da
 * lista, e o cruzamento sempre pareia o melhor com o pior). Isso garante que
 * o chaveamento sempre feche numa árvore limpa (quartas→semi→final).
 */
function seriesQualifiers(
  standings: GroupStandings[],
  spots: number,
  fromBottom: boolean,
  excludeTopRanks: number,
): QualifierSlot[] {
  const perGroup = standings.map((standing) =>
    groupQualifiers(standing, standing.group, spots, fromBottom, excludeTopRanks),
  );

  const seeded: QualifierSlot[] = [];
  for (let tier = 0; tier < spots; tier++) {
    const tierSlots = perGroup.map((slots, groupIndex) => {
      const slot = slots[tier]!;
      const row =
        slot.kind === "team"
          ? standings[groupIndex]?.rows.find((r) => r.teamId === slot.teamId)
          : undefined;
      return { slot, row };
    });
    tierSlots.sort((a, b) => {
      if (!a.row && !b.row) return 0;
      if (!a.row) return 1;
      if (!b.row) return -1;
      return (
        b.row.points - a.row.points ||
        b.row.sg - a.row.sg ||
        b.row.gp - a.row.gp ||
        a.row.name.localeCompare(b.row.name)
      );
    });
    seeded.push(...tierSlots.map((t) => t.slot));
  }

  const target = nextPowerOfTwo(seeded.length);
  while (seeded.length < target) seeded.push({ kind: "bye" });

  return seeded;
}

/** Cruza a lista de classificados: melhor seed geral contra pior, e assim por diante. */
function seededCrossPairs<T>(list: T[]): Array<[T, T]> {
  const pairs: Array<[T, T]> = [];
  const half = Math.floor(list.length / 2);
  for (let i = 0; i < half; i++) {
    pairs.push([list[i]!, list[list.length - 1 - i]!]);
  }
  return pairs;
}

function slotFromQualifier(q: QualifierSlot): BracketSlot {
  if (q.kind === "bye") return { kind: "bye" };
  return q.kind === "team"
    ? { kind: "team", teamId: q.teamId, name: q.name }
    : { kind: "placeholder", label: q.label };
}

function findRealMatch(
  matches: Match[],
  editionId: string | null,
  phase: BracketRound["phase"],
  series: Series,
  teamA: string,
  teamB: string,
): Match | null {
  return (
    matches.find(
      (m) =>
        m.phase === phase &&
        m.group_name === series &&
        (editionId ? m.edition_id === editionId : true) &&
        ((m.home_team_id === teamA && m.away_team_id === teamB) ||
          (m.home_team_id === teamB && m.away_team_id === teamA)),
    ) ?? null
  );
}

function winnerSlot(matchup: BracketMatchup, placeholderLabel: string): BracketSlot {
  // Folga: o time avança direto, sem precisar de partida.
  if (matchup.home.kind === "team" && matchup.away.kind === "bye") return matchup.home;
  if (matchup.away.kind === "team" && matchup.home.kind === "bye") return matchup.away;

  const m = matchup.match;
  if (m && m.status === "encerrada" && m.home_score !== m.away_score) {
    const winnerId = m.home_score > m.away_score ? m.home_team_id : m.away_team_id;
    const winnerSide = m.home_score > m.away_score ? matchup.home : matchup.away;
    if (winnerId && winnerSide.kind === "team") return winnerSide;
  }
  return { kind: "placeholder", label: placeholderLabel };
}

function buildRound(
  phase: BracketRound["phase"],
  slots: BracketSlot[],
  matches: Match[],
  editionId: string | null,
  series: Series,
): BracketRound {
  const matchups: BracketMatchup[] = [];
  for (let i = 0; i < slots.length; i += 2) {
    const home = slots[i]!;
    const away = slots[i + 1]!;
    const match =
      home.kind === "team" && away.kind === "team"
        ? findRealMatch(matches, editionId, phase, series, home.teamId, away.teamId)
        : null;
    matchups.push({ key: `${series}-${phase}-${matchups.length}`, home, away, match });
  }
  return { phase, label: phaseLabel(phase), matchups };
}

const ROUND_ORDER: BracketRound["phase"][] = ["oitavas", "quartas", "semi", "final"];

/** Últimas `totalRounds` fases da sequência oitavas→quartas→semi→final. */
function phasesForRounds(totalRounds: number): BracketRound["phase"][] {
  return ROUND_ORDER.slice(Math.max(0, ROUND_ORDER.length - totalRounds));
}

/**
 * Monta o chaveamento completo de uma série (Ouro ou Prata) a partir da
 * classificação real de todos os grupos da edição (2 ou mais). Vagas ainda
 * não decididas aparecem como placeholders pela posição. A quantidade de
 * classificados é completada com folgas até a próxima potência de 2 (ver
 * `seriesQualifiers`), então a árvore sempre fecha em rodadas limpas — 2, 4,
 * 8 ou 16 confrontos na entrada — com o número de rodadas (oitavas/quartas/
 * semi/final) calculado a partir disso. Sem disputa de 3º lugar — o
 * perdedor da semifinal é eliminado.
 */
export function buildSeriesBracket(params: {
  series: Series;
  standings: GroupStandings[];
  spots: number;
  matches: Match[];
  editionId: string | null;
  /** Vagas da Ouro (topo de cada grupo) que a Prata não pode reaproveitar. Só importa
   * quando `series` é "Prata" — quem já classificou pra Ouro não disputa a Prata também. */
  ouroSpots?: number | undefined;
}): SeriesBracketData | null {
  const { series, standings, spots, matches, editionId, ouroSpots = 0 } = params;
  if (spots < 1 || standings.length < 2) return null;

  const fromBottom = series === "Prata";
  const qualifiers = seriesQualifiers(standings, spots, fromBottom, fromBottom ? ouroSpots : 0);
  if (qualifiers.length < 2) return null;

  let slots = seededCrossPairs(qualifiers).flatMap(([a, b]) => [
    slotFromQualifier(a),
    slotFromQualifier(b),
  ]);

  const totalRounds = Math.round(Math.log2(slots.length));
  const phases = phasesForRounds(totalRounds);

  const rounds: BracketRound[] = [];
  for (let r = 0; r < totalRounds; r++) {
    const round = buildRound(phases[r]!, slots, matches, editionId, series);
    rounds.push(round);
    if (r === totalRounds - 1) break;
    slots = round.matchups.map((m, i) => winnerSlot(m, `Vencedor de ${round.label} ${i + 1}`));
  }

  return { series, rounds };
}

export type BracketPlanEntry = {
  series: Series;
  phase: BracketRound["phase"];
  homeTeamId: string;
  awayTeamId: string;
  /** Id da partida real já existente para esse confronto, se houver. */
  existingMatchId: string | null;
};

/**
 * Plano completo dos confrontos já decidíveis das duas séries (Ouro e
 * Prata), em todas as rodadas — não só quartas. Cada entrada é um confronto
 * cujos dois lados já são times reais (classificação dos grupos para
 * quartas, vencedores de partidas encerradas para semi/final).
 * `existingMatchId` indica se a partida real já foi criada; quando `null`,
 * é um confronto novo, liberado pelos resultados já lançados, que ainda
 * precisa virar uma partida para o mesário.
 *
 * Usado por "Gerar/Atualizar playoffs" para sincronizar o banco com o
 * chaveamento inteiro a cada clique, em vez de só a primeira rodada — assim,
 * conforme os jogos vão sendo encerrados pelo mesário, um novo clique já
 * cria a próxima rodada liberada.
 */
export function bracketMatchPlan(params: {
  standings: GroupStandings[];
  ouroSpots: number;
  prataSpots: number;
  matches: Match[];
  editionId: string | null;
}): BracketPlanEntry[] {
  const { standings, ouroSpots, prataSpots, matches, editionId } = params;
  const plan: BracketPlanEntry[] = [];
  const seriesSpots: Array<[Series, number]> = [
    ["Ouro", ouroSpots],
    ["Prata", prataSpots],
  ];
  for (const [series, spots] of seriesSpots) {
    const data = buildSeriesBracket({ series, standings, spots, matches, editionId, ouroSpots });
    if (!data) continue;
    for (const round of data.rounds) {
      for (const matchup of round.matchups) {
        if (matchup.home.kind === "team" && matchup.away.kind === "team") {
          plan.push({
            series,
            phase: round.phase,
            homeTeamId: matchup.home.teamId,
            awayTeamId: matchup.away.teamId,
            existingMatchId: matchup.match?.id ?? null,
          });
        }
      }
    }
  }
  return plan;
}

export function bracketSlotLabel(slot: BracketSlot): string {
  if (slot.kind === "team") return slot.name;
  if (slot.kind === "bye") return "—";
  return slot.label;
}
