import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
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

/** Card de uma folga (bye): quando o número de classificados não fecha uma
 * potência de 2, alguns times avançam direto de rodada sem jogar. */
function BracketByeCard({ matchup }: { matchup: BracketMatchup }) {
  const teamSlot = matchup.home.kind !== "bye" ? matchup.home : matchup.away;
  return (
    <article className="surface-card border-dashed p-4 opacity-90">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary" className="text-stencil">
          Folga
        </Badge>
      </div>
      <p
        className={cn(
          "mt-3 truncate text-sm font-bold",
          teamSlot.kind === "placeholder" && "italic text-muted-foreground",
        )}
      >
        {bracketSlotLabel(teamSlot)}{" "}
        <span className="font-normal text-muted-foreground">avança direto, sem jogar</span>
      </p>
    </article>
  );
}

type CardRect = { top: number; bottom: number; centerY: number; left: number; right: number };

/** Compara com arredondamento — evita loop de re-render por jitter de subpixel. */
function rectsEqual(a: Map<string, CardRect>, b: Map<string, CardRect>) {
  if (a.size !== b.size) return false;
  for (const [key, ra] of a) {
    const rb = b.get(key);
    if (!rb) return false;
    if (
      Math.round(ra.top) !== Math.round(rb.top) ||
      Math.round(ra.left) !== Math.round(rb.left) ||
      Math.round(ra.right) !== Math.round(rb.right) ||
      Math.round(ra.bottom) !== Math.round(rb.bottom)
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Mede a posição real (relativa ao container) de cada card do chaveamento
 * para desenhar as linhas de conexão por cima, em vez de tentar acertar a
 * geometria só no CSS — assim a árvore fica correta mesmo com cards de
 * altura variável, telas estreitas com scroll horizontal, ou zoom.
 */
function useBracketConnectors() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [rects, setRects] = useState<Map<string, CardRect>>(new Map());

  const registerCard = useCallback(
    (key: string) => (el: HTMLDivElement | null) => {
      if (el) cardRefs.current.set(key, el);
      else cardRefs.current.delete(key);
    },
    [],
  );

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const next = new Map<string, CardRect>();
    for (const [key, el] of cardRefs.current) {
      const r = el.getBoundingClientRect();
      next.set(key, {
        top: r.top - containerRect.top,
        bottom: r.bottom - containerRect.top,
        centerY: r.top - containerRect.top + r.height / 2,
        left: r.left - containerRect.left,
        right: r.right - containerRect.left,
      });
    }
    setRects((prev) => (rectsEqual(prev, next) ? prev : next));
  }, []);

  useLayoutEffect(() => {
    measure();
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(container);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  });

  return { containerRef, registerCard, rects };
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
  const { containerRef, registerCard, rects } = useBracketConnectors();

  if (!bracket || bracket.rounds.length === 0) {
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
        <div className="surface-card mt-3 p-6 text-center text-sm text-muted-foreground">
          Confrontos da Série {series} ainda não foram definidos.
        </div>
      </section>
    );
  }

  const connectors: Array<{ key: string; d: string }> = [];
  for (let ri = 0; ri < bracket.rounds.length - 1; ri++) {
    const round = bracket.rounds[ri]!;
    for (let i = 0; i < round.matchups.length; i += 2) {
      const top = rects.get(`${ri}-${i}`);
      const bottom = rects.get(`${ri}-${i + 1}`);
      const next = rects.get(`${ri + 1}-${i / 2}`);
      if (!top || !bottom || !next) continue;
      const midX = (top.right + next.left) / 2;
      const elbowX = (midX + next.left) / 2;
      const midY = (top.centerY + bottom.centerY) / 2;
      connectors.push({
        key: `${ri}-${i}`,
        d: [
          `M ${top.right} ${top.centerY} H ${midX}`,
          `M ${bottom.right} ${bottom.centerY} H ${midX}`,
          `M ${midX} ${top.centerY} V ${bottom.centerY}`,
          `M ${midX} ${midY} H ${elbowX} V ${next.centerY} H ${next.left}`,
        ].join(" "),
      });
    }
  }

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
      <div className="mt-3 overflow-x-auto pb-2">
        <div ref={containerRef} className="relative flex w-max gap-12">
          <svg className="pointer-events-none absolute inset-0 h-full w-full">
            {connectors.map((c) => (
              <path key={c.key} d={c.d} fill="none" className="stroke-border" strokeWidth={2} />
            ))}
          </svg>
          {bracket.rounds.map((round, ri) => (
            <div key={round.phase} className="flex w-64 shrink-0 flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {round.label}
              </p>
              <div className="flex flex-1 flex-col justify-around gap-6">
                {round.matchups.map((m, mi) => (
                  <div key={m.key} ref={registerCard(`${ri}-${mi}`)}>
                    {m.home.kind === "bye" || m.away.kind === "bye" ? (
                      <BracketByeCard matchup={m} />
                    ) : m.match ? (
                      <MatchCard match={m.match} teams={teams} />
                    ) : (
                      <BracketPlaceholderCard matchup={m} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
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
