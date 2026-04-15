/**
 * ProjectTimelines — Visualização empilhada das timelines dos projetos ativos
 * Replica o visual do DailyAllocationPanel (Crono) para todos os projetos ao mesmo tempo.
 */
import React, { useState, useMemo } from "react";
import { useProjectCards } from "@/contexts/ProjectCardsContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { isHolidayBR } from "@/lib/utils";
import { usePermissions } from "@/contexts/PermissionsContext";

// ─── Badge definitions ────────────────────────────────────────────
export interface BadgeDef {
  id: string;
  label: string;
  icon: React.ReactNode;
}

function IconRollerCoaster() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M22 18H2" />
      <path d="M2 18C2 12 6 6 10 6s4 12 8 12 4-6 4-6" />
      <rect x="8" y="4" width="2" height="2" rx="0.5" fill="currentColor" />
      <rect x="15" y="10" width="2" height="2" rx="0.5" fill="currentColor" />
      <line x1="6" y1="18" x2="6" y2="12" />
      <line x1="14" y1="18" x2="14" y2="15" />
      <line x1="18" y1="18" x2="18" y2="12" />
    </svg>
  );
}

function IconMoneyWings() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <rect x="6" y="9" width="12" height="7" rx="1" fill="currentColor" fillOpacity="0.2" />
      <circle cx="12" cy="12.5" r="2" fill="currentColor" />
      <path d="M6 11c-2-1-4 0-4 3 0 0 1 1 4-1M18 11c2-1 4 0 4 3 0 0-1 1-4-1" />
    </svg>
  );
}

function IconNoMoney() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <circle cx="12" cy="12" r="9" />
      <line x1="4" y1="4" x2="20" y2="20" strokeWidth="2" stroke="currentColor" opacity="0.8" />
      <path d="M9 10c1-1 2-1 3-1s2 0 3 1M9 14c1 1 2 1 3 1s2 0 3-1M12 8v8" />
    </svg>
  );
}

function IconBlackHole() {
  // O "Buraco Negro" é a silhueta da pessoa de chapéu wide-brim
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full scale-[1.2]">
      <path d="M12 11c-1.5 0-2.5 1-2.5 2s1 1.5 2.5 1.5 2.5-.5 2.5-1.5-1-2-2.5-2z" />
      <path d="M20 14c0 1.5-3.5 3-8 3s-8-1.5-8-3 3.5-3 8-3 8 1.5 8 3z" />
    </svg>
  );
}

function IconFire() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M12 2c0 0-4 4.5-4 9a4 4 0 008 0c0-4.5-4-9-4-9zm-1 12.5c-.5-.5-1-1.5-1-2.5 0-1.5 1-2.5 1-2.5s1 1 1 2.5c0 1-.5 2-1 2.5z" />
    </svg>
  );
}

function IconXXL() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-full h-full">
      <rect x="2" y="6" width="20" height="12" rx="1.5" />
      <text x="12" y="15.5" textAnchor="middle" fontSize="8" fontWeight="900" fill="currentColor" stroke="none" fontFamily="sans-serif" letterSpacing="-0.5">XXL</text>
    </svg>
  );
}

function IconPriority() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="7" strokeOpacity="0.5" />
      <rect x="4" y="9.5" width="16" height="5" fill="black" stroke="none" />
      <text x="12" y="13" textAnchor="middle" fontSize="3.5" fontWeight="900" fill="white" stroke="none" fontFamily="sans-serif">PRIORITY</text>
    </svg>
  );
}

function IconWarning() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M12 4L3 19h18L12 4zm.8 12.5h-1.6v-1.6h1.6v1.6zm0-3h-1.6V9h1.6v4.5z" />
    </svg>
  );
}

function IconHelmet() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M12 4c-4 0-7 3-7 7v1h14v-1c0-4-3-7-7-7z" />
      <rect x="4.5" y="11.5" width="15" height="1.5" rx="0.5" />
      <path d="M9 13v1a3 3 0 006 0v-1" />
      <circle cx="12" cy="7" r="1.5" stroke="var(--background)" strokeWidth="0.5" />
    </svg>
  );
}

function IconIsland() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M4 19c0-2 4-3.5 8-3.5s8 1.5 8 3.5-4 1.5-8 1.5-8-.5-8-1.5z" opacity="0.4" />
      <path d="M12 16.5c-1-3-1-5-1-5s-3 0-5-2c0 0 3 0 5 2l1-4h.5l1 4c2-2 5-2 5-2-2 2-5 2-5 2s0 2-1 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.2" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

