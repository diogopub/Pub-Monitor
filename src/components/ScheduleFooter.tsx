/**
 * ScheduleFooter — Versão compacta da agenda semanal para o rodapé do Painel
 * Espelha fielmente o WeeklySchedule: mesmo sistema de 8 slots, mesmas linhas especiais,
 * mesmas atividades (incluindo ENTRADAS_ACTIVITIES para sr-entradas).
 */
import { useState, useMemo } from "react";
import { useNetwork, type TeamMember } from "@/contexts/NetworkContext";
import { useSchedule, ACTIVITY_TYPES, ENTRADAS_ACTIVITIES } from "@/contexts/ScheduleContext";
import { useProjectCards } from "@/contexts/ProjectCardsContext";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import DailyAllocationPanel from "@/components/DailyAllocationPanel";
import { entryToSlots, SCHEDULE_SLOTS } from "@/lib/utils";

// ─── FooterTaskBar ────────────────────────────────────────────────
// Espelha o TaskBar do WeeklySchedule usando o MESMO sistema de 8 slots.
// Usa entryToSlots() para normalizar entradas legadas (startOffset/duration como fração)
// e entradas novas (startSlot/duration como inteiros).
function FooterTaskBar({
  entry,
  act,
  proj,
}: {
  entry: any;
  act: any;
  proj: any;
}) {
  const { startSlot, durationSlots } = entryToSlots(entry);

  // Posicionamento idêntico ao TaskBar do WeeklySchedule
  const leftPct  = (startSlot / SCHEDULE_SLOTS) * 100;
  const widthPct = (durationSlots / SCHEDULE_SLOTS) * 100;
  const rowTop   = (entry.slotIndex || 0) * 22 + 2; // 22px por linha de slot, 2px de gap
  const barHeight = 20;

  const label = entry.customLabel || (proj ? proj.name : act.label);

  return (
    <div
      className="absolute flex items-center rounded text-[9px] font-semibold leading-tight z-10"
      style={{
        backgroundColor: act.color,
        color: act.textColor,
        top: `${rowTop}px`,
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        height: `${barHeight}px`,
      }}
      title={`${label} (${durationSlots <= 4 ? "0.5" : "1.0"} diária)`}
    >
      <div className="flex-1 truncate text-center px-1">
        {label}
      </div>
    </div>
  );
}

