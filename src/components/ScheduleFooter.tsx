/**
 * ScheduleFooter — Versão compacta da agenda semanal para o rodapé do Painel
 * Quando um projeto é hovered no grafo, mostra o painel de Diárias desse projeto.
 */
import { useState, useMemo } from "react";
import { useNetwork } from "@/contexts/NetworkContext";
import { useSchedule, ACTIVITY_TYPES } from "@/contexts/ScheduleContext";
import { useProjectCards } from "@/contexts/ProjectCardsContext";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import DailyAllocationPanel from "@/components/DailyAllocationPanel";

function FooterTaskBar({
  entry,
  act,
  proj,
}: {
  entry: any;
  act: any;
  proj: any;
}) {
  const duration = entry.duration || 1;
  const slotIndex = entry.slotIndex || 0;
  const startOffset = entry.startOffset || 0;
  const paddingCompensation = Math.max(0, Math.ceil(duration - 1)) * 1;

  return (
    <div
      className="absolute flex items-center rounded-[2px] text-[8px] font-bold leading-tight z-10"
      style={{
        backgroundColor: act.color,
        color: act.textColor,
        top: `${slotIndex * 17 + 2}px`,
        left: startOffset === 0 ? '1px' : `calc(${startOffset * 100}% + 1px)`,
        width: `calc(${duration * 100}% - 2px + ${paddingCompensation}px)`,
        height: '15px',
      }}
      title={proj ? proj.name : act.label}
    >
      <div className="flex-1 truncate text-center px-1">
        {proj ? proj.name : act.label}
      </div>
    </div>
  );
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, days: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function formatDayHeader(d: Date): { day: string; weekday: string } {
  const day = String(d.getDate()).padStart(2, "0");
  const weekdays = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  return { day, weekday: weekdays[d.getDay()] };
}

interface ScheduleFooterProps {
  hoveredProjectId?: string | null;
  selectedProjectId?: string | null;
  highlightMemberId?: string | null;
}

export default function ScheduleFooter({ hoveredProjectId, selectedProjectId, highlightMemberId }: ScheduleFooterProps) {
  const { state: networkState } = useNetwork();
  const { state: scheduleState, getEntriesForCell } = useSchedule();
  const { state: cardsState } = useProjectCards();
  const [currentMonday, setCurrentMonday] = useState(() => getMonday(new Date()));
  const [expanded, setExpanded] = useState(true);

  const weekDays = useMemo(
    () => Array.from({ length: 5 }, (_, i) => addDays(currentMonday, i)),
    [currentMonday]
  );

  const today = formatDate(new Date());

  const rows = useMemo(() => {
    return networkState.members.map((m) => ({
      id: m.id,
      name: m.name,
      color: m.color,
    }));
  }, [networkState.members]);

  // Find hovered or selected project card
  const activeProjectId = selectedProjectId || hoveredProjectId;
  const activeCard = activeProjectId
    ? cardsState.cards.find((c) => c.id === activeProjectId)
    : null;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-auto">
      {/* Toggle bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center py-1 bg-black/30 backdrop-blur-md border-t border-white/10 hover:bg-black/40 transition-colors cursor-pointer"
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-white/50" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5 text-white/50" />
        )}
        <span className="text-[10px] text-white/40 ml-1.5 uppercase tracking-wider font-medium">
          {activeCard ? `Timeline — ${activeCard.name}` : "Agenda"}
        </span>
      </button>

      {expanded && (
        <div className="bg-black/15 backdrop-blur-md border-t border-white/5">
          {activeCard ? (
            /* ─── Diárias panel for active project ─── */
            <div className="p-1 w-full max-h-[50vh] overflow-y-auto">
              <DailyAllocationPanel
                cardId={activeCard.id}
                cardName={activeCard.name}
                entryDate={activeCard.entryDate}
                deliveryDate={activeCard.deliveryDate}
                allocations={activeCard.dailyAllocations || {}}
                timelinePins={activeCard.timelinePins || []}
                onClose={() => {}}
              />
            </div>
          ) : (
            /* ─── Default schedule view ─── */
            <ScrollArea className="max-h-[50vh]">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[500px]">
                  <thead>
                    <tr>
                      <th className="w-[80px] text-left px-2 py-1 sticky left-0 z-10 bg-black/20 backdrop-blur-sm">
                        <div className="flex items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-white/50 hover:text-white/80 hover:bg-white/10"
                            onClick={() => setCurrentMonday((m) => addDays(m, -7))}
                          >
                            <ChevronLeft className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-white/50 hover:text-white/80 hover:bg-white/10"
                            onClick={() => setCurrentMonday((m) => addDays(m, 7))}
                          >
                            <ChevronRight className="w-3 h-3" />
                          </Button>
                        </div>
                      </th>
                      {weekDays.map((day) => {
                        const { day: dayNum, weekday } = formatDayHeader(day);
                        const isToday = formatDate(day) === today;
                        return (
                          <th
                            key={formatDate(day)}
                            className={`text-center px-1 py-1 border-l border-white/5 min-w-[80px] ${
                              isToday ? "bg-primary/10" : ""
                            }`}
                          >
                            <div className="flex flex-col items-center select-none pointer-events-none">
                              <span className={`text-[9px] uppercase font-bold tracking-tight ${isToday ? "text-primary/80" : "text-white/30"}`}>
                                {weekday}
                              </span>
                              <span className={`text-[9px] font-bold ${isToday ? "text-primary" : "text-white/60"}`}>
                                {dayNum}
                              </span>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const isHighlighted = highlightMemberId === row.id;
                      
                      const rowEntries = weekDays.flatMap(day => getEntriesForCell(row.id, formatDate(day)));
                      const maxSlot = rowEntries.length > 0 ? Math.max(...rowEntries.map(e => e.slotIndex || 0)) : 0;
                      const rowHeight = Math.max(22, (maxSlot + 1) * 17 + 4);

                      return (
                      <tr key={row.id} className={`transition-colors ${isHighlighted ? "bg-white/15 ring-1 ring-white/20" : "hover:bg-white/5"}`}>
                        <td 
                          className={`px-2 py-0.5 sticky left-0 z-20 backdrop-blur-sm border-t border-white/5 ${isHighlighted ? "bg-white/10" : "bg-black/15"}`}
                          style={{ height: `${rowHeight}px` }}
                        >
                          <div className="flex items-center gap-1.5 h-full">
                            <div
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${isHighlighted ? "ring-1 ring-white/40" : ""}`}
                              style={{ backgroundColor: row.color }}
                            />
                            <span className={`text-[9px] font-medium truncate max-w-[60px] ${isHighlighted ? "text-white/90" : "text-white/60"}`}>
                              {row.name}
                            </span>
                          </div>
                        </td>
                        {weekDays.map((day, dayIdx) => {
                          const dateStr = formatDate(day);
                          const isToday = dateStr === today;
                          const entries = getEntriesForCell(row.id, dateStr);
                          return (
                            <td
                              key={dateStr}
                              className={`border-t border-l border-white/5 align-top relative ${
                                isToday ? "bg-primary/5" : ""
                              }`}
                              style={{ zIndex: 10 - dayIdx }}
                            >
                              <div className="w-full relative" style={{ height: `${rowHeight}px` }}>
                                {entries.map((entry) => {
                                  const activity = ACTIVITY_TYPES.find((a) => a.id === entry.activityId);
                                  if (!activity) return null;
                                  const proj = entry.projectId
                                    ? cardsState.cards.find((c) => c.id === entry.projectId)
                                    : null;
                                  return (
                                    <FooterTaskBar
                                      key={entry.id}
                                      entry={entry}
                                      act={activity}
                                      proj={proj}
                                    />
                                  );
                                })}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
}
