/**
 * WorkloadBar — Barra de carga de trabalho flutuante no canto inferior direito
 * Mostra quantos projetos cada membro está alocado
 */
import { useNetwork } from "@/contexts/NetworkContext";
import { useProjectCards } from "@/contexts/ProjectCardsContext";
import { useSchedule } from "@/contexts/ScheduleContext";
import { useState } from "react";
import { ChevronDown, ChevronUp, BarChart3 } from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

// ─── Date helpers ────────────────────────────────────────────────
function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export default function WorkloadBar() {
  const { state } = useNetwork();
  const { state: cardsState } = useProjectCards();
  const { getWeekRoster } = useSchedule();
  const [expanded, setExpanded] = useState(false);

  // Filter members based on weekly roster and exclude Vinícius
  const weekKey = formatDate(getMonday(new Date()));
  const rosterIds = getWeekRoster(weekKey, state.members.map(m => m.id));

  const filteredMembers = state.members.filter(m => {
    // 1. Must be in the weekly roster
    if (!rosterIds.includes(m.id)) return false;
    
    // 2. Exclude Vinícius
    const name = m.name?.toLowerCase() || "";
    if (name.includes("vinicius") || name.includes("vinícius")) return false;

    return true;
  });

  const workload = filteredMembers.map((m) => {
    const memberName = (m.name || "").toLowerCase();
    const assignedProjects = cardsState.cards.filter((card) =>
      card.active !== false &&
      card.team.some((tm) => tm.name && tm.name.toLowerCase() === memberName)
    ).map(c => c.name);

    return { ...m, assignedProjects, projectCount: assignedProjects.length };
  });

  const maxProjects = Math.max(...workload.map((w) => w.projectCount), 1);

  return (
    <div className="absolute bottom-4 right-4 z-[50]">
      <div className="bg-card/80 backdrop-blur-md border border-border rounded-lg overflow-hidden shadow-2xl">
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
                      <HoverCard openDelay={100} closeDelay={100}>
                        <HoverCardTrigger asChild>
                          <span className="font-medium cursor-help hover:text-primary transition-colors underline decoration-dotted decoration-border underline-offset-2">
                            {w.name}
                          </span>
                        </HoverCardTrigger>
                        <HoverCardContent side="left" className="w-48 p-2 bg-popover/95 backdrop-blur-md border-border shadow-xl z-[60]">
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                              Projetos Designados
                            </p>
                            {w.assignedProjects.length > 0 ? (
                              <ul className="space-y-1">
                                {w.assignedProjects.map((proj, i) => (
                                  <li key={i} className="text-[10px] flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-primary" />
                                    <span className="truncate">{proj}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-[10px] text-muted-foreground italic">Nenhum projeto ativo</p>
                            )}
                          </div>
                        </HoverCardContent>
                      </HoverCard>
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
