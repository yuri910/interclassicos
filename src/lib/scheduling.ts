export function parseClock(value: string, label = "Período diário"): number {
  const parts = value.split(":");
  if (parts.length !== 2) throw new Error(`${label} inválido`);
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error(`${label} inválido`);
  }
  return hours * 60 + minutes;
}

export type SchedulerConfig = {
  sortedDates: string[];
  dayStartMinutes: number;
  dayEndMinutes: number;
  blockedWindows: Array<{ start: number; end: number }>;
  fields: string[];
  stepMinutes: number;
};

/**
 * Distribui partidas nos campos/horários disponíveis: um jogo por campo em
 * cada horário; só avança para o próximo horário quando todos os campos do
 * horário atual já têm um jogo marcado. Pula janelas bloqueadas (ex.:
 * almoço) e troca de data quando o período diário acaba.
 *
 * Compartilhado entre o sorteio da fase de grupos e a geração dos playoffs,
 * para que ambos respeitem as mesmas datas/campos/horários configurados.
 */
export function createScheduler(config: SchedulerConfig) {
  const { sortedDates, dayStartMinutes, dayEndMinutes, blockedWindows, fields, stepMinutes } =
    config;
  if (sortedDates.length === 0) throw new Error("Selecione ao menos uma data do evento");
  if (fields.length === 0) throw new Error("Informe ao menos um campo");

  const atDayStart = (dateIndex: number) => {
    const d = new Date(`${sortedDates[dateIndex]}T00:00:00`);
    d.setHours(Math.floor(dayStartMinutes / 60), dayStartMinutes % 60, 0, 0);
    return d;
  };

  const resolveSlot = (candidate: Date, dateIndex: number): { date: Date; dateIndex: number } => {
    let date = candidate;
    let index = dateIndex;
    for (;;) {
      const dayEnd = new Date(date);
      dayEnd.setHours(Math.floor(dayEndMinutes / 60), dayEndMinutes % 60, 0, 0);
      if (date > dayEnd) {
        index += 1;
        if (index >= sortedDates.length) {
          throw new Error("Não há espaço suficiente para todos os jogos nas datas informadas");
        }
        date = atDayStart(index);
        continue;
      }
      const minutesOfDay = date.getHours() * 60 + date.getMinutes();
      const blocking = blockedWindows.find((w) => minutesOfDay >= w.start && minutesOfDay < w.end);
      if (blocking) {
        date = new Date(date);
        date.setHours(Math.floor(blocking.end / 60), blocking.end % 60, 0, 0);
        continue;
      }
      return { date, dateIndex: index };
    }
  };

  const findDateIndexFor = (date: Date) => {
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const idx = sortedDates.indexOf(iso);
    return idx >= 0 ? idx : 0;
  };

  let slot = 0;
  let currentKickoff: Date;
  let currentDateIndex: number;

  const seedAtStart = () => {
    const first = resolveSlot(atDayStart(0), 0);
    currentKickoff = first.date;
    currentDateIndex = first.dateIndex;
    slot = 0;
  };
  seedAtStart();

  const advanceToNextSlot = () => {
    const next = resolveSlot(
      new Date(currentKickoff.getTime() + stepMinutes * 60000),
      currentDateIndex,
    );
    currentKickoff = next.date;
    currentDateIndex = next.dateIndex;
  };

  return {
    /** Reposiciona o cursor para continuar logo após um horário já usado (ex.: seguir depois da fase de grupos). */
    seedAfter(lastKickoff: Date) {
      const dateIndex = findDateIndexFor(lastKickoff);
      const next = resolveSlot(new Date(lastKickoff.getTime() + stepMinutes * 60000), dateIndex);
      currentKickoff = next.date;
      currentDateIndex = next.dateIndex;
      slot = 0;
    },
    next(): { kickoff: Date; field: string } {
      const field = fields[slot % fields.length]!;
      const kickoff = currentKickoff;
      slot += 1;
      if (slot % fields.length === 0) {
        advanceToNextSlot();
      }
      return { kickoff, field };
    },
    /**
     * Fecha o horário atual mesmo que nem todos os campos tenham sido
     * usados, para que a próxima rodada (ver `roundRobinRounds`) sempre
     * comece num horário novo — nunca dividindo horário com jogos de uma
     * rodada em que os mesmos times já podem ter jogado.
     */
    finishRound() {
      if (slot % fields.length !== 0) {
        advanceToNextSlot();
      }
      slot = 0;
    },
  };
}

/**
 * Gera as rodadas de um turno único (todos contra todos uma vez) pelo
 * método do círculo: fixa o primeiro time e roda os demais a cada rodada.
 * Cada rodada é um conjunto de confrontos em que nenhum time se repete —
 * por isso é seguro agendar uma rodada inteira no mesmo horário (em campos
 * diferentes) sem que ninguém jogue duas vezes ao mesmo tempo. Como todo
 * time joga no máximo uma vez por rodada, e as rodadas avançam em sequência
 * estrita (ver `finishRound`), o intervalo entre os jogos de cada time fica
 * praticamente igual. Com número ímpar de times, um time fica de folga por
 * rodada (padrão em qualquer turno único com número ímpar de participantes).
 */
export function roundRobinRounds<T>(items: T[]): Array<Array<[T, T]>> {
  const BYE = Symbol("bye");
  const rotating: Array<T | typeof BYE> = [...items];
  if (rotating.length % 2 !== 0) rotating.push(BYE);
  const n = rotating.length;
  if (n < 2) return [];

  const rounds: Array<Array<[T, T]>> = [];
  for (let r = 0; r < n - 1; r++) {
    const round: Array<[T, T]> = [];
    for (let i = 0; i < n / 2; i++) {
      const home = rotating[i]!;
      const away = rotating[n - 1 - i]!;
      if (home !== BYE && away !== BYE) round.push([home, away]);
    }
    rounds.push(round);
    // Time 0 fica fixo; os demais giram uma posição a cada rodada.
    const last = rotating.pop()!;
    rotating.splice(1, 0, last);
  }
  return rounds;
}
