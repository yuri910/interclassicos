import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Clock } from "lucide-react";
import {
  useEditions,
  useEvents,
  useMatches,
  useTeams,
  type Match,
  type Team,
} from "@/hooks/use-tournament";
import { formatDate, formatKickoff, phaseLabel, statusLabel } from "@/lib/tournament";
import { computeGroupStandings, type GroupStandings } from "@/lib/standings";
import {
  buildSeriesBracket,
  bracketSlotLabel,
  type BracketMatchup,
  type Series,
} from "@/lib/bracket";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Partidas — Interclássicos" },
      {
        name: "description",
        content: "Veja todos os jogos do campeonato: data, horário, campo e placar ao vivo.",
      },
      { property: "og:title", content: "Partidas — Interclássicos" },
      {
        property: "og:description",
        content: "Veja todos os jogos do campeonato: data, horário, campo e placar.",
      },
    ],
  }),
  component: MatchesPage,
});

export function MatchCard({ match, teams }: { match: Match; teams: Team[] }) {
  const home = teams.find((t) => t.id === match.home_team_id);
  const away = teams.find((t) => t.id === match.away_team_id);
  const played = match.status !== "agendada";

  return (
    <article className="surface-card p-4 transition-colors hover:border-primary/50">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary" className="text-stencil">
          {phaseLabel(match.phase)}
          {match.group_name ? ` · Grupo ${match.group_name}` : ""}
        </Badge>
        <span className="flex items-center gap-1">
          <Clock className="size-3.5" /> {formatKickoff(match.kickoff_at)}
        </span>
        <span className="flex items-center gap-1">
          <MapPin className="size-3.5" /> {match.field}
        </span>
        <span
          className={
            match.status === "em_andamento"
              ? "ml-auto font-semibold text-primary"
              : "ml-auto text-muted-foreground"
          }
        >
          {statusLabel(match.status)}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="text-stencil truncate text-right text-lg font-bold">
          {home?.crest_emoji ?? ""} {home?.name ?? "A definir"}
        </div>
        <div className="text-stencil rounded-md bg-secondary px-3 py-1 text-2xl font-bold tabular-nums">
          {played ? `${match.home_score} : ${match.away_score}` : "x"}
        </div>
        <div className="text-stencil truncate text-lg font-bold">
          {away?.name ?? "A definir"} {away?.crest_emoji ?? ""}
        </div>
      </div>
    </article>
  );
}

function groupByDay(list: Match[]) {
  return list.reduce<Record<string, Match[]>>((acc, m) => {
    const weekday = new Date(m.kickoff_at).toLocaleDateString("pt-BR", { weekday: "long" });
    const key = `${weekday} · ${formatDate(m.kickoff_at)}`;
    (acc[key] ??= []).push(m);
    return acc;
  }, {});
}