export const BADGE_DEFS: BadgeDef[] = [
  { id: "emocao",              label: "JOB COM EMOÇÃO",              icon: <IconRollerCoaster /> },
  { id: "pub-sem-verb",        label: "PUB SEM VERBA",               icon: <IconMoneyWings /> },
  { id: "job-sem-verb",        label: "JOB SEM VERBA",               icon: <IconNoMoney /> },
  { id: "buraco-negro",        label: "BURACO NEGRO",                icon: <IconBlackHole /> },
  { id: "queima-roupa",        label: "QUEIMA ROUPA – POUCO PRAZO",  icon: <IconFire /> },
  { id: "xxl",                 label: "JOB GRANDE",                  icon: <IconXXL /> },
  { id: "estrategico-pub",     label: "JOB ESTRATÉGICO PARA PUB",    icon: <IconPriority /> },
  { id: "estrategico-cliente", label: "JOB ESTRATÉGICO PARA CLIENTE",icon: <IconWarning /> },
  { id: "montagem",            label: "MONTAGEM",                    icon: <IconHelmet /> },
  { id: "sussa",               label: "JOB SUSSA",                   icon: <IconIsland /> },
  { id: "visibilidade",        label: "JOB COM MUITA VISIBILIDADE",  icon: <IconEye /> },
];

