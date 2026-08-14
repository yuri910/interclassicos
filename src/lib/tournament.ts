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
