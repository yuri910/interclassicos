import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, Instagram, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { useMatches, usePlayers, useTeams, type Player } from "@/hooks/use-tournament";
import {
  instagramUrl,
  normalizeInstagram,
  useSetPlayerInstagram,
  useSetTeamInstagram,
} from "@/hooks/use-instagram";
import { TeamCrest } from "@/components/TeamCrest";
import { MatchGroups } from "@/components/MatchGroups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/times/$teamId")({
  head: () => ({
    meta: [
      { title: "Time — Interclássicos" },
      {
        name: "description",
        content: "Elenco, jogos e Instagram do time no Interclássicos DuoVolts.",
      },
    ],
  }),
  component: TeamPage,
});

/** Campo de @ com dois estados: mostrando o valor salvo, ou em edição. */
function InstagramField({
  handle,
  label,
  pending,
  onSave,
}: {
  handle: string | null | undefined;
  label: string;
  pending: boolean;
  onSave: (handle: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(handle ?? "");

  const start = () => {
    setValue(handle ?? "");
    setEditing(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(normalizeInstagram(value));
    setEditing(false);
  };

  if (!editing) {
    return handle ? (
      <span className="flex items-center gap-1.5">
        <a
          href={instagramUrl(handle)}
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <Instagram className="size-3.5" />@{handle}
        </a>
        <button
          type="button"
          onClick={start}
          aria-label={`Editar ${label}`}
          className="cursor-pointer text-muted-foreground hover:text-foreground"
        >
          <Pencil className="size-3" />
        </button>
      </span>
    ) : (
      <button
        type="button"
        onClick={start}
        className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-primary"
      >
        <Instagram className="size-3.5" />
        {label}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-1.5">
      <Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="@seuusuario"
        aria-label={label}
        className="h-8 w-40 text-sm"
      />
      <Button type="submit" size="icon" className="size-8" disabled={pending} aria-label="Salvar">
        <Check className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-8"
        onClick={() => setEditing(false)}
        aria-label="Cancelar"
      >
        <X className="size-4" />
      </Button>
    </form>
  );
}

function PlayerRow({ player }: { player: Player }) {
  const setInstagram = useSetPlayerInstagram();

  const save = (handle: string) => {
    setInstagram.mutate(
      { playerId: player.id, handle },
      {
        onSuccess: (saved) =>
          toast.success(saved ? `Instagram de ${player.name} salvo.` : "Instagram removido."),
        onError: (error: Error) => toast.error(error.message),
      },
    );
  };

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-2.5 last:border-0">
      <span className="w-6 shrink-0 text-right text-sm font-bold tabular-nums text-muted-foreground">
        {player.shirt_number ?? "–"}
      </span>
      <span className="text-stencil font-bold">{player.name}</span>
      <span className="ml-auto">
        <InstagramField
          handle={player.instagram}
          label="Colocar meu Instagram"
          pending={setInstagram.isPending}
          onSave={save}
        />
      </span>
    </li>
  );
}

function TeamPage() {
  const { teamId } = Route.useParams();
  const { data: teams, isLoading } = useTeams();
  const { data: players } = usePlayers();
  const { data: matches } = useMatches();
  const setTeamInstagram = useSetTeamInstagram();

  const team = (teams ?? []).find((t) => t.id === teamId);

  const squad = useMemo(
    () =>
      (players ?? [])
        .filter((p) => p.team_id === teamId)
        .sort((a, b) => (a.shirt_number ?? 999) - (b.shirt_number ?? 999)),
    [players, teamId],
  );

  const teamMatches = useMemo(
    () =>
      (matches ?? [])
        .filter((m) => m.home_team_id === teamId || m.away_team_id === teamId)
        .sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at)),
    [matches, teamId],
  );

  const saveTeam = (handle: string) => {
    setTeamInstagram.mutate(
      { teamId, handle },
      {
        onSuccess: (saved) =>
          toast.success(saved ? "Instagram do time salvo." : "Instagram do time removido."),
        onError: (error: Error) => toast.error(error.message),
      },
    );
  };

  if (isLoading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  if (!team) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="text-stencil text-2xl font-bold">Time não encontrado</h1>
        <Link to="/" className="mt-4 inline-block font-semibold text-primary">
          Voltar para a tabela de jogos
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Jogos
      </Link>

      <header className="mt-4 flex flex-col items-center gap-3 text-center sm:flex-row sm:gap-6 sm:text-left">
        <TeamCrest
          logoUrl={team.logo_url}
          name={team.name}
          size="xl"
          className="size-28 sm:size-36"
        />
        <div className="min-w-0">
          <h1 className="text-stencil text-3xl font-bold text-balance sm:text-4xl">{team.name}</h1>
          {team.group_name && (
            <p className="mt-0.5 text-sm text-muted-foreground">Grupo {team.group_name}</p>
          )}
          <div className="mt-2 flex justify-center sm:justify-start">
            <InstagramField
              handle={team.instagram}
              label="Colocar o Instagram do time"
              pending={setTeamInstagram.isPending}
              onSave={saveTeam}
            />
          </div>
        </div>
      </header>

      <section className="surface-card mt-8 overflow-hidden">
        <h2 className="text-stencil border-b border-border px-4 py-3 text-lg font-bold text-primary">
          Elenco
        </h2>
        {squad.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nenhum jogador cadastrado ainda.
          </p>
        ) : (
          <ul>
            {squad.map((p) => (
              <PlayerRow key={p.id} player={p} />
            ))}
          </ul>
        )}
        <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
          Achou seu nome? Coloque seu @ para aparecer junto com você nas escalações.
        </p>
      </section>

      {teamMatches.length > 0 && (
        <section className="mt-8">
          <h2 className="text-stencil mb-3 text-lg font-bold text-primary">Jogos do time</h2>
          <MatchGroups
            matches={teamMatches}
            teams={teams ?? []}
            emptyMessage="Nenhum jogo para este time."
          />
        </section>
      )}
    </main>
  );
}
