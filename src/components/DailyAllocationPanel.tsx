/**
 * DailyAllocationPanel — Grid de alocação diária por papel
 * Mostra 3 semanas (anterior, atual, próxima) com navegação.
 * Clicar na célula acende/apaga a cor do papel.
 */
import { useState, useMemo } from "react";
import { useProjectCards, type DailyAllocations } from "@/contexts/ProjectCardsContext";
import { ChevronLeft, ChevronRight } from "lucide-react";

const ROLES = [
  { id: "criacao", label: "Criação", color: "#dc2626" },
  { id: "arq", label: "Arquitetura", color: "#16a34a" },
  { id: "3d", label: "3D", color: "#2563eb" },
  { id: "3d2", label: "3D-2", color: "#7c3aed" },
] as const;

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function formatISO(d: Date): string {
  return d.toISOString().split("T")[0];
}

/** Generate a single week (Mon-Fri) starting from a Monday */
function generateWeek(monday: Date): Date[] {
  return Array.from({ length: 5 }, (_, i) => addDays(monday, i));
}

interface Props {
  cardId: string;
  cardName: string;
  entryDate: string;
  deliveryDate: string;
  allocations: DailyAllocations;
  onClose: () => void;
}

export default function DailyAllocationPanel({
  cardId,
  cardName,
  allocations,
  onClose,
}: Props) {
  const { updateCard } = useProjectCards();
  const [centerMonday, setCenterMonday] = useState(() => getMonday(new Date()));

  const nineWeeks = Array.from({ length: 9 }, (_, i) => 
    generateWeek(addDays(centerMonday, (i - 4) * 7))
  );

  const toggleCell = (date: string, roleId: string) => {
    const current = { ...allocations };
    const dayRoles = current[date] ? [...current[date]] : [];
    const idx = dayRoles.indexOf(roleId);
    if (idx >= 0) {
      dayRoles.splice(idx, 1);
    } else {
      dayRoles.push(roleId);
    }
    if (dayRoles.length === 0) {
      delete current[date];
    } else {
      current[date] = dayRoles;
    }
    updateCard(cardId, { dailyAllocations: current });
  };

  const isActive = (date: string, roleId: string): boolean => {
    return allocations[date]?.includes(roleId) ?? false;
  };

  const totalCount = useMemo(() => {
    let count = 0;
    for (const roles of Object.values(allocations)) {
      count += roles.length;
    }
    return count;
  }, [allocations]);

  const goBack = () => setCenterMonday(addDays(centerMonday, -7));
  const goForward = () => setCenterMonday(addDays(centerMonday, 7));

  return (
    <div className="bg-card/95 backdrop-blur-md border border-border rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-3 py-2 border-b border-border bg-muted/30">
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground mr-2">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-bold font-heading uppercase tracking-wide text-foreground flex-1 text-center">
          Alocação Diária - {cardName}
        </span>
        <span className="text-[10px] font-mono font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
          {totalCount} diária{totalCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Grid with navigation */}
      <div className="p-3">
        <div className="flex items-start gap-1">
          {/* Nav back */}
          <button
            onClick={goBack}
            className="mt-3 p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* 9 weeks */}
          <div className="flex gap-3 flex-1 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent">
            {nineWeeks.map((week, wi) => (
              <div key={wi} className="flex-shrink-0">
                {/* Day numbers header */}
                <div className="grid grid-cols-5 gap-px mb-1">
                  {week.map((day) => (
                    <div
                      key={formatISO(day)}
                      title={formatISO(day)}
                      className="text-center text-[9px] font-mono text-muted-foreground w-6 sm:w-8"
                    >
                      {day.getDate()}
                    </div>
                  ))}
                </div>

                {/* Role rows */}
                {ROLES.map((role) => (
                  <div key={role.id} className="grid grid-cols-5 gap-px mb-px">
                    {week.map((day) => {
                      const dateStr = formatISO(day);
                      const active = isActive(dateStr, role.id);
                      return (
                        <button
                          key={dateStr}
                          title={`${role.label} - ${dateStr}`}
                          onClick={() => toggleCell(dateStr, role.id)}
                          className="w-6 sm:w-8 h-5 sm:h-6 rounded-sm border border-border/30 transition-colors hover:opacity-80"
                          style={{
                            backgroundColor: active ? role.color : "transparent",
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Nav forward */}
          <button
            onClick={goForward}
            className="mt-3 p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/30">
          {ROLES.map((role) => (
            <div key={role.id} className="flex items-center gap-1">
              <div
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: role.color }}
              />
              <span className="text-[9px] text-muted-foreground">{role.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
