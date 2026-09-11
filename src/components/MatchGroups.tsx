import { type Match, type Team } from "@/hooks/use-tournament";
import { groupMatchesByDay } from "@/lib/tournament";
import { MatchCard } from "@/components/MatchCard";

/**
 * Lista de jogos em blocos por dia.
 *
 * O título do dia é quem carrega a data: o card mostra só "sáb. 17:30". Por isso
 * qualquer lista de jogos deve passar por aqui, e não renderizar `MatchCard` solto,
 * senão o jogo aparece sem dia nenhum.
 */
export function MatchGroups({
  matches,
  teams,
  emptyMessage,
}: {
  matches: Match[];
  teams: Team[];
  emptyMessage: string;
}) {
  const grouped = groupMatchesByDay(matches);

  if (matches.length === 0) {
    return <div className="surface-card p-8 text-center text-muted-foreground">{emptyMessage}</div>;
  }

  return (
    <div className="space-y-8">
      {Object.entries(grouped).map(([day, list]) => (
        <section key={day}>
          <h2 className="text-stencil mb-3 text-xl font-bold text-primary sm:text-2xl">{day}</h2>
          <div className="space-y-3">
            {list.map((m) => (
              <MatchCard key={m.id} match={m} teams={teams} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
