import { supabase } from "@/integrations/supabase/client";
import type { Match, MatchEvent, Player, Team } from "@/hooks/use-tournament";
import type { Sponsor } from "@/hooks/use-marketing";
import { generateMatchStoryImage, generateMvpStoryImage } from "@/lib/story-image";
import { matchGroupLabel, phaseLabel } from "@/lib/tournament";

/** Gera a arte de resultado da partida e cria a pendência de foto do craque. Chamado ao encerrar uma súmula. */
export async function generateAndStoreMatchStory(params: {
  match: Match;
  teams: Team[];
  players: Player[];
  events: MatchEvent[];
  tournamentLogoUrl?: string | null | undefined;
  backgroundUrl?: string | null | undefined;
  sponsors?: Sponsor[];
}) {
  const { match, teams, players, events, tournamentLogoUrl, backgroundUrl, sponsors } = params;
  const home = teams.find((t) => t.id === match.home_team_id);
  const away = teams.find((t) => t.id === match.away_team_id);
  if (!home || !away) throw new Error("Times da partida não encontrados.");

  const playerName = (id: string) => players.find((p) => p.id === id)?.name ?? "—";

  const teamEvents = (teamId: string) => ({
    goals: events
      .filter((e) => e.type === "gol" && e.team_id === teamId)
      .map((e) => ({ playerName: playerName(e.player_id), minute: e.minute })),
    redCards: events
      .filter((e) => e.type === "vermelho" && e.team_id === teamId)
      .map((e) => ({ playerName: playerName(e.player_id) })),
  });

  const competitionLabel =
    [phaseLabel(match.phase), matchGroupLabel(match)].filter(Boolean).join(" · ") || "Interclássicos";

  const blob = await generateMatchStoryImage({
    tournamentLogoUrl,
    backgroundUrl,
    homeTeam: { name: home.name, logoUrl: home.logo_url },
    awayTeam: { name: away.name, logoUrl: away.logo_url },
    homeScore: match.home_score,
    awayScore: match.away_score,
    homeEvents: teamEvents(home.id),
    awayEvents: teamEvents(away.id),
    competitionLabel,
    sponsors: (sponsors ?? []).map((s) => ({ logoUrl: s.logo_url, isMaster: s.is_master })),
  });

  const path = `stories/${match.id}-resultado-${Date.now()}.png`;
  const { error: uploadError } = await supabase.storage
    .from("marketing")
    .upload(path, blob, { contentType: "image/png" });
  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase
    .from("marketing_stories")
    .insert({ match_id: match.id, story_type: "resultado", image_path: path });
  if (insertError) throw insertError;

  // Upsert que não sobrescreve uma pendência já concluída (ex.: reabrir e reencerrar a partida).
  const { error: taskError } = await supabase
    .from("marketing_tasks")
    .upsert({ match_id: match.id, status: "pendente" }, { onConflict: "match_id", ignoreDuplicates: true });
  if (taskError) throw taskError;
}

/** Gera a arte "craque da partida" a partir da foto aprovada e conclui a pendência. */
export async function generateAndStoreMvpStory(params: {
  taskId: string;
  match: Match;
  teams: Team[];
  players: Player[];
  photoBlob: Blob;
  backgroundUrl?: string | null | undefined;
  sponsors?: Sponsor[];
}) {
  const { taskId, match, teams, players, photoBlob, backgroundUrl, sponsors } = params;
  const home = teams.find((t) => t.id === match.home_team_id);
  const away = teams.find((t) => t.id === match.away_team_id);
  const mvp = players.find((p) => p.id === match.mvp_player_id);
  if (!home || !away) throw new Error("Times da partida não encontrados.");
  if (!mvp) throw new Error("Selecione o craque da partida na súmula antes de enviar a foto.");
  const mvpTeam = teams.find((t) => t.id === mvp.team_id);

  const photoPath = `mvp-photos/${taskId}.jpg`;
  const { error: photoError } = await supabase.storage
    .from("marketing")
    .upload(photoPath, photoBlob, { contentType: "image/jpeg", upsert: true });
  if (photoError) throw photoError;
  const photoUrl = supabase.storage.from("marketing").getPublicUrl(photoPath).data.publicUrl;

  const blob = await generateMvpStoryImage({
    backgroundUrl,
    photoUrl,
    playerName: mvp.name,
    teamName: mvpTeam?.name ?? "—",
    teamLogoUrl: mvpTeam?.logo_url ?? null,
    homeTeamName: home.name,
    awayTeamName: away.name,
    sponsors: (sponsors ?? []).map((s) => ({ logoUrl: s.logo_url, isMaster: s.is_master })),
  });

  const storyPath = `stories/${match.id}-craque-${Date.now()}.png`;
  const { error: uploadError } = await supabase.storage
    .from("marketing")
    .upload(storyPath, blob, { contentType: "image/png" });
  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase
    .from("marketing_stories")
    .insert({ match_id: match.id, story_type: "craque", image_path: storyPath });
  if (insertError) throw insertError;

  const { error: taskError } = await supabase
    .from("marketing_tasks")
    .update({ status: "concluida", photo_path: photoPath, resolved_at: new Date().toISOString() })
    .eq("id", taskId);
  if (taskError) throw taskError;
}
