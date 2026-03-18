import React, { useState, useMemo } from "react";
import { useProjectCards, type TimelinePin } from "@/contexts/ProjectCardsContext";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus, X } from "lucide-react";
import { nanoid } from "nanoid";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const PIN_LABELS = [
  "ENTRADA",
  "ENTENDIMENTO BRIEFING",
  "KICKOFF CRIATIVO",
  "PRÉVIA IA",
  "PRÉVIA PLANTA",
  "PRÉVIA 3D",
  "FINAL PLANTA",
  "FINAL 3D",
  "DESCRITIVO",
  "ORÇAMENTO",
  "OUTROS",
];

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

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function formatDateShort(d: Date): string {
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${da}/${mo}`;
}

interface Props {
  cardId: string;
  cardName: string;
  entryDate: string;
  deliveryDate: string;
  allocations: Record<string, string[]>; // kept for API compat but unused
  timelinePins: TimelinePin[];
  onClose: () => void;
}

export default function DailyAllocationPanel({
  cardId,
  cardName,
  entryDate,
  deliveryDate,
  timelinePins = [],
  onClose,
}: Props) {
  const { updateCard } = useProjectCards();

  const [draggedPinId, setDraggedPinId] = useState<string | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);

  // View control: baseDate is the leftmost day in the window
  const [baseDate, setBaseDate] = useState(() => {
    // Default: 7 days before today to center today in a 15-day range
    return addDays(new Date(), -7);
  });

  const goToToday = () => {
    setBaseDate(addDays(new Date(), -7));
  };

  // Always show exactly 15 days (centered on current baseDate)
  const daysArray = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < 15; i++) {
      arr.push(addDays(baseDate, i));
    }
    return arr;
  }, [baseDate]);

  // Pin handlers
  const handleAddPin = () => {
    // Add to the first day of the current view (next to the + button)
    const dateToUse = formatISO(daysArray[0]);
    const newPin: TimelinePin = {
      id: nanoid(8),
      date: dateToUse,
      color: "white",
      labels: ["ENTRADA"],
    };
    updateCard(cardId, { timelinePins: [...timelinePins, newPin] });
  };

  const handleUpdatePin = (id: string, updates: Partial<TimelinePin>) => {
    updateCard(cardId, {
      timelinePins: timelinePins.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    });
  };

  const handleRemovePin = (id: string) => {
    updateCard(cardId, {
      timelinePins: timelinePins.filter((p) => p.id !== id),
    });
  };

  const handleDragEnter = (dStr: string) => {
    if (draggedPinId) setDropTargetDate(dStr);
  };

  const handleDragEnd = () => {
    if (draggedPinId && dropTargetDate) {
      handleUpdatePin(draggedPinId, { date: dropTargetDate });
    }
    setDraggedPinId(null);
    setDropTargetDate(null);
  };

  // Removed fixed COL_WIDTH. We'll use percentage-based widths for 15 days.
  const TIMELINE_Y = 100;
  const SIDE_PADDING = 60; // Left padding for the [+] button area

  return (
    <div className="bg-[#11131a]/95 backdrop-blur-md border-none rounded-none overflow-hidden w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-border bg-black/40 shrink-0">
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground mr-4 p-1 rounded hover:bg-white/10"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex flex-col flex-1 text-center">
          <span className="text-sm font-bold font-heading uppercase tracking-wide text-foreground">
            Timeline — {cardName}
          </span>
          <div className="flex items-center justify-center gap-4 mt-1">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setBaseDate(prev => addDays(prev, -7))}
                className="p-1 hover:bg-white/10 rounded text-muted-foreground hover:text-white transition-colors"
                title="Semana Anterior"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setBaseDate(prev => addDays(prev, -1))}
                className="p-1 hover:bg-white/10 rounded text-muted-foreground hover:text-white transition-colors"
                title="Dia Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            <span className="text-[10px] text-muted-foreground font-mono min-w-[120px]">
              {formatDateShort(daysArray[0])} – {formatDateShort(daysArray[daysArray.length - 1])}
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setBaseDate(prev => addDays(prev, 1))}
                className="p-1 hover:bg-white/10 rounded text-muted-foreground hover:text-white transition-colors"
                title="Próximo Dia"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setBaseDate(prev => addDays(prev, 7))}
                className="p-1 hover:bg-white/10 rounded text-muted-foreground hover:text-white transition-colors"
                title="Próxima Semana"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        <button
          onClick={goToToday}
          className="text-[10px] bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-white transition-colors mr-2 font-semibold uppercase tracking-wider"
        >
          Hoje
        </button>
      </div>

      {/* Timeline area */}
      <div className="flex-1 overflow-hidden">
        <div
          className="relative w-full h-full"
          style={{ minHeight: "180px" }}
        >
          {/* Day Columns, Backgrounds, and Grid */}
          <div className="absolute inset-0 flex" style={{ paddingLeft: `${SIDE_PADDING}px` }}>
            {daysArray.map((d, i) => {
              const dayOfWeek = d.getDay();
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
              const isToday = formatISO(d) === formatISO(new Date());

              return (
                <div
                  key={d.toISOString()}
                  className={`flex-1 relative border-l border-white/5 transition-colors ${isWeekend ? "bg-white/[0.02]" : ""
                    } ${isToday ? "bg-primary/5" : ""}`}
                >
                  {/* Day labels at top (Weekday + Number) */}
                  <div className={`absolute top-2 w-full text-center text-[10px] font-mono select-none pointer-events-none leading-[1.3] ${isToday ? "text-primary font-bold" : "text-white/30"
                    }`}>
                    <div className="uppercase">
                      {["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][dayOfWeek]}
                    </div>
                    <div>{d.getDate()}</div>
                    {isToday && <div className="w-1 h-1 bg-primary rounded-full mx-auto mt-0.5" />}
                  </div>

                  {/* Drop zone for this day */}
                  <div
                    className="absolute inset-0"
                    onDragOver={(e) => e.preventDefault()}
                    onDragEnter={() => handleDragEnter(formatISO(d))}
                  />
                </div>
              );
            })}
            {/* Final right border */}
            <div className="border-l border-white/5" />
          </div>

          {/* Horizontal timeline line - Full Width after padding */}
          <div
            className="absolute right-0 h-[2px] bg-white/80 pointer-events-none"
            style={{ top: `${TIMELINE_Y}px`, left: `${SIDE_PADDING}px` }}
          />

          {/* Add pin button (left side) */}
          <div
            className="absolute left-3 flex items-center"
            style={{ top: `${TIMELINE_Y - 14}px` }}
          >
            <button
              onClick={handleAddPin}
              className="p-1.5 rounded bg-white/10 text-white hover:bg-white/20 transition-all hover:scale-110 shadow-lg border border-white/10 active:scale-95"
              title="Adicionar Pin"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Pins Layer */}
          <div className="absolute inset-0 pointer-events-none" style={{ paddingLeft: `${SIDE_PADDING}px` }}>
            <div className="relative w-full h-full">
              {timelinePins.map((pin) => {
                const dayIdx = daysArray.findIndex((d) => formatISO(d) === pin.date);
                if (dayIdx < 0) return null;
                const leftPercent = dayIdx * (100 / 15);

                return (
                  <div
                    key={pin.id}
                    className="absolute pointer-events-auto h-full"
                    style={{ left: `${leftPercent}%`, width: `${100 / 15}%` }}
                  >
                    <TimelinePinElement
                      pin={pin}
                      timelineY={TIMELINE_Y}
                      onUpdate={(ups) => handleUpdatePin(pin.id, ups)}
                      onRemove={() => handleRemovePin(pin.id)}
                      onDragStart={() => setDraggedPinId(pin.id)}
                      onDragEnd={handleDragEnd}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Pin Component ────────────────────────────────────────────────
function TimelinePinElement({
  pin,
  timelineY,
  onUpdate,
  onRemove,
  onDragStart,
  onDragEnd,
}: {
  pin: TimelinePin;
  timelineY: number;
  onUpdate: (u: Partial<TimelinePin>) => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const pinLabels = pin.labels && pin.labels.length > 0 ? pin.labels : ["ENTRADA"];

  const handleUpdateLabel = (idx: number, newVal: string) => {
    const newLabels = [...pinLabels];
    newLabels[idx] = newVal;
    onUpdate({ labels: newLabels });
  };

  const handleRemoveLabel = (idx: number) => {
    const newLabels = [...pinLabels];
    newLabels.splice(idx, 1);
    if (newLabels.length === 0) onRemove();
    else onUpdate({ labels: newLabels });
  };

  const handleAddLabel = () => {
    onUpdate({ labels: [...pinLabels, "ENTRADA"] });
  };

  const handleToggleColor = () => {
    let next: TimelinePin["color"] = "white";
    if (pin.color === "white") next = "yellow";
    if (pin.color === "yellow") next = "red";
    onUpdate({ color: next });
  };

  const colorHex =
    pin.color === "white" ? "#fff" : pin.color === "yellow" ? "#facc15" : "#ef4444";

  const PIN_HEAD_H = 20; // px height of pin head rectangle
  const PIN_STICK_H = 16; // px height of stick below head

  // Date label sits above pin head
  const dateTop = timelineY - PIN_HEAD_H - PIN_STICK_H - 20;
  const headTop = timelineY - PIN_HEAD_H - PIN_STICK_H;
  const stickTop = timelineY - PIN_STICK_H;
  // Labels sit below the timeline line
  const labelsTop = timelineY + 8;

  return (
    <div
      className="absolute group/pin w-full h-full left-0 top-0"
    >
      {/* Date label */}
      <div
        className="absolute text-[11px] font-mono font-bold text-white select-none pointer-events-none text-center"
        style={{
          top: `${dateTop}px`,
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "#11131a",
          padding: "0 2px",
          borderRadius: "2px",
          whiteSpace: "nowrap",
        }}
      >
        {formatDateShort(parseDateStr(pin.date))}
      </div>

      {/* Pin head — clickable to cycle color */}
      <div
        className="absolute group/pinhead"
        style={{ top: `${headTop}px`, left: "50%", transform: "translateX(-50%)" }}
      >
        <button
          className="w-3 rounded border border-black/50 shadow-[0_0_8px_rgba(0,0,0,0.6)] hover:scale-110 transition-transform"
          style={{ backgroundColor: colorHex, height: `${PIN_HEAD_H}px` }}
          onClick={(e) => { e.stopPropagation(); handleToggleColor(); }}
          title="Mudar cor"
        />
        {/* Remove whole pin button */}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute -top-4 -right-4 bg-destructive text-white p-0.5 rounded-full opacity-0 group-hover/pinhead:opacity-100 transition-opacity z-50"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Stick — draggable */}
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("pinId", pin.id);
          onDragStart();
        }}
        onDragEnd={(e) => { e.preventDefault(); onDragEnd(); }}
        className="absolute cursor-ew-resize -translate-x-1/2"
        style={{
          top: `${stickTop}px`,
          left: "50%",
          width: "2px",
          height: `${PIN_STICK_H}px`,
          background: colorHex,
          boxShadow: `0 0 5px ${colorHex}66`,
        }}
        title="Arraste para mover o pin"
      />

      {/* Labels below timeline line */}
      <div
        className="absolute flex flex-col items-stretch gap-1 z-30 w-full px-0.5"
        style={{
          top: `${labelsTop}px`,
          left: "0",
        }}
      >
        {pinLabels.map((lab, index) => {
          const isCustom = lab !== "" && !PIN_LABELS.includes(lab);
          const selectValue = isCustom ? "OUTROS" : lab || "ENTRADA";

          return (
            <div key={index} className="relative group/label w-full">
              {isCustom || lab === "OUTROS" ? (
                <div className="relative flex items-center w-full">
                  <Input
                    autoFocus
                    className="h-6 w-full text-[10px] px-1 py-0 text-center bg-[#11131a]/90 border-white/10 rounded shadow-md text-muted-foreground font-bold font-heading uppercase tracking-wider focus-visible:ring-1 focus-visible:ring-primary/50 focus:text-foreground transition-all"
                    value={lab === "OUTROS" ? "" : lab}
                    onChange={(e) => handleUpdateLabel(index, e.target.value)}
                    onBlur={() => { if (!lab || lab === "OUTROS") handleUpdateLabel(index, "ENTRADA"); }}
                    placeholder="Digite..."
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                  />
                  <button
                    onClick={() => handleUpdateLabel(index, "ENTRADA")}
                    className="absolute -right-5 text-muted-foreground hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="relative w-full group/labelitem">
                  <Select value={selectValue} onValueChange={(val) => handleUpdateLabel(index, val)}>
                    <SelectTrigger className="[&>svg]:hidden w-full h-auto min-h-[24px] py-1 px-1 text-[10px] bg-[#11131a]/90 shadow-md border border-white/10 rounded text-center focus:ring-0 whitespace-normal leading-tight font-bold font-heading hover:text-white text-muted-foreground flex justify-center uppercase tracking-wider transition-all">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] z-[99999]">
                      {PIN_LABELS.map((opt) => (
                        <SelectItem key={opt} value={opt} className="text-[10px] font-semibold">
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {pinLabels.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveLabel(index); }}
                      className="absolute -right-5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive opacity-0 group-hover/label:opacity-100 transition-opacity"
                      title="Remover atividade"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Add stacked label */}
        <div className="flex justify-center">
          <button
            onClick={(e) => { e.stopPropagation(); handleAddLabel(); }}
            className="bg-white/10 hover:bg-white/20 text-white rounded p-0.5 opacity-0 group-hover/pin:opacity-100 transition-opacity mt-0.5"
            title="Adicionar atividade"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
