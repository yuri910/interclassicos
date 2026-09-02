import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MatchLock = { match_id: string; user_id: string; locked_at: string };

/** Depois desse tempo sem "batimento" (heartbeat), a trava é considerada abandonada — a aba
 * fechou sem sair normalmente da súmula — e outro mesário pode assumir a partida. */
const STALE_MINUTES = 10;

function isStale(lockedAt: string): boolean {
  return Date.now() - new Date(lockedAt).getTime() > STALE_MINUTES * 60 * 1000;
}

export function useMatchLocks() {
  return useQuery({
    queryKey: ["match_locks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_locks")
        .select("match_id, user_id, locked_at");
      if (error) throw error;
      return (data ?? []) as MatchLock[];
    },
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });
}

/** true se outro mesário (não eu) está com a súmula dessa partida aberta agora mesmo. */
export function isLockedByOther(
  locks: MatchLock[] | undefined,
  matchId: string,
  userId: string | undefined,
): boolean {
  const lock = locks?.find((l) => l.match_id === matchId);
  if (!lock || !userId) return false;
  if (lock.user_id === userId) return false;
  return !isStale(lock.locked_at);
}

/**
 * Tenta travar a partida pro usuário atual antes de abrir a súmula. Recusa só se alguém
 * diferente já está com a trava ativa (não expirada); se a trava é minha ou expirou, assumo.
 */
export async function acquireMatchLock(
  matchId: string,
  userId: string,
): Promise<{ ok: boolean }> {
  const { data: existing, error: readError } = await supabase
    .from("match_locks")
    .select("user_id, locked_at")
    .eq("match_id", matchId)
    .maybeSingle();
  if (readError) throw readError;

  if (existing && existing.user_id !== userId && !isStale(existing.locked_at)) {
    return { ok: false };
  }

  const { error: upsertError } = await supabase
    .from("match_locks")
    .upsert(
      { match_id: matchId, user_id: userId, locked_at: new Date().toISOString() },
      { onConflict: "match_id" },
    );
  if (upsertError) throw upsertError;
  return { ok: true };
}

/** Renova a trava — chamado periodicamente enquanto o mesário está na súmula. */
export async function heartbeatMatchLock(matchId: string, userId: string) {
  await supabase
    .from("match_locks")
    .update({ locked_at: new Date().toISOString() })
    .eq("match_id", matchId)
    .eq("user_id", userId);
}

/** Libera a trava — chamado ao sair da súmula. */
export async function releaseMatchLock(matchId: string, userId: string) {
  await supabase.from("match_locks").delete().eq("match_id", matchId).eq("user_id", userId);
}
