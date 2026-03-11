/**
 * WorkloadBar — Barra de carga de trabalho flutuante no canto inferior direito
 * Mostra quantos projetos cada membro está alocado
 */
import { useNetwork } from "@/contexts/NetworkContext";
import { useProjectCards } from "@/contexts/ProjectCardsContext";
import { useState } from "react";
import { ChevronDown, ChevronUp, BarChart3 } from "lucide-react";

export default function WorkloadBar() {
  const { state } = useNetwork();
  const { state: cardsState } = useProjectCards();
  const [expanded, setExpanded] = useState(false);

  const workload = state.members.map((m) => {
    const projectCount = cardsState.cards.filter((card) =>
      card.active !== false &&
      card.team.some((tm) => tm.name && tm.name.toLowerCase() === m.name.toLowerCase())
    ).length;

    return { ...m, projectCount };
  });

  const maxProjects = Math.max(...workload.map((w) => w.projectCount), 1);

  return (
    <div className="absolute bottom-4 right-4 z-10">
      <div className="bg-card/80 backdrop-blur-md border border-border rounded-lg overflow-hidden">
        {/* Toggle header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 px-3 py-2 w-full hover:bg-accent/30 transition-colors"
        >
          <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider font-heading">
            Carga de Trabalho
          </span>
          {expanded ? (
            <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto" />
          ) : (
            <ChevronUp className="w-3 h-3 text-muted-foreground ml-auto" />
          )}
        </button>

        {expanded && (
          <div className="px-3 pb-3 space-y-2 min-w-[200px]">
            {workload
              .sort((a, b) => b.projectCount - a.projectCount)
              .map((w) => (
                <div key={w.id} className="space-y-0.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: w.color }}
                      />
                      <span className="font-medium">{w.name}</span>
                    </div>
                    <span className="text-muted-foreground text-[10px]">
                      {w.projectCount} projeto{w.projectCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(w.projectCount / maxProjects) * 100}%`,
                        backgroundColor: w.color,
                        opacity: 0.8,
                      }}
                    />
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
