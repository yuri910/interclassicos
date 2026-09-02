import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Camera, Check, Download, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useActiveRules, useMatches, usePlayers, useTeams } from "@/hooks/use-tournament";
import {
  useMarketingStories,
  useMarketingTasks,
  useSponsors,
  marketingPublicUrl,
} from "@/hooks/use-marketing";
import { generateAndStoreMvpStory } from "@/lib/marketing";
import { TeamCrest } from "@/components/TeamCrest";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/marketing")({
  head: () => ({
    meta: [
      { title: "Marketing — Interclássicos" },
      {
        name: "description",
        content: "Artes automáticas para Stories e pendências de foto do craque da partida.",
      },
      { property: "og:title", content: "Marketing — Interclássicos" },
      {
        property: "og:description",
        content: "Artes automáticas para Stories geradas a cada partida encerrada.",
      },
    ],
  }),
  component: MarketingPage,
});

function MarketingPage() {
  const { data: tasks, isLoading: tasksLoading } = useMarketingTasks();
  const { data: stories, isLoading: storiesLoading } = useMarketingStories();
  const { data: matches } = useMatches();
  const { data: teams } = useTeams();
  const { data: players } = usePlayers();
  const { data: sponsors } = useSponsors();
  const { edition } = useActiveRules();
  const queryClient = useQueryClient();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeTaskId = useRef<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, { file: File; url: string }>>({});

  const pendingTasks = (tasks ?? []).filter((t) => t.status === "pendente");

  const teamName = (id: string | null) => teams?.find((t) => t.id === id)?.name ?? "A definir";
  const teamLogo = (id: string | null) => teams?.find((t) => t.id === id)?.logo_url ?? null;

  const clearPreview = (taskId: string) => {
    setPreviews((prev) => {
      const next = { ...prev };
      const removed = next[taskId];
      if (removed) URL.revokeObjectURL(removed.url);
      delete next[taskId];
      return next;
    });
  };

  const approveMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const preview = previews[taskId];
      const task = pendingTasks.find((t) => t.id === taskId);
      if (!preview || !task) throw new Error("Selecione uma foto primeiro.");
      const match = matches?.find((m) => m.id === task.match_id);
      if (!match) throw new Error("Partida não encontrada.");
      await generateAndStoreMvpStory({
        taskId,
        match,
        teams: teams ?? [],
        players: players ?? [],
        photoBlob: preview.file,
        backgroundUrl: edition?.story_background_url,
        sponsors: sponsors ?? [],
      });
    },
    onSuccess: (_data, taskId) => {
      clearPreview(taskId);
      queryClient.invalidateQueries({ queryKey: ["marketing_tasks"] });
      queryClient.invalidateQueries({ queryKey: ["marketing_stories"] });
      toast.success("Arte do craque gerada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCamera = (taskId: string) => {
    activeTaskId.current = taskId;
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const taskId = activeTaskId.current;
    e.target.value = "";
    if (!file || !taskId) return;
    setPreviews((prev) => {
      const next = { ...prev };
      const existing = next[taskId];
      if (existing) URL.revokeObjectURL(existing.url);
      next[taskId] = { file, url: URL.createObjectURL(file) };
      return next;
    });
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={handleFileChange}
      />

      <h1 className="text-stencil text-4xl font-bold">Marketing</h1>
      <p className="mt-1 text-muted-foreground">
        Ao encerrar uma partida, a arte de resultado é gerada automaticamente e uma pendência de
        foto do craque aparece aqui.
      </p>

      <section className="surface-card mt-8 divide-y divide-border">
        <h2 className="text-stencil px-5 py-3 text-lg font-bold">Pendências</h2>
        {!tasksLoading && pendingTasks.length === 0 && (
          <p className="px-5 py-6 text-center text-muted-foreground">
            Nenhuma pendência no momento.
          </p>
        )}
        {pendingTasks.map((task) => {
          const match = matches?.find((m) => m.id === task.match_id);
          if (!match) return null;
          const mvp = players?.find((p) => p.id === match.mvp_player_id);
          const preview = previews[task.id];
          return (
            <div
              key={task.id}
              className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <TeamCrest logoUrl={teamLogo(match.home_team_id)} name={teamName(match.home_team_id)} />
                {teamName(match.home_team_id)} {match.home_score}:{match.away_score}{" "}
                {teamName(match.away_team_id)}
                <TeamCrest logoUrl={teamLogo(match.away_team_id)} name={teamName(match.away_team_id)} />
              </div>

              {!mvp ? (
                <Link
                  to="/sumula/$matchId"
                  params={{ matchId: match.id }}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  Selecione o craque na súmula
                </Link>
              ) : preview ? (
                <div className="flex items-center gap-3">
                  <img src={preview.url} alt="Prévia da foto" className="size-14 rounded-md object-cover" />
                  <Button size="sm" onClick={() => approveMutation.mutate(task.id)} disabled={approveMutation.isPending}>
                    <Check className="size-4" /> Aprovar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openCamera(task.id)}>
                    <RotateCcw className="size-4" /> Tirar outra
                  </Button>
                </div>
              ) : (
                <Button size="sm" onClick={() => openCamera(task.id)}>
                  <Camera className="size-4" /> Foto do craque ({mvp.name})
                </Button>
              )}
            </div>
          );
        })}
      </section>

      <section className="mt-8">
        <h2 className="text-stencil text-lg font-bold">Artes geradas</h2>
        {!storiesLoading && (stories ?? []).length === 0 && (
          <p className="mt-3 text-muted-foreground">Nenhuma arte gerada ainda.</p>
        )}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(stories ?? []).map((story) => {
            const match = matches?.find((m) => m.id === story.match_id);
            const url = marketingPublicUrl(story.image_path);
            return (
              <div key={story.id} className="surface-card overflow-hidden">
                <img src={url} alt="Arte gerada" className="aspect-[9/16] w-full object-cover" />
                <div className="flex items-center justify-between gap-2 p-3">
                  <div className="text-sm">
                    <p className="font-semibold">
                      {story.story_type === "resultado" ? "Resultado" : "⭐ Craque"}
                    </p>
                    {match && (
                      <p className="text-xs text-muted-foreground">
                        {teamName(match.home_team_id)} x {teamName(match.away_team_id)}
                      </p>
                    )}
                  </div>
                  <a
                    href={url}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                  >
                    <Download className="size-4" /> Baixar
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
