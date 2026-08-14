import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMatches, usePlayers, useTeams } from "@/hooks/use-tournament";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Organização — Interclássicos" },
      { name: "description", content: "Cadastre times, jogadores e a tabela de partidas." },
      { property: "og:title", content: "Organização — Interclássicos" },
      { property: "og:description", content: "Cadastre times, jogadores e partidas." },
    ],
  }),
  component: AdminPage,
});

const PHASES = ["grupos", "oitavas", "quartas", "semi", "final"] as const;

function AdminPage() {
  const qc = useQueryClient();
  const { data: teams } = useTeams();
  const { data: players } = usePlayers();
  const { data: matches } = useMatches();

  const [teamName, setTeamName] = useState("");
  const [teamGroup, setTeamGroup] = useState("A");

  const [playerName, setPlayerName] = useState("");
  const [playerTeam, setPlayerTeam] = useState("");
  const [shirt, setShirt] = useState("");

  const [phase, setPhase] = useState<(typeof PHASES)[number]>("grupos");
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [kickoff, setKickoff] = useState("");
  const [field, setField] = useState("");

  const invalidate = (key: string) => qc.invalidateQueries({ queryKey: [key] });

  const resetTestData = useMutation({
    mutationFn: async () => {
      const groupMatchIds = (matches ?? [])
        .filter((m) => m.phase === "grupos")
        .map((m) => m.id);
      if (groupMatchIds.length > 0) {
        await supabase.from("match_events").delete().in("match_id", groupMatchIds);
        await supabase.from("match_fouls").delete().in("match_id", groupMatchIds);
        const { error: matchErr } = await supabase
          .from("matches")
          .delete()
          .in("id", groupMatchIds);
        if (matchErr) throw matchErr;
      }
      // Apaga todos os times; jogadores são removidos em cascata pelo banco.
      const { error: teamErr } = await supabase.from("teams").delete().not("id", "is", null);
      if (teamErr) throw teamErr;
    },
    onSuccess: () => {
      invalidate("teams");
      invalidate("players");
      invalidate("matches");
      invalidate("events");
      invalidate("fouls");
      toast.success("Jogos da fase de grupos, times, jogadores e lançamentos apagados.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleResetTestData = () => {
    if (
      !window.confirm(
        "Apagar todos os jogos da fase de grupos, todos os times, jogadores e os lançamentos (gols/cartões/faltas) deles? Esta ação não pode ser desfeita.",
      )
    )
      return;
    resetTestData.mutate();
  };

  const addTeam = useMutation({
    mutationFn: async () => {
      const name = teamName.trim();
      if (!name || name.length > 60) throw new Error("Informe um nome de time válido");
      const { error } = await supabase
        .from("teams")
        .insert({ name, group_name: teamGroup.trim().toUpperCase().slice(0, 4) || null });
      if (error) throw error;
    },
    onSuccess: () => {
      setTeamName("");
      invalidate("teams");
      toast.success("Time cadastrado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addPlayer = useMutation({
    mutationFn: async () => {
      const name = playerName.trim();
      if (!name || name.length > 80) throw new Error("Informe o nome do jogador");
      if (!playerTeam) throw new Error("Selecione o time");
      const num = shirt.trim() === "" ? null : Number(shirt);
      if (num !== null && (Number.isNaN(num) || num < 1 || num > 99))
        throw new Error("Número da camisa inválido");
      const { error } = await supabase
        .from("players")
        .insert({ name, team_id: playerTeam, shirt_number: num });
      if (error) throw error;
    },
    onSuccess: () => {
      setPlayerName("");
      setShirt("");
      invalidate("players");
      toast.success("Jogador cadastrado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMatch = useMutation({
    mutationFn: async () => {
      if (!homeTeam || !awayTeam || homeTeam === awayTeam)
        throw new Error("Selecione dois times diferentes");
      if (!kickoff) throw new Error("Informe data e horário");
      if (!field.trim()) throw new Error("Informe o campo");
      const { error } = await supabase.from("matches").insert({
        phase,
        group_name: phase === "grupos" ? (teams?.find((t) => t.id === homeTeam)?.group_name ?? null) : null,
        kickoff_at: new Date(kickoff).toISOString(),
        field: field.trim().slice(0, 60),
        home_team_id: homeTeam,
        away_team_id: awayTeam,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setKickoff("");
      setField("");
      invalidate("matches");
      toast.success("Partida agendada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-stencil text-4xl font-bold">Organização</h1>
      <p className="mt-1 text-muted-foreground">
        Cadastre os times, elencos e a tabela de partidas do campeonato.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="surface-card p-5">
          <h2 className="text-stencil text-lg font-bold">Times ({teams?.length ?? 0})</h2>
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tn">Nome do time</Label>
              <Input id="tn" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tg">Grupo</Label>
              <Input id="tg" value={teamGroup} onChange={(e) => setTeamGroup(e.target.value)} />
            </div>
            <Button className="w-full" onClick={() => addTeam.mutate()}>
              Adicionar time
            </Button>
          </div>
        </section>

        <section className="surface-card p-5">
          <h2 className="text-stencil text-lg font-bold">Jogadores ({players?.length ?? 0})</h2>
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label>Time</Label>
              <Select value={playerTeam} onValueChange={setPlayerTeam}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(teams ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pn">Nome do jogador</Label>
              <Input id="pn" value={playerName} onChange={(e) => setPlayerName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sn">Camisa</Label>
              <Input
                id="sn"
                inputMode="numeric"
                value={shirt}
                onChange={(e) => setShirt(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={() => addPlayer.mutate()}>
              Adicionar jogador
            </Button>
          </div>
        </section>

        <section className="surface-card p-5 lg:col-span-2">
          <h2 className="text-stencil text-lg font-bold">Partidas ({matches?.length ?? 0})</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Mandante</Label>
              <Select value={homeTeam} onValueChange={setHomeTeam}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(teams ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Visitante</Label>
              <Select value={awayTeam} onValueChange={setAwayTeam}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(teams ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Fase</Label>
              <Select value={phase} onValueChange={(v) => setPhase(v as typeof phase)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PHASES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fld">Campo</Label>
              <Input
                id="fld"
                placeholder="Campo 1"
                value={field}
                onChange={(e) => setField(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ko">Data e horário</Label>
              <Input
                id="ko"
                type="datetime-local"
                value={kickoff}
                onChange={(e) => setKickoff(e.target.value)}
              />
            </div>
          </div>
          <Button className="mt-4 w-full" onClick={() => addMatch.mutate()}>
            Agendar partida
          </Button>
        </section>

        <section className="surface-card border-destructive/50 p-5 lg:col-span-2">
          <h2 className="text-stencil text-lg font-bold text-destructive">Zona de risco</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Apaga todos os jogos da fase de grupos, todos os times, jogadores e os lançamentos
            (gols/cartões/faltas) registrados por eles. Use para testar o campeonato do zero.
          </p>
          <Button
            className="mt-4 w-full"
            variant="destructive"
            disabled={resetTestData.isPending}
            onClick={handleResetTestData}
          >
            Limpar jogos da fase de grupos, times e dados de mesário
          </Button>
        </section>
      </div>
    </main>
  );
}
