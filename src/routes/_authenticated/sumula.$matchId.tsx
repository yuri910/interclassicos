import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, Pencil, Star, Trash2, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  useActiveRules,
  useEvents,
  useMatches,
  usePlayers,
  useTeams,
} from "@/hooks/use-tournament";
import { formatKickoff } from "@/lib/tournament";
import { computeSuspensions } from "@/lib/suspensions";
import { FoulsPanel } from "@/components/FoulsPanel";
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

export const Route = createFileRoute("/_authenticated/sumula/$matchId")({
  head: () => ({
    meta: [
      { title: "Súmula da partida — Interclássicos" },
      { name: "description", content: "Registre gols, cartões e o placar final da partida." },
      { property: "og:title", content: "Súmula da partida — Interclássicos" },
      { property: "og:description", content: "Registre gols, cartões e o placar final." },
    ],
  }),
  component: SumulaPage,
});

const EVENT_LABEL: Record<string, string> = {
  gol: "⚽ Gol",
  amarelo: "🟨 Amarelo",
  vermelho: "🟥 Vermelho",
};

type EventType = "gol" | "amarelo" | "vermelho";

function SumulaPage() {
  const { matchId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: matches } = useMatches();
  const { data: teams } = useTeams();
  const { data: players } = usePlayers();
  const { data: events } = useEvents(matchId);
  const { data: allEvents } = useEvents();
  const { rules } = useActiveRules();

  const match = matches?.find((m) => m.id === matchId);
  const [playerId, setPlayerId] = useState("");
  const [type, setType] = useState<EventType>("gol");
  const [minute, setMinute] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [editPlayer, setEditPlayer] = useState("");
  const [editType, setEditType] = useState<EventType>("gol");
  const [editMinute, setEditMinute] = useState("");

  const [mvp, setMvp] = useState("");

  const squad = (players ?? []).filter(
    (p) => p.team_id === match?.home_team_id || p.team_id === match?.away_team_id,
  );
  const teamName = (id: string | null | undefined) =>
    teams?.find((t) => t.id === id)?.name ?? "A definir";

  const suspensions = useMemo(() => {
    if (!match) return [];
    return computeSuspensions({
      match,
      matches: matches ?? [],
      events: allEvents ?? [],
      players: players ?? [],
      rules,
    });
  }, [match, matches, allEvents, players, rules]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["events"] });
    queryClient.invalidateQueries({ queryKey: ["matches"] });
  };

  /** Recalcula o placar oficial a partir dos gols lançados na súmula. */
  const recalcScore = async () => {
    if (!match) return;
    const { data: rows, error } = await supabase
      .from("match_events")
      .select("team_id, type")
      .eq("match_id", matchId)
      .eq("type", "gol");
    if (error) throw error;
    const home = (rows ?? []).filter((r) => r.team_id === match.home_team_id).length;
    const away = (rows ?? []).filter((r) => r.team_id === match.away_team_id).length;
    const { error: upErr } = await supabase
      .from("matches")
      .update({ home_score: home, away_score: away })
      .eq("id", matchId);
    if (upErr) throw upErr;
  };

  const parseMinute = (value: string) => {
    const min = value.trim() === "" ? null : Number(value);
    if (min !== null && (Number.isNaN(min) || min < 0 || min > 150))
      throw new Error("Minuto inválido");
    return min;
  };

  const addEvent = useMutation({
    mutationFn: async () => {
      const player = squad.find((p) => p.id === playerId);
      if (!player) throw new Error("Selecione um jogador");
      const min = parseMinute(minute);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Sessão expirada. Entre novamente.");
      const { error } = await supabase.from("match_events").insert({
        match_id: matchId,
        player_id: player.id,
        team_id: player.team_id,
        type,
        minute: min,
        created_by: auth.user.id,
      });
      if (error) throw error;

      if (type === "gol" && match && match.status === "agendada") {
        await supabase.from("matches").update({ status: "em_andamento" }).eq("id", matchId);
      }
      await recalcScore();
    },
    onSuccess: () => {
      setMinute("");
      refresh();
      toast.success("Lançamento registrado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateEvent = useMutation({
    mutationFn: async () => {
      if (!editId) return;
      const player = squad.find((p) => p.id === editPlayer);
      if (!player) throw new Error("Selecione um jogador");
      const min = parseMinute(editMinute);
      const { error } = await supabase
        .from("match_events")
        .update({
          player_id: player.id,
          team_id: player.team_id,
          type: editType,
          minute: min,
        })
        .eq("id", editId);
      if (error) throw error;
      await recalcScore();
    },
    onSuccess: () => {
      setEditId(null);
      refresh();
      toast.success("Lançamento corrigido.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeEvent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("match_events").delete().eq("id", id);
      if (error) throw error;
      await recalcScore();
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMvp = useMutation({
    mutationFn: async (value: string) => {
      const { error } = await supabase
        .from("matches")
        .update({ mvp_player_id: value === "" ? null : value })
        .eq("id", matchId);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success("Craque da partida salvo. Já aparece no ranking.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async (status: "agendada" | "em_andamento" | "encerrada") => {
      // Ao encerrar, o placar oficial é recalculado a partir dos gols da súmula,
      // garantindo que classificação e rankings já contabilizem o resultado.
      if (status === "encerrada") await recalcScore();
      const { error } = await supabase.from("matches").update({ status }).eq("id", matchId);
      if (error) throw error;
    },
    onSuccess: (_data, status) => {
      refresh();
      toast.success(
        status === "encerrada"
          ? "Partida encerrada. Resultado contabilizado na classificação e nos rankings."
          : "Status atualizado.",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!match) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 text-muted-foreground">
        Carregando partida...
      </main>
    );
  }

  const mvpValue = mvp || match.mvp_player_id || "";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link
        to="/mesario"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Voltar
      </Link>

      <header className="surface-card mt-4 p-5 text-center">
        <p className="text-xs text-muted-foreground">
          {formatKickoff(match.kickoff_at)} · {match.field}
        </p>
        <h1 className="text-stencil mt-2 text-2xl font-bold sm:text-3xl">
          {teamName(match.home_team_id)}{" "}
          <span className="text-primary">
            {match.home_score} : {match.away_score}
          </span>{" "}
          {teamName(match.away_team_id)}
        </h1>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setStatus.mutate("em_andamento")}>
            Iniciar
          </Button>
          <Button size="sm" onClick={() => setStatus.mutate("encerrada")}>
            Encerrar partida
          </Button>
        </div>
      </header>

      {suspensions.length > 0 && (
        <section className="mt-6 rounded-lg border border-destructive/50 bg-destructive/10 p-5">
          <h2 className="text-stencil flex items-center gap-2 text-lg font-bold text-destructive">
            <TriangleAlert className="size-5" /> Atletas suspensos para esta partida
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {suspensions.map((s) => (
              <li key={s.playerId}>
                <span className="font-semibold">{s.playerName}</span>{" "}
                <span className="text-muted-foreground">({teamName(s.teamId)})</span> — {s.reason}
              </li>
            ))}
          </ul>
        </section>
      )}

      <FoulsPanel
        matchId={matchId}
        homeTeamId={match.home_team_id}
        awayTeamId={match.away_team_id}
        teamName={teamName}
      />

      <section className="surface-card mt-6 p-5">
        <h2 className="text-stencil flex items-center gap-2 text-lg font-bold">
          <Star className="size-5 text-primary" /> Craque da partida
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label>Atleta escolhido</Label>
            <Select value={mvpValue} onValueChange={setMvp}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o craque" />
              </SelectTrigger>
              <SelectContent>
                {squad.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.shirt_number ? `${p.shirt_number} · ` : ""}
                    {p.name} ({teamName(p.team_id)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button disabled={!mvpValue || saveMvp.isPending} onClick={() => saveMvp.mutate(mvpValue)}>
              Salvar craque
            </Button>
            {match.mvp_player_id && (
              <Button
                variant="ghost"
                onClick={() => {
                  setMvp("");
                  saveMvp.mutate("");
                }}
              >
                Limpar
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="surface-card mt-6 p-5">
        <h2 className="text-stencil text-lg font-bold">Novo lançamento</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label>Jogador</Label>
            <Select value={playerId} onValueChange={setPlayerId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {squad.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.shirt_number ? `${p.shirt_number} · ` : ""}
                    {p.name} ({teamName(p.team_id)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Ocorrência</Label>
            <Select value={type} onValueChange={(v) => setType(v as EventType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gol">⚽ Gol</SelectItem>
                <SelectItem value="amarelo">🟨 Amarelo</SelectItem>
                <SelectItem value="vermelho">🟥 Vermelho</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="min">Minuto</Label>
            <Input
              id="min"
              inputMode="numeric"
              className="w-24"
              value={minute}
              onChange={(e) => setMinute(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            className="flex-1"
            disabled={addEvent.isPending || !playerId}
            onClick={() => addEvent.mutate()}
          >
            Registrar
          </Button>
          <Button
            variant="ghost"
            disabled={!playerId && type === "gol" && !minute}
            onClick={() => {
              setPlayerId("");
              setType("gol");
              setMinute("");
            }}
          >
            Limpar
          </Button>
        </div>
      </section>

      <section className="surface-card mt-6 divide-y divide-border">
        <h2 className="text-stencil px-5 py-3 text-lg font-bold">Lançamentos da partida</h2>
        {(events ?? []).length === 0 && (
          <p className="px-5 py-6 text-center text-muted-foreground">Nada registrado ainda.</p>
        )}
        {(events ?? []).map((e) => {
          const p = players?.find((pl) => pl.id === e.player_id);
          if (editId === e.id) {
            return (
              <div key={e.id} className="space-y-3 px-5 py-4">
                <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
                  <div className="space-y-1.5">
                    <Label>Jogador</Label>
                    <Select value={editPlayer} onValueChange={setEditPlayer}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {squad.map((pl) => (
                          <SelectItem key={pl.id} value={pl.id}>
                            {pl.shirt_number ? `${pl.shirt_number} · ` : ""}
                            {pl.name} ({teamName(pl.team_id)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Ocorrência</Label>
                    <Select value={editType} onValueChange={(v) => setEditType(v as EventType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gol">⚽ Gol</SelectItem>
                        <SelectItem value="amarelo">🟨 Amarelo</SelectItem>
                        <SelectItem value="vermelho">🟥 Vermelho</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Minuto</Label>
                    <Input
                      inputMode="numeric"
                      className="w-24"
                      value={editMinute}
                      onChange={(ev) => setEditMinute(ev.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={updateEvent.isPending} onClick={() => updateEvent.mutate()}>
                    <Check className="size-4" /> Salvar correção
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                    <X className="size-4" /> Cancelar
                  </Button>
                </div>
              </div>
            );
          }
          return (
            <div key={e.id} className="flex items-center gap-3 px-5 py-3">
              <span>{EVENT_LABEL[e.type]}</span>
              <span className="font-semibold">{p?.name ?? "—"}</span>
              <span className="text-sm text-muted-foreground">{teamName(e.team_id)}</span>
              {e.minute !== null && (
                <span className="text-sm text-muted-foreground">{e.minute}'</span>
              )}
              <Button
                size="icon"
                variant="ghost"
                aria-label="Editar lançamento"
                className="ml-auto"
                onClick={() => {
                  setEditId(e.id);
                  setEditPlayer(e.player_id);
                  setEditType(e.type);
                  setEditMinute(e.minute === null ? "" : String(e.minute));
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Excluir lançamento"
                onClick={() => removeEvent.mutate(e.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          );
        })}
      </section>
    </main>
  );
}
