import type { Match } from "@/hooks/use-tournament";
import type { GroupStandings } from "@/lib/standings";
import { phaseLabel } from "@/lib/tournament";

export type Series = "Ouro" | "Prata";

export type QualifierSlot =
  | { kind: "team"; teamId: string; name: string; rank: number; group: string }
  | { kind: "placeholder"; label: string; rank: number; group: string };

export type BracketSlot =
  { kind: "team"; teamId: string; name: string } | { kind: "placeholder"; label: string };

export type BracketMatchup = {
  key: string;
  home: BracketSlot;
  away: BracketSlot;
  match: Match | null;
};

export type BracketRound = {
  phase: "quartas" | "semi" | "final" | "terceiro";
  label: string;
  matchups: BracketMatchup[];
};

export type SeriesBracketData = {
  series: Series;
  groupA: string;
  groupB: string;
  rounds: BracketRound[];
};

/**
 * Vagas de um grupo para a série (Ouro = melhores colocados, Prata =
 * últimos colocados). Sempre retorna `spots` posições, mesmo com o grupo
 * incompleto — nesse caso a vaga vira um placeholder pela posição
 * ("Vaga 2º Lugar do Grupo A") em vez do time.
 */
function groupQualifiers(
  standing: GroupStandings | undefined,
  group: string,
  spots: number,
  fromBottom: boolean,
): QualifierSlot[] {
  const teamCount = standing?.rows.length ?? 0;
  const out: QualifierSlot[] = [];
  for (let i = 0; i < spots; i++) {
    const rankIndex = fromBottom ? teamCount - spots + i : i;
    const rank = rankIndex + 1;
    const row =
      standing?.complete && rankIndex >= 0 && rankIndex < teamCount
        ? standing.rows[rankIndex]
        : undefined;
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

function crossPairs<T>(a: T[], b: T[]): Array<[T, T]> {
  return a.map((item, i) => [item, b[a.length - 1 - i]!] as const);
}

function slotFromQualifier(q: QualifierSlot): BracketSlot {
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
  const m = matchup.match;
  if (m && m.status === "encerrada" && m.home_score !== m.away_score) {
    const winnerId = m.home_score > m.away_score ? m.home_team_id : m.away_team_id;
    const winnerSide = m.home_score > m.away_score ? matchup.home : matchup.away;
    if (winnerId && winnerSide.kind === "team") return winnerSide;
  }
  return { kind: "placeholder", label: placeholderLabel };
}

function loserSlot(matchup: BracketMatchup, placeholderLabel: string): BracketSlot {
  const m = matchup.match;
  if (m && m.status === "encerrada" && m.home_score !== m.away_score) {
    const loserSide = m.home_score > m.away_score ? matchup.away : matchup.home;
    if (loserSide.kind === "team") return loserSide;
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

/**
 * Monta o chaveamento completo de uma série (Ouro ou Prata) a partir da
 * classificação real dos grupos A e B. Vagas ainda não decididas aparecem
 * como placeholders pela posição; rodadas seguintes (semi/final/terceiro)
 * só são projetadas automaticamente quando o número de confrontos da
 * primeira rodada reduz de forma limpa (2 ou 4 jogos).
 */
export function buildSeriesBracket(params: {
  series: Series;
  standings: GroupStandings[];
  spots: number;
  matches: Match[];
  editionId: string | null;
}): SeriesBracketData | null {
  const { series, standings, spots, matches, editionId } = params;
  if (spots < 1) return null;

  const groupA = standings.find((s) => s.group === "A");
  const groupB = standings.find((s) => s.group === "B");
  if (!groupA || !groupB) return null;

  const fromBottom = series === "Prata";
  const qualifiersA = groupQualifiers(groupA, "A", spots, fromBottom);
  const qualifiersB = groupQualifiers(groupB, "B", spots, fromBottom);

  const quartasSlots = crossPairs(qualifiersA, qualifiersB).flatMap(([a, b]) => [
    slotFromQualifier(a),
    slotFromQualifier(b),
  ]);

  const rounds: BracketRound[] = [];
  const quartas = buildRound("quartas", quartasSlots, matches, editionId, series);
  rounds.push(quartas);

  if (quartas.matchups.length === 4) {
    const semiSlots = quartas.matchups.flatMap((m, i) => [
      winnerSlot(m, `Vencedor do Jogo ${i + 1}`),
    ]);
    const semi = buildRound("semi", semiSlots, matches, editionId, series);
    rounds.push(semi);

    const finalSlots = semi.matchups.flatMap((m, i) => [
      winnerSlot(m, `Vencedor da Semifinal ${i + 1}`),
    ]);
    rounds.push(buildRound("final", finalSlots, matches, editionId, series));

    const terceiroSlots = semi.matchups.flatMap((m, i) => [
      loserSlot(m, `Perdedor da Semifinal ${i + 1}`),
    ]);
    rounds.push(buildRound("terceiro", terceiroSlots, matches, editionId, series));
  } else if (quartas.matchups.length === 2) {
    const finalSlots = quartas.matchups.flatMap((m, i) => [
      winnerSlot(m, `Vencedor do Jogo ${i + 1}`),
    ]);
    rounds.push(buildRound("final", finalSlots, matches, editionId, series));

    const terceiroSlots = quartas.matchups.flatMap((m, i) => [
      loserSlot(m, `Perdedor do Jogo ${i + 1}`),
    ]);
    rounds.push(buildRound("terceiro", terceiroSlots, matches, editionId, series));
  }

  return { series, groupA: "A", groupB: "B", rounds };
}

/**
 * Pares (mandante/visitante) da rodada de quartas prontos para gerar as
 * partidas reais no banco — só inclui pares em que os dois times já foram
 * decididos pela classificação (grupo completo).
 */
export function resolvedQuartasPairs(params: {
  series: Series;
  standings: GroupStandings[];
  spots: number;
}): Array<{ homeTeamId: string; awayTeamId: string }> {
  const { series, standings, spots } = params;
  const groupA = standings.find((s) => s.group === "A");
  const groupB = standings.find((s) => s.group === "B");
  if (!groupA || !groupB || !groupA.complete || !groupB.complete) return [];

  const fromBottom = series === "Prata";
  const qualifiersA = groupQualifiers(groupA, "A", spots, fromBottom);
  const qualifiersB = groupQualifiers(groupB, "B", spots, fromBottom);

  return crossPairs(qualifiersA, qualifiersB)
    .filter(([a, b]) => a.kind === "team" && b.kind === "team")
    .map(([a, b]) => ({
      homeTeamId: (a as Extract<QualifierSlot, { kind: "team" }>).teamId,
      awayTeamId: (b as Extract<QualifierSlot, { kind: "team" }>).teamId,
    }));
}

export function bracketSlotLabel(slot: BracketSlot): string {
  return slot.kind === "team" ? slot.name : slot.label;
}