// ─── Helpers de data ─────────────────────────────────────────────
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
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mo}-${da}`;
}

function formatDayHeader(d: Date): { day: string; weekday: string } {
  const day = String(d.getDate()).padStart(2, "0");
  const weekdays = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  return { day, weekday: weekdays[d.getDay()] };
}

// ─── Props ────────────────────────────────────────────────────────
interface ScheduleFooterProps {
  hoveredProjectId?: string | null;
  selectedProjectId?: string | null;
  highlightMemberId?: string | null;
}

// ─── Componente principal ────────────────────────────────────────
export default function ScheduleFooter({
  hoveredProjectId,
  selectedProjectId,
  highlightMemberId,
}: ScheduleFooterProps) {
  const { state: networkState } = useNetwork();
  const { state: scheduleState, getEntriesForCell, getWeekRoster } = useSchedule();
  const { state: cardsState } = useProjectCards();

  const [currentMonday, setCurrentMonday] = useState(() => getMonday(new Date()));
  const [expanded, setExpanded] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);

  // ─── Drag-to-navigate ──────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    setIsDragging(true);
    setStartX(e.pageX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const x = e.pageX;
    const walk = startX - x;
    const threshold = 80;
    if (Math.abs(walk) > threshold) {
      const daysToShift = Math.floor(walk / threshold);
      if (daysToShift !== 0) {
        setCurrentMonday(prev => addDays(prev, daysToShift));
        setStartX(x);
      }
    }
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // ─── Dias da semana visíveis ──────────────────────────────────
  const weekDays = useMemo(
    () => Array.from({ length: 5 }, (_, i) => addDays(currentMonday, i)),
    [currentMonday]
  );

  const today = formatDate(new Date());
  const weekKey = useMemo(() => formatDate(currentMonday), [currentMonday]);

  // ─── Linhas de membros (mesmo roster do WeeklySchedule) ───────
  const memberRows = useMemo(() => {
    const allMemberIds = networkState.members.map(m => m.id);
    const rosterIds = getWeekRoster ? getWeekRoster(weekKey, allMemberIds) : allMemberIds;
    return rosterIds
      .map(id => networkState.members.find(m => m.id === id))
      .filter((m): m is TeamMember => !!m && m.role !== "management")
      .map(m => ({
        id: m.id,
        name: m.name,
        color: m.color,
        isEntradaEntrega: false,
      }));
  }, [networkState.members, getWeekRoster, weekKey]);

  // ─── Linhas especiais (freelancers + sr-entradas) ─────────────
  const specialRows = useMemo(() => {
    return scheduleState.specialRows
      .filter(r => r.type !== "freelancer")
      .map(sr => ({
        id: sr.id,
        name: sr.name,
        color: "#6366f1",
        isEntradaEntrega: sr.type === "entradas-entregas",
      }));
  }, [scheduleState.specialRows]);

  const rows = useMemo(() => {
    const allRows = [...memberRows, ...specialRows];
    return allRows.filter(row => {
      return weekDays.some(day => {
        const entries = getEntriesForCell(row.id, formatDate(day));
        return entries.length > 0;
      });
    });
  }, [memberRows, specialRows, weekDays, getEntriesForCell, scheduleState.entries]);

  // ─── Projeto ativo no hover/seleção do grafo ──────────────────
  const activeProjectId = selectedProjectId || hoveredProjectId;
  const activeCard = activeProjectId
    ? cardsState.cards.find(c => c.id === activeProjectId)
    : null;

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-auto">
      {/* Barra de toggle */}
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
        <div
          className="bg-black/15 backdrop-blur-md border-t border-white/5 select-none cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
        >
          {activeCard ? (
            /* ─── Painel de diárias do projeto ativo ─── */
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
            /* ─── Agenda compacta (espelho do WeeklySchedule) ─── */
            <ScrollArea className="max-h-[50vh]">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="w-[80px] text-left px-2 py-1 sticky left-0 z-10 bg-black/20 backdrop-blur-sm">
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-white/50 hover:text-white/80 hover:bg-white/10"
                          onClick={() => setCurrentMonday(m => addDays(m, -7))}
                        >
                          <ChevronLeft className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-white/50 hover:text-white/80 hover:bg-white/10"
                          onClick={() => setCurrentMonday(m => addDays(m, 7))}
                        >
                          <ChevronRight className="w-3 h-3" />
                        </Button>
                      </div>
                    </th>
                    {weekDays.map(day => {
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
                            <span
                              className={`text-[9px] uppercase font-bold tracking-tight ${
                                isToday ? "text-primary/80" : "text-white/30"
                              }`}
                            >
                              {weekday}
                            </span>
                            <span
                              className={`text-[9px] font-bold ${
                                isToday ? "text-primary" : "text-white/60"
                              }`}
                            >
                              {dayNum}
                            </span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const isHighlighted = highlightMemberId === row.id;
                    const activityList = row.isEntradaEntrega
                      ? ENTRADAS_ACTIVITIES
                      : ACTIVITY_TYPES;

                    const rowEntries = weekDays.flatMap(day =>
                      getEntriesForCell(row.id, formatDate(day))
                    );
                    const maxSlot = rowEntries.reduce((acc, e) => Math.max(acc, e.slotIndex || 0), 0);
                    const dynamicHeight = (maxSlot + 1) * 22 + 2;

                    return (
                      <tr
                        key={row.id}
                        className={`transition-colors ${
                          isHighlighted
                            ? "bg-white/15 ring-1 ring-white/20"
                            : "hover:bg-white/5"
                        }`}
                      >
                        {/* Coluna de nome */}
                        <td
                          className={`px-2 py-0.5 sticky left-0 z-20 backdrop-blur-sm border-t border-white/5 ${
                            isHighlighted ? "bg-white/10" : "bg-black/15"
                          }`}
                          style={{ height: `${dynamicHeight}px` }}
                        >
                          <div className="flex flex-col justify-center h-full gap-0.5">
                            <div className="flex items-center gap-1.5 pt-1">
                              <div
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  isHighlighted ? "ring-1 ring-white/40" : ""
                                }`}
                                style={{ backgroundColor: row.color }}
                              />
                              <span
                                className={`text-[9px] font-medium truncate max-w-[60px] ${
                                  isHighlighted ? "text-white/90" : "text-white/60"
                                }`}
                              >
                                {row.name}
                              </span>
                            </div>
                            <div className="text-[7px] text-white/40 font-mono pl-3">
                              {weekDays
                                .reduce((acc, day) => {
                                  const entries = getEntriesForCell(
                                    row.id,
                                    formatDate(day)
                                  );
                                  return (
                                    acc +
                                    entries.reduce(
                                      (dayAcc, e) =>
                                        dayAcc +
                                        (entryToSlots(e).durationSlots <= 4
                                          ? 0.5
                                          : 1.0),
                                      0
                                    )
                                  );
                                }, 0)
                                .toFixed(1)}D TOT
                            </div>
                          </div>
                        </td>

                        {/* Colunas de dias */}
                        {weekDays.map((day, dayIdx) => {
                          const dateStr = formatDate(day);
                          const isTodayCol = dateStr === today;
                          const entries = getEntriesForCell(row.id, dateStr);
                          return (
                            <td
                              key={dateStr}
                              className={`border-t border-l border-white/5 align-top relative ${
                                isTodayCol ? "bg-primary/5" : ""
                              }`}
                              style={{ zIndex: 10 - dayIdx }}
                            >
                              <div
                                className="w-full relative"
                                style={{ height: `${dynamicHeight}px` }}
                              >
                                {entries.map(entry => {
                                  // Mesma lógica de lookup do WeeklySchedule:
                                  // prefere activityList, fallback para ACTIVITY_TYPES
                                  const activity =
                                    activityList.find(
                                      a => a.id === entry.activityId
                                    ) ||
                                    ACTIVITY_TYPES.find(
                                      a => a.id === entry.activityId
                                    );
                                  if (!activity) return null;
                                  const proj = entry.projectId
                                    ? cardsState.cards.find(
                                        c => c.id === entry.projectId
                                      )
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
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
}
