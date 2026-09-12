export const PHASES = [
  { value: "grupos", label: "Fase de grupos" },
  { value: "oitavas", label: "Oitavas" },
  { value: "quartas", label: "Quartas" },
  { value: "semi", label: "Semifinal" },
  { value: "terceiro", label: "3º lugar" },
  { value: "final", label: "Final" },
] as const;

export const STATUS = [
  { value: "agendada", label: "Agendada" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "encerrada", label: "Encerrada" },
] as const;

export function phaseLabel(value: string) {
  return PHASES.find((p) => p.value === value)?.label ?? value;
}

export function statusLabel(value: string) {
  return STATUS.find((s) => s.value === value)?.label ?? value;
}

/** Rótulo do grupo/série de uma partida — "Grupo A" na fase de grupos, "Série Ouro/Prata" nos playoffs. */
export function matchGroupLabel(match: { phase: string; group_name: string | null }) {
  if (!match.group_name) return null;
  return match.phase === "grupos" ? `Grupo ${match.group_name}` : `Série ${match.group_name}`;
}

/** Sempre dd/mm/yyyy, independente da localidade do navegador. */
export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Sempre 24 horas (HH:mm), independente da localidade do navegador. */
export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatWeekday(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { weekday: "short" });
}

export function formatKickoff(iso: string) {
  return `${formatWeekday(iso)} ${formatDate(iso)} ${formatTime(iso)}`;
}

/** "sáb. 17:30" — sem a data, para quando o card já está sob um título de dia. */
export function formatKickoffShort(iso: string) {
  return `${formatWeekday(iso)} ${formatTime(iso)}`;
}

/** Agrupa uma lista de partidas por dia (mantendo a ordem cronológica de entrada em cada
 * grupo), com uma chave de exibição tipo "sábado · 12/09/2026" — usado para organizar telas
 * de jogos (Partidas, Mesário) em blocos por dia em vez de uma lista única. */
export function groupMatchesByDay<T extends { kickoff_at: string }>(
  list: T[],
): Record<string, T[]> {
  return list.reduce<Record<string, T[]>>((acc, m) => {
    const weekday = new Date(m.kickoff_at).toLocaleDateString("pt-BR", { weekday: "long" });
    const key = `${weekday} · ${formatDate(m.kickoff_at)}`;
    (acc[key] ??= []).push(m);
    return acc;
  }, {});
}
