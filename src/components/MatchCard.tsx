import { useState } from "react";
import { Clock, MapPin } from "lucide-react";
import { type Match, type Team } from "@/hooks/use-tournament";
import { formatKickoffShort, phaseLabel, statusLabel } from "@/lib/tournament";
import { cn } from "@/lib/utils";
import { TeamCrest } from "@/components/TeamCrest";
import { MatchDetailDialog } from "@/components/MatchDetailDialog";
import { Badge } from "@/components/ui/badge";

/** Escudo grande com o nome embaixo — o lado de um confronto no card de jogo. */
function MatchCardSide({ team }: { team: Team | undefined }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <TeamCrest
        logoUrl={team?.logo_url}
        name={team?.name ?? "?"}
        size="xl"
        className="size-18 sm:size-22"
      />
      <span className="text-stencil line-clamp-2 w-full text-center text-sm leading-tight font-bold text-balance sm:text-base">
        {team?.name ?? "A definir"}
      </span>
    </div>
  );
}

export function MatchCard({ match, teams }: { match: Match; teams: Team[] }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const home = teams.find((t) => t.id === match.home_team_id);
  const away = teams.find((t) => t.id === match.away_team_id);
  const played = match.status !== "agendada";
  const live = match.status === "em_andamento";

  return (
    <>
      <button
        type="button"
        onClick={() => setDetailOpen(true)}
        aria-label={`Ver detalhes de ${home?.name ?? "A definir"} contra ${away?.name ?? "A definir"}`}
        className="surface-card block w-full cursor-pointer p-3 text-left transition-colors hover:border-primary/50 sm:p-4"
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground sm:text-xs">
          <Badge variant="secondary" className="text-stencil">
            {phaseLabel(match.phase)}
            {match.group_name ? ` · Grupo ${match.group_name}` : ""}
          </Badge>
          <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground sm:text-base">
            <Clock className="size-4" /> {formatKickoffShort(match.kickoff_at)}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="size-3.5" /> {match.field}
          </span>
          <span
            className={cn(
              "ml-auto",
              live
                ? "flex items-center gap-1.5 font-semibold text-primary"
                : "text-muted-foreground",
            )}
          >
            {live && <span className="size-1.5 animate-pulse rounded-full bg-primary" />}
            {statusLabel(match.status)}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 pb-1 sm:gap-4">
          <MatchCardSide team={home} />
          <div
            className={cn(
              "text-stencil rounded-lg px-2.5 py-1 text-xl font-bold tabular-nums sm:px-3 sm:text-3xl",
              live ? "bg-primary/25 text-primary-foreground ring-1 ring-primary/50" : "bg-white/10",
            )}
          >
            {played ? `${match.home_score} : ${match.away_score}` : "x"}
          </div>
          <MatchCardSide team={away} />
        </div>
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
