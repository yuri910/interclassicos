import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, Siren } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveRules, useFouls } from "@/hooks/use-tournament";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Props = {
  matchId: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  teamName: (id: string | null | undefined) => string;
};

const HALVES = [1, 2] as const;

export function FoulsPanel({ matchId, homeTeamId, awayTeamId, teamName }: Props) {
  const qc = useQueryClient();
  const { data: fouls } = useFouls(matchId);
  const { rules } = useActiveRules();
  const [limit, setLimit] = useState("");
  const effectiveLimit = limit === "" ? String(rules.foul_shootout_limit) : limit;
  const limitNumber = Math.max(1, Number(effectiveLimit) || 6);

  const teamIds = [homeTeamId, awayTeamId].filter((id): id is string => Boolean(id));

  const countOf = (teamId: string, half: number) =>
    fouls?.find((f) => f.team_id === teamId && f.half === half)?.count ?? 0;

  const bump = useMutation({
    mutationFn: async ({ teamId, half, delta }: { teamId: string; half: number; delta: number }) => {
      const next = Math.max(0, countOf(teamId, half) + delta);
      const existing = fouls?.find((f) => f.team_id === teamId && f.half === half);
      if (existing) {
        const { error } = await supabase
          .from("match_fouls")
          .update({ count: next })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("match_fouls")
          .insert({ match_id: matchId, team_id: teamId, half, count: next });
        if (error) throw error;
      }
      return next;
    },
    onSuccess: (next) => {
      qc.invalidateQueries({ queryKey: ["fouls"] });
      if (next === limitNumber) toast.warning(`Limite atingido: próximas faltas são shoot out.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (teamIds.length === 0) return null;

  return (
    <section className="surface-card mt-6 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-stencil text-lg font-bold">Faltas por tempo</h2>
        <div className="space-y-1.5">
          <Label htmlFor="foul-limit">Limite para shoot out</Label>
          <Input
            id="foul-limit"
            inputMode="numeric"
            className="w-24"
            value={effectiveLimit}
            onChange={(e) => setLimit(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {HALVES.map((half) => (
          <div key={half} className="rounded-lg border border-border p-4">
            <p className="text-sm font-semibold text-muted-foreground">{half}º tempo</p>
            <div className="mt-3 space-y-3">
              {teamIds.map((teamId) => {
                const count = countOf(teamId, half);
                const reached = count >= limitNumber;
                return (
                  <div key={teamId} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {teamName(teamId)}
                    </span>
                    {reached && (
                      <Badge variant="destructive" className="gap-1">
                        <Siren className="size-3" /> Shoot out
                      </Badge>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Remover falta"
                      onClick={() => bump.mutate({ teamId, half, delta: -1 })}
                    >
                      <Minus className="size-4" />
                    </Button>
                    <span
                      className={`w-8 text-center text-lg font-bold ${reached ? "text-destructive" : "text-primary"}`}
                    >
                      {count}
                    </span>
                    <Button
                      size="icon"
                      variant="secondary"
                      aria-label="Adicionar falta"
                      onClick={() => bump.mutate({ teamId, half, delta: 1 })}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        A contagem zera entre os tempos: cada tempo tem seu próprio acumulado. Ao atingir{" "}
        {limitNumber} faltas, todas as faltas seguintes do time naquele tempo são shoot out.
      </p>
    </section>
  );
}