// ─── Badge Slot ───────────────────────────────────────────────────
function BadgeSlot({ 
  value, 
  onChange, 
  readOnly 
}: { 
  value: string | null; 
  onChange: (id: string | null) => void;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const badge = value ? BADGE_DEFS.find((b) => b.id === value) : null;

  if (readOnly) {
    return (
      <div
        className={`w-[44px] h-[44px] rounded flex items-center justify-center border transition-all duration-200
          ${badge
            ? "border-white/40 text-white bg-white/10"
            : "border-dashed border-white/20 text-white/30"
          }`}
        title={badge?.label || "Sem símbolo"}
      >
        {badge && <span className="w-8 h-8 block">{badge.icon}</span>}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`w-[44px] h-[44px] rounded flex items-center justify-center border transition-all duration-200
            ${badge
              ? "border-white/40 text-white bg-white/10 hover:bg-white/15 shadow-sm"
              : "border-dashed border-white/20 text-white/30 hover:border-white/50 hover:bg-white/5"
            }`}
          title={badge?.label || "Adicionar símbolo"}
        >
          {badge
            ? <span className="w-8 h-8 block">{badge.icon}</span>
            : <span className="text-[20px] leading-none font-light select-none">+</span>
          }
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" side="right" align="start">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Símbolo</span>
          {badge && (
            <button onClick={() => { onChange(null); setOpen(false); }} className="text-muted-foreground hover:text-destructive">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="space-y-1">
          {BADGE_DEFS.map((b) => (
            <button
              key={b.id}
              onClick={() => { onChange(b.id); setOpen(false); }}
              className={`w-full flex items-center gap-4 px-3 py-2.5 rounded hover:bg-accent/50 text-left transition-colors ${b.id === value ? "bg-accent/40" : ""}`}
            >
              <span className="w-8 h-8 shrink-0 block text-foreground">{b.icon}</span>
              <span className="text-[12px] font-bold tracking-wide uppercase text-foreground">{b.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Date helpers ─────────────────────────────────────────────────
function parseDateStr(str: string): Date {
  if (!str) return new Date();
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function formatISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function formatDateShort(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const DAYS_IN_VIEW = 14; // show 2 weeks at a time
const LABEL_W = 220;     // px for label column (resized to minimize extra space)

// ─── Row — one project timeline row ──────────────────────────────
const TIMELINE_Y = 80; // px from row top to the horizontal line
const ROW_H = 160;     // total px height of each row (to fit labels below pins)

export function TimelineRow({
  card,
  daysArray,
  updateCard,
  readOnly,
}: {
  card: any;
  daysArray: Date[];
  updateCard: (id: string, updates: any) => void;
  readOnly?: boolean;
}) {
  const badges: (string | null)[] = [
    card.badges?.[0] ?? null,
    card.badges?.[1] ?? null,
    card.badges?.[2] ?? null,
  ];

  const setBadge = (slotIdx: number, val: string | null) => {
    const next = [...badges];
    next[slotIdx] = val;
    updateCard(card.id, { badges: next.filter(Boolean) });
  };

  const todayStr = formatISO(new Date());
  const DAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

  // Pin color
  const pinColor = (c: string) =>
    c === "red" ? "#ef4444" : c === "yellow" ? "#facc15" : "#ffffff";

  return (
    <div className="flex border-b border-white/5 last:border-b-0" style={{ height: `${ROW_H}px` }}>
      {/* Label column */}
      <div
        className="shrink-0 border-r border-white/10 flex flex-col justify-center px-3 gap-1 bg-[#11131a]/60"
        style={{ width: `${LABEL_W}px` }}
      >
        <div>
          <span className="text-[13px] font-bold font-heading uppercase tracking-wide text-white leading-tight block">
            {card.name}
          </span>
          <span className="text-[11px] text-white/40 uppercase tracking-widest font-semibold block">
            {card.client}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {[0, 1, 2].map((i) => (
            <BadgeSlot key={i} value={badges[i]} onChange={(val) => setBadge(i, val)} readOnly={readOnly} />
          ))}
        </div>
      </div>

      {/* Timeline track */}
      <div className="flex-1 relative overflow-hidden" style={{ height: `${ROW_H}px` }}>
        {/* Day column backgrounds & labels */}
        <div className="absolute inset-0 flex">
          {daysArray.map((d) => {
            const dow = d.getDay();
            const isWknd = dow === 0 || dow === 6;
            const isHoliday = isHolidayBR(d);
            const isOffDay = isWknd || isHoliday;
            const isToday = formatISO(d) === todayStr;
            return (
              <div
                key={d.toISOString()}
                className={`flex-1 border-l border-white/5 relative
                  ${isOffDay ? "bg-white/[0.02]" : ""}
                  ${isToday ? "bg-primary/5" : ""}`}
                data-sticky-anchor="timeline"
                data-date={formatISO(d)}
                data-ref={card.id}
              >
                {/* Day header */}
                <div className={`absolute top-2 w-full text-center text-[9px] font-mono select-none pointer-events-none leading-tight
                  ${isToday ? "text-primary font-bold" : "text-white"}`}>
                  <div>{DAYS[dow]}</div>
                  <div>{d.getDate()}</div>
                  {isToday && <div className="w-1 h-1 bg-primary rounded-full mx-auto mt-0.5" />}
                </div>
              </div>
            );
          })}
          <div className="border-l border-white/5" />
        </div>

        {/* Horizontal timeline line */}
        <div
          className="absolute left-0 right-0 h-[2px] bg-white/60 pointer-events-none"
          style={{ top: `${TIMELINE_Y}px` }}
        />

        {/* Pins */}
        {(card.timelinePins || []).map((pin: any) => {
          const dayIdx = daysArray.findIndex((d) => formatISO(d) === pin.date);
          if (dayIdx < 0) return null;
          const leftPct = (dayIdx / DAYS_IN_VIEW) * 100;
          const colPct = 100 / DAYS_IN_VIEW;
          const labels: string[] = Array.isArray(pin.labels) && pin.labels.length > 0
            ? pin.labels
            : ["ENTRADA"];

          // If all labels are completed, override color to green
          const allCompleted =
            labels.length > 0 &&
            labels.every((_, idx) => pin.completedLabels?.[idx] === true);
          const effectiveColor = allCompleted ? "#22c55e" : pinColor(pin.color);

          const completedByNames = labels
            .map((_, i) => pin.completedBy?.[i])
            .filter(Boolean) as string[];
          const uniqueNames = Array.from(new Set(completedByNames));
          const pinTooltip = allCompleted && uniqueNames.length > 0
            ? `Feito por ${uniqueNames.join(", ")}`
            : undefined;

          const HEAD_H = 16;
          const STICK_H = 12;

          return (
            <div
              key={pin.id}
              className="absolute h-full pointer-events-none"
              style={{ left: `${leftPct}%`, width: `${colPct}%` }}
            >
              {/* Date label */}
              <div
                className="absolute text-[9px] font-mono font-bold text-white/80 select-none text-center pointer-events-auto"
                style={{
                  top: `${TIMELINE_Y - HEAD_H - STICK_H - 14}px`,
                  left: "50%",
                  transform: "translateX(-50%)",
                  whiteSpace: "nowrap",
                  background: "#11131a",
                  padding: "0 2px",
                  borderRadius: 2,
                }}
              >
                {formatDateShort(parseDateStr(pin.date))}
              </div>

              {/* Pin head */}
              <div
                className="absolute rounded-sm border border-black/40 shadow-lg transition-colors duration-500 pointer-events-auto"
                style={{
                  top: `${TIMELINE_Y - HEAD_H - STICK_H}px`,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 10,
                  height: HEAD_H,
                  backgroundColor: effectiveColor,
                  boxShadow: `0 0 6px ${effectiveColor}88`,
                }}
                title={pinTooltip}
                data-sticky-anchor="timeline-pin"
                data-ref={pin.id}
              />

              {/* Pin stick */}
              <div
                className="absolute transition-colors duration-500"
                style={{
                  top: `${TIMELINE_Y - STICK_H}px`,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 2,
                  height: STICK_H,
                  background: effectiveColor,
                  boxShadow: `0 0 4px ${effectiveColor}88`,
                }}
              />

              {/* Labels below line */}
              <div
                className="absolute flex flex-col items-stretch gap-1 px-0.5 w-full pointer-events-auto"
                style={{ top: `${TIMELINE_Y + 6}px` }}
              >
                {labels.map((lab: string, i: number) => {
                  const isLabelDone = pin.completedLabels?.[i] === true;
                  const checkedBy: string | null = pin.completedBy?.[i] ?? null;
                  return (
                    <div
                      key={i}
                      className={`w-full text-center text-[8px] font-bold font-heading uppercase tracking-wide rounded px-0.5 py-0.5 border leading-tight whitespace-nowrap overflow-hidden text-ellipsis transition-colors duration-300 ${
                        isLabelDone
                          ? "text-emerald-300 bg-emerald-900/40 border-emerald-500/30"
                          : "text-white/70 bg-[#11131a]/80 border-white/10"
                      }`}
                      title={isLabelDone && checkedBy ? `Feito por ${checkedBy}` : lab}
                    >
                      {lab}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────
// ─── Main component ───────────────────────────────────────────────
export default function ProjectTimelines() {
  const { state, updateCard } = useProjectCards();
  const { currentUserRole } = usePermissions();
  const readOnly = currentUserRole === "viewer";

  const activeCards = state.cards
    .filter(
      (c) => 
        c.active !== false && 
        c.name?.trim().toUpperCase() !== "PUB INTERNO" &&
        c.showInTimeline !== false
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  // Navigation: base date = leftmost day in window
  const [baseDate, setBaseDate] = useState(() => addDays(new Date(), -3));

  const daysArray = useMemo(() => {
    return Array.from({ length: DAYS_IN_VIEW }, (_, i) => addDays(baseDate, i));
  }, [baseDate]);

  const goToToday = () => setBaseDate(addDays(new Date(), -3));

  // ─── Drag Logic ────────────────────────────────────────────────
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag if clicking the timeline area, not a button/popover
    if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest(".popover-content")) return;
    
    setIsDragging(true);
    setStartX(e.pageX);
    document.body.style.cursor = "grabbing";
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const x = e.pageX;
    const walk = startX - x;
    
    // Sensitivity: how many pixels mouse moves to shift one day
    const threshold = 60; 
    
    if (Math.abs(walk) > threshold) {
      const daysToShift = Math.floor(walk / threshold);
      if (daysToShift !== 0) {
        setBaseDate(prev => addDays(prev, daysToShift));
        setStartX(x); // Reset start point to last handle
      }
    }
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
    document.body.style.cursor = "default";
  };

  if (activeCards.length === 0) return null;

  return (
    <section className="px-4 sm:px-6 pb-12 mt-8">
      <div
        className="rounded-lg overflow-hidden border border-white/10 select-none cursor-grab active:cursor-grabbing"
        style={{ background: "#11131a" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
      >
        {/* Header with navigation */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/10 bg-black/40">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-primary/80" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
          <h2 className="text-[12px] font-bold font-heading tracking-wide text-white/90 flex-1 uppercase">Timelines dos Projetos</h2>

          {/* Navigation */}
          <div className="flex items-center gap-1 bg-black/20 rounded-md p-0.5 border border-white/5">
            <button
              onClick={(e) => { e.stopPropagation(); setBaseDate((d) => addDays(d, -7)); }}
              className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
              title="Semana anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[10px] text-white/60 font-mono min-w-[110px] text-center font-bold">
              {formatDateShort(daysArray[0])} – {formatDateShort(daysArray[daysArray.length - 1])}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); setBaseDate((d) => addDays(d, 7)); }}
              className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
              title="Próxima semana"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); goToToday(); }}
            className="text-[10px] bg-primary/20 hover:bg-primary/30 border border-primary/20 px-3 py-1 rounded text-primary transition-colors font-bold uppercase tracking-wider"
          >
            Hoje
          </button>
        </div>

        {/* Project rows */}
        <div className="divide-y divide-white/5">
          {activeCards.map((card) => (
            <TimelineRow
              key={card.id}
              card={card}
              daysArray={daysArray}
              updateCard={updateCard}
              readOnly={readOnly}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
