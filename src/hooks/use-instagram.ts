import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * @ do Instagram de jogadores e times.
 *
 * A escrita passa pelas funções `set_player_instagram` / `set_team_instagram` (SECURITY
 * DEFINER) em vez de um update direto: é o único jeito de deixar qualquer visitante,
 * logado ou não, preencher o próprio @ sem abrir as outras colunas da tabela. A função
 * também normaliza a entrada ("@fulano", "fulano" ou a URL do perfil viram "fulano").
 */

const MIGRATION_HINT =
  "O campo de Instagram ainda não existe no banco. Rode a migration 20260909120000_instagram.sql.";

function translateError(error: { message: string; code?: string }) {
  const msg = error.message ?? "";
  // A função não existe: banco sem a migration aplicada.
  if (error.code === "PGRST202" || /Could not find the function/i.test(msg)) {
    return new Error(MIGRATION_HINT);
  }
  if (/inv[áa]lido/i.test(msg)) {
    return new Error("Usuário do Instagram inválido. Use só letras, números, ponto e underline.");
  }
  return new Error(msg || "Não foi possível salvar o Instagram.");
}

export function useSetPlayerInstagram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ playerId, handle }: { playerId: string; handle: string }) => {
      const { data, error } = await supabase.rpc("set_player_instagram", {
        p_player_id: playerId,
        p_handle: handle,
      });
      if (error) throw translateError(error);
      return (data as string | null) ?? null;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["players"] }),
  });
}

export function useSetTeamInstagram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId, handle }: { teamId: string; handle: string }) => {
      const { data, error } = await supabase.rpc("set_team_instagram", {
        p_team_id: teamId,
        p_handle: handle,
      });
      if (error) throw translateError(error);
      return (data as string | null) ?? null;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["teams"] }),
  });
}

/** Mesma normalização da função do banco, para exibir o @ antes de salvar. */
export function normalizeInstagram(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/[/?].*$/, "")
    .replace(/^@+/, "")
    .trim();
}

export function instagramUrl(handle: string) {
  return `https://instagram.com/${handle}`;
}
