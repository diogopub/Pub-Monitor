/**
 * SidePanel — Feed da semana baseado nas timelines
 * Design: Constellation dark theme
 */
import { useProjectCards, TimelinePin } from "@/contexts/ProjectCardsContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight, Activity, CalendarDays } from "lucide-react";
import { useMemo } from "react";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface SidePanelProps {
  collapsed: boolean;
  onToggle: () => void;
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

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

export default function SidePanel({
  collapsed,
  onToggle,
}: SidePanelProps) {
  const { state: cardsState, updateCard, togglePinStatus } = useProjectCards();
  const { currentUserRole } = usePermissions();
  const { user } = useAuth();
  const readOnly = currentUserRole === "viewer";
  // Extract first name from Google display name, e.g. "Paola Barbosa" → "Paola"
  const currentUserFirstName = user?.displayName?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "Usuário";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const groupedPins = useMemo(() => {
    // ... logic stays same
    const groups: Record<
      string,
      { dateObj: Date; projects: Record<string, { cardName: string; pins: TimelinePin[] }> }
    > = {};

    cardsState.cards.forEach((card) => {
      if (card.active === false || card.name === "PUB INTERNO") return;
      if (!card.timelinePins) return;

      card.timelinePins.forEach((pin) => {
        const pinDate = parseDateStr(pin.date);
        pinDate.setHours(0, 0, 0, 0);

        const diffTime = pinDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

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

  const handleToggleLabel = (cardId: string, pinId: string, labelIndex: number, currentStatus: boolean, pinLabel: string) => {
    togglePinStatus(cardId, pinId, labelIndex, currentUserFirstName);
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
      className={`h-full transition-all duration-300 ease-in-out relative shrink-0 overflow-hidden ${
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
        <div className="h-full bg-card/50 backdrop-blur-sm border-r border-border flex flex-col items-center py-4 gap-3 overflow-hidden">
          <Activity className="w-4 h-4 text-muted-foreground" />
        </div>
      ) : (
        <div className="min-h-0 h-full bg-card/80 backdrop-blur-md border-r border-border flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border bg-black/20">
            <h2 className="text-sm font-semibold font-heading tracking-wide text-foreground flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              TIMELINE DA SEMANA
            </h2>
            {/* Today's delivery status LED */}
            {(() => {
              const todayStr = formatISO(today);
              const todayGroup = groupedPins[todayStr];
              if (!todayGroup) {
                return (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] shrink-0" />
                    <span className="text-[11px] font-semibold text-emerald-400">Entregas Feitas</span>
                  </div>
                );
              }
              const allPins = Object.values(todayGroup.projects).flatMap(p => p.pins);
              const hasPending = allPins.some(pin =>
                pin.labels.some((_, idx) => !(pin.completedLabels?.[idx]))
              );
              return hasPending ? (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)] shrink-0 animate-pulse" />
                  <span className="text-[11px] font-semibold text-red-400">Entregas Pendentes</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] shrink-0" />
                  <span className="text-[11px] font-semibold text-emerald-400">Entregas Feitas</span>
                </div>
              );
            })()}
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto pr-1">
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
                                              handleToggleLabel(cardId, pin.id, idx, isCompleted, displayLabel)
                                            }
                                            disabled={false} // Todos os papéis podem marcar conforme pedido
                                            className="mt-0.5 w-[14px] h-[14px] rounded-[3px] border-muted-foreground/40 data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-all disabled:opacity-50 disabled:cursor-default"
                                          />
                                        <label
                                          htmlFor={uid}
                                          className={cn(
                                            "text-[11px] font-medium leading-tight select-none",
                                            isCompleted
                                              ? "text-muted-foreground line-through opacity-50"
                                              : "text-foreground group-hover:text-primary transition-colors",
                                            "hover:cursor-pointer"
                                          )}
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
          </div>
        </div>
      )}
    </div>
  );
}
