/**
 * SidePanel — Feed da semana baseado nas timelines
 * Design: Constellation dark theme
 */
import { useProjectCards, TimelinePin } from "@/contexts/ProjectCardsContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight, Activity, CalendarDays } from "lucide-react";
import { useMemo } from "react";

interface SidePanelProps {
  collapsed: boolean;
  onToggle: () => void;
  selectedNodeId?: string | null;
  selectedNodeType?: "member" | "project" | null;
  onClearSelection: () => void;
}

function parseDateStr(str: string): Date {
  if (!str) return new Date();
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatISO(d: Date): string {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mo}-${da}`;
}

const WEEKDAYS = [
  "DOMINGO",
  "SEGUNDA-FEIRA",
  "TERÇA-FEIRA",
  "QUARTA-FEIRA",
  "QUINTA-FEIRA",
  "SEXTA-FEIRA",
  "SÁBADO"
];

export default function SidePanel({
  collapsed,
  onToggle,
}: SidePanelProps) {
  const { state: cardsState, updateCard } = useProjectCards();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const groupedPins = useMemo(() => {
    const groups: Record<
      string,
      { dateObj: Date; projects: Record<string, { cardName: string; pins: TimelinePin[] }> }
    > = {};

    cardsState.cards.forEach((card) => {
      // Ignore inactive projects and PUB INTERNO as it doesn't represent real milestones
      if (card.active === false || card.name === "PUB INTERNO") return;
      if (!card.timelinePins) return;

      card.timelinePins.forEach((pin) => {
        const pinDate = parseDateStr(pin.date);
        pinDate.setHours(0, 0, 0, 0);

        const diffTime = pinDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Group past pins as "Atrasados" or just show today + future
        if (diffDays >= 0 && diffDays <= 14) {
          if (!groups[pin.date]) {
            groups[pin.date] = { dateObj: pinDate, projects: {} };
          }
          if (!groups[pin.date].projects[card.id]) {
            groups[pin.date].projects[card.id] = { cardName: card.name, pins: [] };
          }
          groups[pin.date].projects[card.id].pins.push(pin);
        }
      });
    });

    return groups;
  }, [cardsState.cards, today]);

  const sortedDates = Object.keys(groupedPins).sort((a, b) => a.localeCompare(b));

  const handleToggleLabel = (cardId: string, pinId: string, labelIndex: number, currentStatus: boolean) => {
    const card = cardsState.cards.find((c) => c.id === cardId);
    if (!card || !card.timelinePins) return;

    const newPins = card.timelinePins.map((p) => {
      if (p.id !== pinId) return p;
      // Initialize if missing
      const completedLabels = p.completedLabels ? [...p.completedLabels] : new Array(p.labels.length).fill(false);
      completedLabels[labelIndex] = !currentStatus;
      return { ...p, completedLabels };
    });

    updateCard(cardId, { timelinePins: newPins });
  };

  const getDayLabel = (dateObj: Date) => {
    const diffTime = dateObj.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "HOJE";
    if (diffDays === 1) return "AMANHÃ";

    return WEEKDAYS[dateObj.getDay()];
  };

  return (
    <div
      className={`h-full transition-all duration-300 ease-in-out relative shrink-0 ${
        collapsed ? "w-12" : "w-80"
      }`}
    >
      <button
        onClick={onToggle}
        className="absolute -right-3 top-6 z-10 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center hover:bg-accent transition-colors shadow-md"
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </button>

      {collapsed ? (
        <div className="h-full bg-card/50 backdrop-blur-sm border-r border-border flex flex-col items-center py-4 gap-3">
          <Activity className="w-4 h-4 text-muted-foreground" />
        </div>
      ) : (
        <div className="h-full bg-card/80 backdrop-blur-md border-r border-border flex flex-col">
          <div className="p-4 border-b border-border bg-black/20">
            <h2 className="text-sm font-semibold font-heading tracking-wide text-foreground flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              TIMELINE DA SEMANA
            </h2>
            <p className="text-xs text-muted-foreground mt-1 leading-snug">
              Próximos passos e entregas dos projetos nos próximos 14 dias
            </p>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-6">
              {sortedDates.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground p-8 bg-black/20 rounded-lg border border-white/5">
                  Nenhuma entrega programada para o período.
                </div>
              ) : (
                sortedDates.map((dateStr) => {
                  const group = groupedPins[dateStr];
                  const label = getDayLabel(group.dateObj);
                  return (
                    <div key={dateStr} className="space-y-4">
                      {/* Day Header */}
                      <div className="sticky top-0 bg-transparent z-10">
                        <div className="flex items-center gap-2">
                          <h3 className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">{label}</h3>
                          <div className="flex-1 h-px bg-white/10" />
                        </div>
                        {label !== "HOJE" && label !== "AMANHÃ" && (
                          <div className="text-[9px] text-white/30 tracking-widest font-mono mt-0.5">
                            {formatISO(group.dateObj).split('-').reverse().join('/')}
                          </div>
                        )}
                      </div>

                      {/* Projects & Items */}
                      <div className="space-y-3">
                        {Object.entries(group.projects).map(([cardId, projData]) => (
                          <div key={cardId} className="space-y-1.5 bg-black/20 rounded-lg p-3 border border-white/5 shadow-sm">
                            <h4 className="text-[10px] font-bold text-primary uppercase tracking-wide">
                              {projData.cardName}
                            </h4>
                            <div className="space-y-2">
                              {projData.pins.map((pin) => (
                                <div key={pin.id} className="flex flex-col gap-1.5">
                                  {pin.labels.map((pinLabel, idx) => {
                                    const isCompleted = pin.completedLabels?.[idx] || false;
                                    const uid = `${pin.id}-${idx}`;
                                    // Use fallback label if empty
                                    const displayLabel = pinLabel || "ENTRADA";

                                    return (
                                      <div key={uid} className="flex items-start gap-2 group">
                                        <Checkbox
                                          id={uid}
                                          checked={isCompleted}
                                          onCheckedChange={() =>
                                            handleToggleLabel(cardId, pin.id, idx, isCompleted)
                                          }
                                          className="mt-0.5 w-[14px] h-[14px] rounded-[3px] border-muted-foreground/40 data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-all"
                                        />
                                        <label
                                          htmlFor={uid}
                                          className={`text-[11px] font-medium leading-tight ${
                                            isCompleted
                                              ? "text-muted-foreground line-through opacity-50"
                                              : "text-foreground group-hover:text-primary transition-colors hover:cursor-pointer"
                                          } select-none`}
                                          title={displayLabel}
                                        >
                                          {displayLabel}
                                        </label>
                                      </div>
                                    );
                                  })}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