function MatchGroups({
  matches,
  teams,
  emptyMessage,
}: {
  matches: Match[];
  teams: Team[];
  emptyMessage: string;
}) {
  const grouped = groupByDay(matches);

  if (matches.length === 0) {
    return <div className="surface-card p-8 text-center text-muted-foreground">{emptyMessage}</div>;
  }

  return (
    <div className="space-y-8">
      {Object.entries(grouped).map(([day, list]) => (
        <section key={day}>
          <h2 className="text-stencil mb-3 text-sm font-bold text-primary">{day}</h2>
          <div className="space-y-3">
            {list.map((m) => (
              <MatchCard key={m.id} match={m} teams={teams} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Card de um confronto ainda não decidido: mostra a vaga pela posição
 * ("Vaga 2º Lugar do Grupo A") ou o vencedor projetado ("Vencedor do Jogo 1")
 * até que a partida real exista no calendário. */
function BracketPlaceholderCard({ matchup }: { matchup: BracketMatchup }) {
  const bothResolved = matchup.home.kind === "team" && matchup.away.kind === "team";
  return (
    <article className="surface-card border-dashed p-4 opacity-90">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary" className="text-stencil">
          {bothResolved ? "Aguardando calendário" : "A definir"}
        </Badge>
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div
          className={cn(
            "truncate text-right text-sm font-bold",
            matchup.home.kind === "placeholder" && "italic text-muted-foreground",
          )}
        >
          {bracketSlotLabel(matchup.home)}
        </div>
        <div className="rounded-md bg-secondary px-3 py-1 text-lg font-bold text-muted-foreground">
          x
        </div>
        <div
          className={cn(
            "truncate text-sm font-bold",
            matchup.away.kind === "placeholder" && "italic text-muted-foreground",
          )}
        >
          {bracketSlotLabel(matchup.away)}
        </div>
      </div>
    </article>
  );
}

function SeriesBracket({
  series,
  standings,
  spots,
  matches,
  teams,
  editionId,
}: {
  series: Series;
  standings: GroupStandings[];
  spots: number;
  matches: Match[];
  teams: Team[];
  editionId: string | null;
}) {
  const bracket = buildSeriesBracket({ series, standings, spots, matches, editionId });

  return (
    <section>
      <h3
        className={
          series === "Ouro"
            ? "text-stencil text-lg font-bold text-amber-500"
            : "text-stencil text-lg font-bold text-slate-400"
        }
      >
        Série {series}
      </h3>
      {!bracket || bracket.rounds.length === 0 ? (
        <div className="surface-card mt-3 p-6 text-center text-sm text-muted-foreground">
          Confrontos da Série {series} ainda não foram definidos.
        </div>
      ) : (
        <div className="mt-3 flex gap-4 overflow-x-auto pb-2">
          {bracket.rounds.map((round) => (
            <div key={round.phase} className="flex w-64 shrink-0 flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {round.label}
              </p>
              <div className="flex flex-1 flex-col justify-around gap-3">
                {round.matchups.map((m) =>
                  m.match ? (
                    <MatchCard key={m.key} match={m.match} teams={teams} />
                  ) : (
                    <BracketPlaceholderCard key={m.key} matchup={m} />
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PlayoffBracket({
  standings,
  ouroSpots,
  prataSpots,
  matches,
  teams,
  editionId,
}: {
  standings: GroupStandings[];
  ouroSpots: number;
  prataSpots: number;
  matches: Match[];
  teams: Team[];
  editionId: string | null;
}) {
  return (
    <div className="space-y-8">
      <SeriesBracket
        series="Ouro"
        standings={standings}
        spots={ouroSpots}
        matches={matches}
        teams={teams}
        editionId={editionId}
      />
      <SeriesBracket
        series="Prata"
        standings={standings}
        spots={prataSpots}
        matches={matches}
        teams={teams}
        editionId={editionId}
      />
    </div>
  );
}

function MatchesPage() {
  const { data: matches, isLoading } = useMatches();
  const { data: teams } = useTeams();
  const { data: editions } = useEditions();
  const { data: events } = useEvents();

  const activeEdition = (editions ?? []).find((e) => e.is_active) ?? editions?.[0] ?? null;
  // Só mostra a edição em uso — evita misturar jogos/chaveamento de edições diferentes.
  const editionTeams = (teams ?? []).filter(
    (t) => !activeEdition || t.edition_id === activeEdition.id,
  );
  const editionMatches = (matches ?? []).filter(
    (m) => !activeEdition || m.edition_id === activeEdition.id,
  );
  const groupStandings = computeGroupStandings({
    teams: editionTeams,
    matches: editionMatches,
    events: events ?? [],
  });
  const ouroSpots = activeEdition?.ouro_qualifiers ?? 4;
  const prataSpots = activeEdition?.prata_qualifiers ?? 3;

  const upcoming = editionMatches
    .filter((m) => m.status !== "encerrada")
    .sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at));
  const finished = editionMatches
    .filter((m) => m.status === "encerrada")
    .sort((a, b) => b.kickoff_at.localeCompare(a.kickoff_at));

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-stencil text-4xl font-bold">Tabela de jogos</h1>
      <p className="mt-1 text-muted-foreground">
        Horários, campos e resultados de todas as partidas do campeonato.
      </p>

      <div className="mt-8">
        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        )}

        {!isLoading && editionMatches.length === 0 && (
          <div className="surface-card p-8 text-center">
            <p className="text-muted-foreground">Nenhuma partida cadastrada ainda.</p>
            <Link to="/auth" className="mt-3 inline-block font-semibold text-primary">
              Entrar para organizar o campeonato
            </Link>
          </div>
        )}

        {!isLoading && editionMatches.length > 0 && (
          <Tabs defaultValue="upcoming">
            <TabsList>
              <TabsTrigger value="upcoming">Próximos jogos</TabsTrigger>
              <TabsTrigger value="finished">Jogos encerrados</TabsTrigger>
              <TabsTrigger value="playoffs">Playoffs</TabsTrigger>
            </TabsList>
            <TabsContent value="upcoming" className="mt-6">
              <MatchGroups
                matches={upcoming}
                teams={teams ?? []}
                emptyMessage="Nenhum jogo agendado no momento."
              />
            </TabsContent>
            <TabsContent value="finished" className="mt-6">
              <MatchGroups
                matches={finished}
                teams={teams ?? []}
                emptyMessage="Nenhum jogo encerrado ainda."
              />
            </TabsContent>
            <TabsContent value="playoffs" className="mt-6">
              <PlayoffBracket
                standings={groupStandings}
                ouroSpots={ouroSpots}
                prataSpots={prataSpots}
                matches={editionMatches}
                teams={teams ?? []}
                editionId={activeEdition?.id ?? null}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </main>
  );
}
