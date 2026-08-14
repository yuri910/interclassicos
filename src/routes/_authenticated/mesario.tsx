import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { ClipboardList, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEditions, useEvents, useMatches, useTeams } from "@/hooks/use-tournament";
import { formatKickoff, matchGroupLabel, phaseLabel, statusLabel } from "@/lib/tournament";
import { computeGroupStandings } from "@/lib/standings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/_authenticated/mesario")({
  head: () => ({
    meta: [
      { title: "Mesário — Interclássicos" },
      { name: "description", content: "Escolha a partida para preencher a súmula." },
      { property: "og:title", content: "Mesário — Interclássicos" },
      { property: "og:description", content: "Escolha a partida para preencher a súmula." },
    ],
  }),
  component: MesarioPage,
});

function MesarioPage() {
  const { data: matches } = useMatches();
  const { data: teams } = useTeams();
  const { data: editions } = useEditions();
  const { data: events } = useEvents();
  const queryClient = useQueryClient();

  const deleteMatch = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("match_events").delete().eq("match_id", id);
      const { error } = await supabase.from("matches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      toast.success("Partida removida.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleDeleteMatch = (id: string) => {
    if (
      !window.confirm(
        "Tem certeza que deseja deletar este jogo? Esta ação removerá o jogo e todos os lançamentos da súmula.",
      )
    ) {
      return;
    }

    deleteMatch.mutate(id);
  };

  const teamName = (id: string | null) => teams?.find((t) => t.id === id)?.name ?? "A definir";

  const activeEdition =
    (editions ?? []).find((edition) => edition.is_active) ?? editions?.[0] ?? null;
  // Só mostra os jogos da edição em uso — evita misturar tabelas de edições diferentes.
  const editionMatchesAll = (matches ?? []).filter(
    (match) => match.edition_id === activeEdition?.id,
  );
  const activeMatches = editionMatchesAll.filter((match) => match.status !== "encerrada");
  const archivedMatches = editionMatchesAll.filter((match) => match.status === "encerrada");

  const playoffSummary = useMemo(() => {
    if (!activeEdition) return null;

    const editionTeams = (teams ?? []).filter((team) => team.edition_id === activeEdition.id);
    const editionMatches = (matches ?? []).filter((match) => match.edition_id === activeEdition.id);

    const standings = computeGroupStandings({
      teams: editionTeams,
      matches: editionMatches,
      events: events ?? [],
    });
    const ouroSpots = activeEdition.ouro_qualifiers ?? 4;
    const prataSpots = activeEdition.prata_qualifiers ?? 3;
    const allComplete = standings.length > 0 && standings.every((entry) => entry.complete);

    return {
      groups: standings,
      ouroSpots,
      prataSpots,
      allComplete,
    };
  }, [activeEdition, teams, matches, events]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-stencil flex items-center gap-2 text-4xl font-bold">
        <ClipboardList className="size-8 text-primary" /> Mesário
      </h1>
      <p className="mt-1 text-muted-foreground">
        Selecione uma partida para lançar gols, cartões e o placar final. Os mesários também podem
        deletar jogos, com confirmação antes de remover.
      </p>

      {playoffSummary && (
        <div className="surface-card mt-6 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-stencil text-lg font-bold">Classificação para playoffs</h2>
              <p className="text-sm text-muted-foreground">
                {playoffSummary.allComplete
                  ? "Os times abaixo já podem ser vistos como candidatos para as fases finais."
                  : "Aguardando todos os jogos da fase de grupos para definir os classificados."}
              </p>
            </div>
            <Badge variant="secondary">Série Ouro / Série Prata</Badge>
          </div>

          {!playoffSummary.allComplete ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Ainda faltam resultados para confirmar quem avança para quartas, Série Ouro e Série
              Prata.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {playoffSummary.groups.map((entry) => (
                <div
                  key={entry.group}
                  className="rounded-md border border-border/50 bg-background/70 p-3"
                >
                  <p className="text-sm font-semibold">Grupo {entry.group}</p>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Série Ouro
                      </p>
                      <ul className="mt-1 space-y-1 text-sm">
                        {entry.rows.slice(0, playoffSummary.ouroSpots).map((row) => (
                          <li key={row.teamId} className="text-foreground">
                            • {row.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Série Prata
                      </p>
                      <ul className="mt-1 space-y-1 text-sm">
                        {entry.rows
                          .slice(-playoffSummary.prataSpots)
                          .reverse()
                          .map((row) => (
                            <li key={row.teamId} className="text-foreground">
                              • {row.name}
                            </li>
                          ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-8 space-y-3">
        {activeMatches.length === 0 && archivedMatches.length === 0 && (
          <div className="surface-card p-8 text-center text-muted-foreground">
            Nenhuma partida cadastrada. Peça ao administrador para criar a tabela de jogos.
          </div>
        )}

        {activeMatches.length > 0 && (
          <div className="space-y-3">
            {activeMatches.map((m) => (
              <div key={m.id} className="surface-card flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary">{phaseLabel(m.phase)}</Badge>
                    <span>{formatKickoff(m.kickoff_at)}</span>
                    <span>· {m.field}</span>
                    <span>· {statusLabel(m.status)}</span>
                  </div>
                  {matchGroupLabel(m) && (
                    <p className="mt-0.5 text-xs font-semibold text-primary">
                      {matchGroupLabel(m)}
                    </p>
                  )}
                  <p className="text-stencil mt-1 text-lg font-bold">
                    {teamName(m.home_team_id)} {m.home_score} x {m.away_score}{" "}
                    {teamName(m.away_team_id)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button asChild size="sm">
                    <Link to="/sumula/$matchId" params={{ matchId: m.id }}>
                      Abrir súmula
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={deleteMatch.isPending}
                    onClick={() => handleDeleteMatch(m.id)}
                  >
                    <Trash2 className="size-4" />
                    Deletar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {archivedMatches.length > 0 && (
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="closed-matches" className="border-none">
              <AccordionTrigger className="surface-card justify-between rounded-lg px-4 py-3 text-left">
                <span className="text-stencil font-semibold">Partidas encerradas</span>
                <Badge variant="secondary">{archivedMatches.length}</Badge>
              </AccordionTrigger>
              <AccordionContent className="mt-2 space-y-3">
                {archivedMatches.map((m) => (
                  <div key={m.id} className="surface-card flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary">{phaseLabel(m.phase)}</Badge>
                        <span>{formatKickoff(m.kickoff_at)}</span>
                        <span>· {m.field}</span>
                        <span>· {statusLabel(m.status)}</span>
                      </div>
                      {matchGroupLabel(m) && (
                        <p className="mt-0.5 text-xs font-semibold text-primary">
                          {matchGroupLabel(m)}
                        </p>
                      )}
                      <p className="text-stencil mt-1 text-lg font-bold">
                        {teamName(m.home_team_id)} {m.home_score} x {m.away_score}{" "}
                        {teamName(m.away_team_id)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button asChild size="sm">
                        <Link to="/sumula/$matchId" params={{ matchId: m.id }}>
                          Abrir súmula
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={deleteMatch.isPending}
                        onClick={() => handleDeleteMatch(m.id)}
                      >
                        <Trash2 className="size-4" />
                        Deletar
                      </Button>
                    </div>
                  </div>
                ))}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </div>
    </main>
  );
}
