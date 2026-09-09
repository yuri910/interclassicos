import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useEditions, useEvents, useMatches, useTeams } from "@/hooks/use-tournament";
import { computeGroupStandings } from "@/lib/standings";
import { cn } from "@/lib/utils";
import { TeamCrest } from "@/components/TeamCrest";
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
    <main className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
      <div className="flex items-center gap-3">
        <img
          src="/marca-bola.webp"
          alt=""
          aria-hidden
          className="size-12 shrink-0 object-contain opacity-90 sm:size-14"
        />
        <div>
          <h1 className="text-stencil text-3xl font-bold sm:text-4xl">Classificação</h1>
          <p className="mt-0.5 text-sm text-muted-foreground sm:text-base">
            Atualizada automaticamente a partir dos gols lançados na súmula.
          </p>
        </div>
      </div>

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
            {/* No celular só cabem as colunas que decidem a tabela (P, J, SG);
             * V/E/D e GP/GC voltam conforme a tela ganha largura. */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8 pl-3 pr-0 text-center">#</TableHead>
                  <TableHead className="pl-2">Time</TableHead>
                  <TableHead className="w-9 px-1 text-right sm:w-auto sm:px-2">P</TableHead>
                  <TableHead className="w-9 px-1 text-right sm:w-auto sm:px-2">J</TableHead>
                  <TableHead className="hidden px-2 text-right sm:table-cell">V</TableHead>
                  <TableHead className="hidden px-2 text-right sm:table-cell">E</TableHead>
                  <TableHead className="hidden px-2 text-right sm:table-cell">D</TableHead>
                  <TableHead className="hidden px-2 text-right md:table-cell">GP</TableHead>
                  <TableHead className="hidden px-2 text-right md:table-cell">GC</TableHead>
                  <TableHead className="w-10 px-1 pr-3 text-right sm:w-auto sm:px-2">SG</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, index) => (
                  <TableRow
                    key={r.teamId}
                    // A faixa da zona vai de box-shadow, e não de `border-l`: o
                    // TableBody zera as bordas da última linha, o que apagaria a
                    // faixa justo do último classificado.
                    className={cn(
                      r.zone === "ouro" &&
                        "bg-amber-500/10 shadow-[inset_3px_0_0_0_#fbbf24] hover:bg-amber-500/15",
                      r.zone === "prata" &&
                        "bg-slate-400/10 shadow-[inset_3px_0_0_0_#cbd5e1] hover:bg-slate-400/15",
                    )}
                  >
                    <TableCell className="pl-3 pr-0 text-center text-xs font-bold tabular-nums text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell className="pl-2 font-semibold">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <TeamCrest
                          logoUrl={r.logoUrl}
                          name={r.name}
                          size="md"
                          className="sm:size-12"
                        />
                        <span className="text-stencil truncate text-sm font-bold sm:text-base">
                          {r.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-1 text-right font-bold tabular-nums text-primary sm:px-2">
                      {r.points}
                    </TableCell>
                    <TableCell className="px-1 text-right tabular-nums sm:px-2">{r.j}</TableCell>
                    <TableCell className="hidden px-2 text-right tabular-nums sm:table-cell">
                      {r.v}
                    </TableCell>
                    <TableCell className="hidden px-2 text-right tabular-nums sm:table-cell">
                      {r.e}
                    </TableCell>
                    <TableCell className="hidden px-2 text-right tabular-nums sm:table-cell">
                      {r.d}
                    </TableCell>
                    <TableCell className="hidden px-2 text-right tabular-nums md:table-cell">
                      {r.gp}
                    </TableCell>
                    <TableCell className="hidden px-2 text-right tabular-nums md:table-cell">
                      {r.gc}
                    </TableCell>
                    <TableCell className="px-1 pr-3 text-right tabular-nums sm:px-2">
                      {r.sg > 0 ? `+${r.sg}` : r.sg}
                    </TableCell>
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
              Zona de classificação: Série Ouro ({ouroSpots} por grupo)
            </span>
            <span className="flex items-center gap-2">
              <span className="size-3 rounded-sm bg-slate-400/70" />
              Zona de classificação: Série Prata ({prataSpots} por grupo)
            </span>
          </div>
        )}
      </div>
    </main>
  );
}
