import { useEffect, useMemo, useState } from "react";
import { useEditions, useMatches, useTeams, type Match, type Team } from "@/hooks/use-tournament";
import { formatDate, formatTime, formatWeekday } from "@/lib/tournament";
import { cn } from "@/lib/utils";
import { TeamCrest } from "@/components/TeamCrest";
import { MatchDetailDialog } from "@/components/MatchDetailDialog";

/** Quantos jogos futuros a barra mostra depois dos que estão rolando. */
const UPCOMING_LIMIT = 4;

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** "HOJE 10:30", "AMANHÃ 10:30" ou "SÁB 12/09 10:30". */
function kickoffLabel(iso: string, now: Date) {
  const kickoff = new Date(iso);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (sameDay(kickoff, now)) return `Hoje ${formatTime(iso)}`;
  if (sameDay(kickoff, tomorrow)) return `Amanhã ${formatTime(iso)}`;
  return `${formatWeekday(iso)} ${formatDate(iso).slice(0, 5)} ${formatTime(iso)}`;
}

function TickerChip({ match, teams, now }: { match: Match; teams: Team[]; now: Date }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const home = teams.find((t) => t.id === match.home_team_id);
  const away = teams.find((t) => t.id === match.away_team_id);
  const live = match.status === "em_andamento";
  const played = match.status !== "agendada";

  return (
    <>
      <button
        type="button"
        onClick={() => setDetailOpen(true)}
        className={cn(
          "flex shrink-0 cursor-pointer flex-col gap-1 rounded-lg border px-2.5 py-1.5 text-left transition-colors",
          live
            ? "border-primary/50 bg-primary/15 hover:bg-primary/25"
            : "border-white/10 bg-white/5 hover:bg-white/10",
        )}
      >
        <span
          className={cn(
            "text-stencil flex items-center gap-1 text-[10px] font-bold",
            live ? "text-primary" : "text-muted-foreground",
          )}
        >
          {live && <span className="size-1.5 animate-pulse rounded-full bg-primary" />}
          {live ? "Ao vivo" : kickoffLabel(match.kickoff_at, now)}
          <span className="font-normal opacity-70">· {match.field}</span>
        </span>

        <span className="flex items-center gap-1.5">
          <TeamCrest logoUrl={home?.logo_url} name={home?.name ?? "?"} size="xs" />
          <span className="max-w-20 truncate text-xs font-bold">{home?.name ?? "A definir"}</span>
          <span className="text-xs font-bold tabular-nums text-muted-foreground">
            {played ? `${match.home_score}:${match.away_score}` : "x"}
          </span>
          <span className="max-w-20 truncate text-xs font-bold">{away?.name ?? "A definir"}</span>
          <TeamCrest logoUrl={away?.logo_url} name={away?.name ?? "?"} size="xs" />
        </span>
      </button>

      <MatchDetailDialog
        match={match}
        teams={teams}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  );
}

/**
 * Barra fixa no rodapé com o que está acontecendo agora e o que vem a seguir,
 * pelo relógio de quem está olhando.
 *
 * O relógio só entra depois da montagem: renderizar a hora no servidor daria
 * hidratação divergente, já que o servidor e o celular nunca marcam o mesmo
 * instante (nem o mesmo fuso).
 */
export function MatchTicker() {
  const { data: matches } = useMatches();
  const { data: teams } = useTeams();
  const { data: editions } = useEditions();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const activeEdition = (editions ?? []).find((e) => e.is_active) ?? editions?.[0] ?? null;

  const { live, upcoming } = useMemo(() => {
    const list = (matches ?? []).filter((m) => !activeEdition || m.edition_id === activeEdition.id);
    const byKickoff = [...list].sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at));
    const scheduled = byKickoff.filter((m) => m.status === "agendada");
    const ahead = now
      ? scheduled.filter((m) => new Date(m.kickoff_at).getTime() >= now.getTime())
      : scheduled;
    return {
      live: byKickoff.filter((m) => m.status === "em_andamento"),
      // Se o calendário já passou da hora e ninguém encerrou os jogos, mostra os
      // atrasados em vez de deixar a barra vazia.
      upcoming: (ahead.length > 0 ? ahead : scheduled).slice(0, UPCOMING_LIMIT),
    };
  }, [matches, activeEdition, now]);

  if (!now || (live.length === 0 && upcoming.length === 0)) return null;

  return (
    <>
      {/* Espaçador: a barra é fixa, então sem isso ela cobriria o fim da página. */}
      <div aria-hidden className="h-[calc(5rem+env(safe-area-inset-bottom))]" />

      <aside
        aria-label="Jogos agora e próximos"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-6xl items-center gap-2 overflow-x-auto px-3 py-2.5 [scrollbar-width:none]">
          {live.length > 0 && (
            <span className="text-stencil shrink-0 text-[10px] font-bold text-primary">Agora</span>
          )}
          {live.map((m) => (
            <TickerChip key={m.id} match={m} teams={teams ?? []} now={now} />
          ))}

          {upcoming.length > 0 && (
            <span className="text-stencil shrink-0 pl-1 text-[10px] font-bold text-muted-foreground">
              A seguir
            </span>
          )}
          {upcoming.map((m) => (
            <TickerChip key={m.id} match={m} teams={teams ?? []} now={now} />
          ))}
        </div>
      </aside>
    </>
  );
}
