import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useEvents, useMatches, usePlayers, useTeams } from "@/hooks/use-tournament";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/rankings")({
  head: () => ({
    meta: [
      { title: "Artilharia e cartões — Interclássicos" },
      {
        name: "description",
        content: "Ranking de artilheiros e de cartões amarelos e vermelhos do campeonato.",
      },
      { property: "og:title", content: "Artilharia e cartões — Interclássicos" },
      {
        property: "og:description",
        content: "Ranking de artilheiros e de cartões do campeonato.",
      },
    ],
  }),
  component: RankingsPage,
});

function RankingsPage() {
  const { data: events, isLoading } = useEvents();
  const { data: players } = usePlayers();
  const { data: teams } = useTeams();
  const { data: matches } = useMatches();

  const mvpRows = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of matches ?? []) {
      if (!m.mvp_player_id) continue;
      map.set(m.mvp_player_id, (map.get(m.mvp_player_id) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([playerId, total]) => {
        const player = (players ?? []).find((p) => p.id === playerId);
        const team = (teams ?? []).find((t) => t.id === player?.team_id);
        return { playerId, name: player?.name ?? "—", team: team?.name ?? "—", total };
      })
      .sort((a, b) => b.total - a.total);
  }, [matches, players, teams]);


  const rows = useMemo(() => {
    const map = new Map<string, { gols: number; amarelos: number; vermelhos: number }>();
    for (const e of events ?? []) {
      const cur = map.get(e.player_id) ?? { gols: 0, amarelos: 0, vermelhos: 0 };
      if (e.type === "gol") cur.gols += 1;
      if (e.type === "amarelo") cur.amarelos += 1;
      if (e.type === "vermelho") cur.vermelhos += 1;
      map.set(e.player_id, cur);
    }
    return [...map.entries()].map(([playerId, stats]) => {
      const player = (players ?? []).find((p) => p.id === playerId);
      const team = (teams ?? []).find((t) => t.id === player?.team_id);
      return { playerId, name: player?.name ?? "—", team: team?.name ?? "—", ...stats };
    });
  }, [events, players, teams]);

  const scorers = [...rows].filter((r) => r.gols > 0).sort((a, b) => b.gols - a.gols);
  const cards = [...rows]
    .filter((r) => r.amarelos + r.vermelhos > 0)
    .sort((a, b) => b.vermelhos * 10 + b.amarelos - (a.vermelhos * 10 + a.amarelos));

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-stencil text-4xl font-bold">Rankings</h1>
      <p className="mt-1 text-muted-foreground">
        Atualizado automaticamente a cada súmula registrada pelos mesários.
      </p>

      {isLoading ? (
        <Skeleton className="mt-8 h-64 w-full" />
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <section className="surface-card overflow-hidden">
            <h2 className="text-stencil border-b border-border px-4 py-3 text-lg font-bold text-primary">
              ⚽ Artilharia
            </h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Jogador</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-right">Gols</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scorers.map((r, i) => (
                  <TableRow key={r.playerId}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-semibold">{r.name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.team}</TableCell>
                    <TableCell className="text-right text-lg font-bold tabular-nums text-primary">
                      {r.gols}
                    </TableCell>
                  </TableRow>
                ))}
                {scorers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      Nenhum gol registrado ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </section>

          <section className="surface-card overflow-hidden">
            <h2 className="text-stencil border-b border-border px-4 py-3 text-lg font-bold text-accent">
              🟨 Cartões
            </h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jogador</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-right">🟨</TableHead>
                  <TableHead className="text-right">🟥</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cards.map((r) => (
                  <TableRow key={r.playerId}>
                    <TableCell className="font-semibold">{r.name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.team}</TableCell>
                    <TableCell className="text-right font-bold tabular-nums text-yellow-card">
                      {r.amarelos}
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums text-red-card">
                      {r.vermelhos}
                    </TableCell>
                  </TableRow>
                ))}
                {cards.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      Nenhum cartão registrado ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </section>

          <section className="surface-card overflow-hidden lg:col-span-2">
            <h2 className="text-stencil border-b border-border px-4 py-3 text-lg font-bold text-primary">
              ⭐ Craque da partida
            </h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Jogador</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-right">Vezes eleito</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mvpRows.map((r, i) => (
                  <TableRow key={r.playerId}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-semibold">{r.name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.team}</TableCell>
                    <TableCell className="text-right text-lg font-bold tabular-nums text-primary">
                      {r.total}
                    </TableCell>
                  </TableRow>
                ))}
                {mvpRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      Nenhum craque escolhido ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </section>
        </div>

      )}
    </main>
  );
}
