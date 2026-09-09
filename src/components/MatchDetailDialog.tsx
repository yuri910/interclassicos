import { Link } from "@tanstack/react-router";
import { Clock, Instagram, MapPin } from "lucide-react";
import { usePlayers, type Match, type Team } from "@/hooks/use-tournament";
import { instagramUrl } from "@/hooks/use-instagram";
import { formatKickoff, matchGroupLabel, phaseLabel, statusLabel } from "@/lib/tournament";
import { cn } from "@/lib/utils";
import { TeamCrest } from "@/components/TeamCrest";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/** Escudo + nome do time, clicáveis, levando para a página do time. */
function TeamSide({ team, onNavigate }: { team: Team | undefined; onNavigate: () => void }) {
  if (!team) {
    return (
      <div className="flex min-w-0 flex-col items-center gap-2">
        <TeamCrest name="?" size="xl" className="size-20 sm:size-28" />
        <span className="text-stencil text-center text-sm font-bold text-muted-foreground">
          A definir
        </span>
      </div>
    );
  }

  return (
    <Link
      to="/times/$teamId"
      params={{ teamId: team.id }}
      onClick={onNavigate}
      className="flex min-w-0 flex-col items-center gap-2 rounded-xl p-2 transition-colors hover:bg-white/5"
    >
      <TeamCrest
        logoUrl={team.logo_url}
        name={team.name}
        size="xl"
        className="size-20 sm:size-28"
      />
      <span className="text-stencil w-full text-center text-sm font-bold text-balance sm:text-lg">
        {team.name}
      </span>
      {team.instagram && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Instagram className="size-3" />@{team.instagram}
        </span>
      )}
    </Link>
  );
}

function Lineup({
  team,
  players,
}: {
  team: Team | undefined;
  players: ReturnType<typeof usePlayers>["data"];
}) {
  const squad = (players ?? []).filter((p) => p.team_id === team?.id);

  return (
    <div className="min-w-0">
      <h3 className="text-stencil mb-2 truncate text-xs font-bold text-primary sm:text-sm">
        {team?.name ?? "A definir"}
      </h3>
      {squad.length === 0 ? (
        <p className="text-xs text-muted-foreground">Escalação não cadastrada.</p>
      ) : (
        <ul className="space-y-1.5">
          {squad.map((p) => (
            <li key={p.id} className="flex min-w-0 items-baseline gap-2 text-sm">
              <span className="w-6 shrink-0 text-right text-xs font-bold tabular-nums text-muted-foreground">
                {p.shirt_number ?? "–"}
              </span>
              <span className="min-w-0">
                <span className="font-semibold">{p.name}</span>
                {p.instagram && (
                  <a
                    href={instagramUrl(p.instagram)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary"
                  >
                    <Instagram className="size-3" />@{p.instagram}
                  </a>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MatchDetailDialog({
  match,
  teams,
  open,
  onOpenChange,
}: {
  match: Match;
  teams: Team[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: players } = usePlayers();
  const home = teams.find((t) => t.id === match.home_team_id);
  const away = teams.find((t) => t.id === match.away_team_id);
  const played = match.status !== "agendada";
  const live = match.status === "em_andamento";
  const groupLabel = matchGroupLabel(match);
  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto p-4 sm:p-6">
        <DialogTitle className="sr-only">
          {home?.name ?? "A definir"} x {away?.name ?? "A definir"}
        </DialogTitle>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pr-8 text-[11px] text-muted-foreground sm:text-xs">
          <Badge variant="secondary" className="text-stencil">
            {phaseLabel(match.phase)}
            {groupLabel ? ` · ${groupLabel}` : ""}
          </Badge>
          <span className="flex items-center gap-1.5 text-base font-semibold text-foreground sm:text-lg">
            <Clock className="size-4 sm:size-5" /> {formatKickoff(match.kickoff_at)}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="size-3.5" /> {match.field}
          </span>
          <span
            className={cn(
              live
                ? "flex items-center gap-1.5 font-semibold text-primary"
                : "text-muted-foreground",
            )}
          >
            {live && <span className="size-1.5 animate-pulse rounded-full bg-primary" />}
            {statusLabel(match.status)}
          </span>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
          <TeamSide team={home} onNavigate={close} />
          <div
            className={cn(
              "text-stencil rounded-xl px-3 py-1.5 text-2xl font-bold tabular-nums sm:text-4xl",
              live ? "bg-primary/25 text-primary-foreground ring-1 ring-primary/50" : "bg-white/10",
            )}
          >
            {played ? `${match.home_score} : ${match.away_score}` : "x"}
          </div>
          <TeamSide team={away} onNavigate={close} />
        </div>

        <div className="border-t border-border pt-4">
          <p className="text-stencil mb-3 text-xs font-bold text-muted-foreground">Escalações</p>
          <div className="grid grid-cols-2 gap-4 sm:gap-8">
            <Lineup team={home} players={players} />
            <Lineup team={away} players={players} />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Toque no escudo do time para abrir a página dele e cadastrar o seu Instagram.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
