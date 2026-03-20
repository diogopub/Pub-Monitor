/**
 * ProjectTimelines — Visualização empilhada das timelines dos projetos ativos
 * Replica o visual do DailyAllocationPanel (Crono) para todos os projetos ao mesmo tempo.
 */
import React, { useState, useMemo } from "react";
import { useProjectCards } from "@/contexts/ProjectCardsContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

// ─── Badge definitions ────────────────────────────────────────────
export interface BadgeDef {
  id: string;
  label: string;
  icon: React.ReactNode;
}

function IconRollerCoaster() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M2 17C2 17 4 10 9 10C12 10 13 13 16 13C19 13 22 10 22 10V14C22 14 19 17 16 17C13 17 12 14 9 14C6 14 4 17 4 17H2Z" />
      <path d="M2 20H22V22H2Z" />
    </svg>
  );
}
function IconMoneyWings() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <ellipse cx="12" cy="12" rx="4" ry="3" />
      <path d="M2 9C2 9 6 7 8 10C10 7 14 7 16 10C18 7 22 9 22 9L20 14C18 11 14 11 12 14C10 11 6 11 4 14L2 9Z" />
    </svg>
  );
}
function IconNoMoney() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
      <circle cx="12" cy="12" r="9" />
      <line x1="4.2" y1="4.2" x2="19.8" y2="19.8" />
      <path d="M12 8v2M12 14v2M10 10h3a1 1 0 010 2h-2a1 1 0 000 2h3" />
    </svg>
  );
}
function IconBlackHole() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <ellipse cx="12" cy="14" rx="8" ry="3" />
      <path d="M5 8C5 8 7 4 12 4C17 4 19 8 19 8" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" />
    </svg>
  );
}
function IconFire() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M12 2C12 2 8 7 8 11C8 13 9 14 10 14C9 12 11 10 12 8C13 11 11 14 11 16C11 18.2 13 20 13 20C13 20 16 17.5 16 14C16 10 14 7 12 2Z" />
      <path d="M10 20C10 20 8 19 8 16C8 14 10 13 11 15C11 17 10 20 10 20Z" />
    </svg>
  );
}
function IconXXL() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
      <rect x="2" y="5" width="20" height="14" rx="1" />
      <text x="12" y="16" textAnchor="middle" fontSize="9" fontWeight="bold" fill="currentColor" stroke="none" fontFamily="monospace">XXL</text>
    </svg>
  );
}
function IconPriority() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-full h-full">
      <circle cx="12" cy="12" r="9" strokeDasharray="3 2" />
      <text x="12" y="11" textAnchor="middle" fontSize="5.5" fontWeight="bold" fill="currentColor" stroke="none" fontFamily="monospace">PRIOR</text>
      <text x="12" y="16" textAnchor="middle" fontSize="5.5" fontWeight="bold" fill="currentColor" stroke="none" fontFamily="monospace">ITY</text>
    </svg>
  );
}
function IconWarning() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
function IconHelmet() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M12 2C7.58 2 4 5.58 4 10v2h16v-2C20 5.58 16.42 2 12 2z" />
      <rect x="3" y="12" width="18" height="3" rx="1" />
      <path d="M8 15v1a4 4 0 008 0v-1" />
    </svg>
  );
}
function IconIsland() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <ellipse cx="12" cy="18" rx="8" ry="2.5" />
      <path d="M13 18V10" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M13 10C13 10 10 8 9 5C11 5 14 8 14 8V10L16 6C16 6 18 9 15 11L13 10Z" />
    </svg>
  );
}
function IconEye() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
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
function BadgeSlot({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const badge = value ? BADGE_DEFS.find((b) => b.id === value) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`w-7 h-7 rounded flex items-center justify-center border transition-colors
            ${badge
              ? "border-white/30 text-white bg-white/10"
              : "border-dashed border-white/20 text-white/30 hover:border-white/50"
            }`}
          title={badge?.label || "Adicionar símbolo"}
        >
          {badge
            ? <span className="w-4 h-4 block">{badge.icon}</span>
            : <span className="text-[14px] leading-none font-light select-none">+</span>
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
        <div className="space-y-0.5">
          {BADGE_DEFS.map((b) => (
            <button
              key={b.id}
              onClick={() => { onChange(b.id); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-2 py-1.5 rounded hover:bg-accent/50 text-left transition-colors ${b.id === value ? "bg-accent/40" : ""}`}
            >
              <span className="w-4 h-4 shrink-0 block text-foreground">{b.icon}</span>
              <span className="text-[11px] font-semibold tracking-wide uppercase text-foreground">{b.label}</span>
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
const LABEL_W = 210;     // px for label column

// ─── Row — one project timeline row ──────────────────────────────
const TIMELINE_Y = 80; // px from row top to the horizontal line
const ROW_H = 160;     // total px height of each row (to fit labels below pins)

function TimelineRow({
  card,
  daysArray,
  updateCard,
}: {
  card: any;
  daysArray: Date[];
  updateCard: (id: string, updates: any) => void;
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
          <span className="text-[11px] font-bold font-heading uppercase tracking-wide text-white leading-tight block">
            {card.name}
          </span>
          <span className="text-[9px] text-white/40 uppercase tracking-widest font-semibold block">
            {card.client}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {[0, 1, 2].map((i) => (
            <BadgeSlot key={i} value={badges[i]} onChange={(val) => setBadge(i, val)} />
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
            const isToday = formatISO(d) === todayStr;
            return (
              <div
                key={d.toISOString()}
                className={`flex-1 border-l border-white/5 relative
                  ${isWknd ? "bg-white/[0.02]" : ""}
                  ${isToday ? "bg-primary/5" : ""}`}
              >
                {/* Day header */}
                <div className={`absolute top-2 w-full text-center text-[9px] font-mono select-none pointer-events-none leading-tight
                  ${isToday ? "text-primary font-bold" : "text-white/25"}`}>
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
          const color = pinColor(pin.color);

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
                className="absolute text-[9px] font-mono font-bold text-white/80 select-none text-center"
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
                className="absolute rounded-sm border border-black/40 shadow-lg"
                style={{
                  top: `${TIMELINE_Y - HEAD_H - STICK_H}px`,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 10,
                  height: HEAD_H,
                  backgroundColor: color,
                  boxShadow: `0 0 6px ${color}66`,
                }}
              />

              {/* Pin stick */}
              <div
                className="absolute"
                style={{
                  top: `${TIMELINE_Y - STICK_H}px`,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 2,
                  height: STICK_H,
                  background: color,
                  boxShadow: `0 0 4px ${color}66`,
                }}
              />

              {/* Labels below line */}
              <div
                className="absolute flex flex-col items-stretch gap-1 px-0.5 w-full"
                style={{ top: `${TIMELINE_Y + 6}px` }}
              >
                {labels.map((lab: string, i: number) => (
                  <div
                    key={i}
                    className="w-full text-center text-[8px] font-bold font-heading uppercase tracking-wide text-white/70 bg-[#11131a]/80 rounded px-0.5 py-0.5 border border-white/10 leading-tight whitespace-nowrap overflow-hidden text-ellipsis"
                  >
                    {lab}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────
export default function ProjectTimelines() {
  const { state, updateCard } = useProjectCards();

  const activeCards = state.cards.filter(
    (c) => c.active !== false && c.name?.trim().toUpperCase() !== "PUB INTERNO"
  );

  // Navigation: base date = leftmost day in window
  const [baseDate, setBaseDate] = useState(() => addDays(new Date(), -3));

  const daysArray = useMemo(() => {
    return Array.from({ length: DAYS_IN_VIEW }, (_, i) => addDays(baseDate, i));
  }, [baseDate]);

  const goToToday = () => setBaseDate(addDays(new Date(), -3));
  const todayStr = formatISO(new Date());

  if (activeCards.length === 0) return null;

  const DAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

  return (
    <section className="px-4 sm:px-6 pb-0 mt-6">
      <div
        className="rounded-lg overflow-hidden border border-white/10"
        style={{ background: "#11131a" }}
      >
        {/* Header with navigation */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/10 bg-black/30">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-primary/80" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
          <h2 className="text-sm font-bold font-heading tracking-wide text-white/90 flex-1">Timelines dos Projetos</h2>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setBaseDate((d) => addDays(d, -7))}
              className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
              title="Semana anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[11px] text-white/50 font-mono min-w-[110px] text-center select-none">
              {formatDateShort(daysArray[0])} – {formatDateShort(daysArray[daysArray.length - 1])}
            </span>
            <button
              onClick={() => setBaseDate((d) => addDays(d, 7))}
              className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
              title="Próxima semana"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={goToToday}
            className="text-[10px] bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-white transition-colors font-semibold uppercase tracking-wider"
          >
            Hoje
          </button>
        </div>

        {/* Column header row (shared day labels above all project rows) */}
        <div className="flex border-b border-white/10">
          {/* Label column spacer */}
          <div className="shrink-0 bg-[#11131a]/60 border-r border-white/10" style={{ width: `${LABEL_W}px` }} />
          {/* Day headers */}
          {daysArray.map((d) => {
            const dow = d.getDay();
            const isWknd = dow === 0 || dow === 6;
            const isToday = formatISO(d) === todayStr;
            return (
              <div
                key={d.toISOString()}
                className={`flex-1 text-center py-1.5 border-l border-white/5 text-[9px] font-mono select-none
                  ${isWknd ? "bg-white/[0.02]" : ""}
                  ${isToday ? "text-primary font-bold" : "text-white/30"}`}
              >
                <div className="uppercase">{DAYS[dow]}</div>
                <div>{d.getDate()}</div>
                {isToday && <div className="w-1 h-1 bg-primary rounded-full mx-auto mt-0.5" />}
              </div>
            );
          })}
          <div className="border-l border-white/5 w-0" />
        </div>

        {/* Project rows */}
        <div>
          {activeCards.map((card) => (
            <TimelineRow
              key={card.id}
              card={card}
              daysArray={daysArray}
              updateCard={updateCard}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
