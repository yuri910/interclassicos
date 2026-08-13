import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useEditions, useEvents, useMatches, useTeams } from "@/hooks/use-tournament";
import { computeGroupStandings } from "@/lib/standings";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/classificacao")({
  head: () => ({
    meta: [
      { title: "Classificação dos grupos — Interclássicos" },
      {
        name: "description",
        content: "Classificação de cada grupo com pontos, saldo de gols e aproveitamento.",
      },
      { property: "og:title", content: "Classificação dos grupos — Interclássicos" },
      {
        property: "og:description",
        content: "Pontos, vitórias, saldo de gols e classificação de cada grupo.",
      },
    ],
  }),
  component: StandingsPage,
});

function StandingsPage() {
  const { data: teams } = useTeams();
  const { data: matches } = useMatches();
  const { data: events } = useEvents();
  const { data: editions } = useEditions();
  const [includeLive, setIncludeLive] = useState(true);

  const activeEdition = useMemo(
    () => (editions ?? []).find((e) => e.is_active) ?? editions?.[0] ?? null,
    [editions],
  );
  const ouroSpots = activeEdition?.ouro_qualifiers ?? 4;
  const prataSpots = activeEdition?.prata_qualifiers ?? 3;

  // Times/partidas de outras edições nunca entram na conta — evita misturar
  // grupos de edições diferentes e usar o formato errado para cada uma.
  const editionTeams = useMemo(
    () => (teams ?? []).filter((t) => t.edition_id === activeEdition?.id),
    [teams, activeEdition],
  );
  const editionMatches = useMemo(
    () => (matches ?? []).filter((m) => m.edition_id === activeEdition?.id),
    [matches, activeEdition],
  );

  const groups = useMemo(() => {
    const standings = computeGroupStandings({
      teams: editionTeams,
      matches: editionMatches,
      events: events ?? [],
      includeLive,
    });
    return standings.map(({ group, rows }) => {
      const ouroCount = Math.min(ouroSpots, rows.length);
      const prataCount = Math.min(prataSpots, Math.max(0, rows.length - ouroCount));
      const ranked = rows.map((row, index) => ({
        ...row,
        zone:
          index < ouroCount
            ? ("ouro" as const)
            : index >= rows.length - prataCount
              ? ("prata" as const)
              : null,
      }));
      return { group, rows: ranked };
    });
  }, [editionTeams, editionMatches, events, includeLive, ouroSpots, prataSpots]);

  const liveCount = editionMatches.filter(
    (m) => m.phase === "grupos" && m.status === "em_andamento",
  ).length;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-stencil text-4xl font-bold">Classificação</h1>
      <p className="mt-1 text-muted-foreground">
        Atualizada automaticamente a partir dos gols lançados na súmula.
      </p>

      <div className="surface-card mt-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Label htmlFor="live" className="text-sm">
          Incluir partidas em andamento{liveCount > 0 ? ` (${liveCount})` : ""}
        </Label>
        <Switch id="live" checked={includeLive} onCheckedChange={setIncludeLive} />
      </div>

      <div className="mt-6 space-y-8">
        {groups.length === 0 && (
          <div className="surface-card p-8 text-center text-muted-foreground">
            Cadastre os times para ver a classificação.
          </div>
        )}
        {groups.map(({ group, rows }) => (
          <section key={group} className="surface-card overflow-hidden">
            <h2 className="text-stencil border-b border-border px-4 py-3 text-lg font-bold text-primary">
              Grupo {group}
            </h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-right">P</TableHead>
                  <TableHead className="text-right">J</TableHead>
                  <TableHead className="text-right">V</TableHead>
                  <TableHead className="text-right">E</TableHead>
                  <TableHead className="text-right">D</TableHead>
                  <TableHead className="text-right">GP</TableHead>
                  <TableHead className="text-right">GC</TableHead>
                  <TableHead className="text-right">SG</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow
                    key={r.teamId}
                    className={cn(
                      r.zone === "ouro" && "bg-amber-500/10 hover:bg-amber-500/15",
                      r.zone === "prata" && "bg-slate-400/10 hover:bg-slate-400/15",
                    )}
                  >
                    <TableCell className="font-semibold">{r.name}</TableCell>
                    <TableCell className="text-right font-bold tabular-nums text-primary">
                      {r.points}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.j}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.v}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.e}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.d}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.gp}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.gc}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.sg}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        ))}

        {groups.length > 0 && (
          <div className="surface-card flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
            <span className="flex items-center gap-2">
              <span className="size-3 rounded-sm bg-amber-500/70" />
              Zona de classificação — Série Ouro ({ouroSpots} por grupo)
            </span>
            <span className="flex items-center gap-2">
              <span className="size-3 rounded-sm bg-slate-400/70" />
              Zona de classificação — Série Prata ({prataSpots} por grupo)
            </span>
          </div>
        )}
      </div>
    </main>
  );
}
