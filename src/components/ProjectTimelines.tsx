/**
 * ProjectTimelines — Visualização empilhada das timelines dos projetos ativos
 */
import React, { useState } from "react";
import { useProjectCards } from "@/contexts/ProjectCardsContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X } from "lucide-react";

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
      <path d="M8 14C10 12 14 12 16 14" strokeWidth="1.5" stroke="currentColor" fill="none" />
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
      <ellipse cx="12" cy="14" rx="4" ry="1.5" fill="var(--background, #1a1a1a)" />
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
      <text x="12" y="15" textAnchor="middle" fontSize="6" fontWeight="bold" fill="currentColor" stroke="none" fontFamily="monospace">PRIOR</text>
      <text x="12" y="10" textAnchor="middle" fontSize="6" fontWeight="bold" fill="currentColor" stroke="none" fontFamily="monospace">ITY</text>
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
  { id: "emocao",       label: "JOB COM EMOÇÃO",              icon: <IconRollerCoaster /> },
  { id: "pub-sem-verb", label: "PUB SEM VERBA",               icon: <IconMoneyWings /> },
  { id: "job-sem-verb", label: "JOB SEM VERBA",               icon: <IconNoMoney /> },
  { id: "buraco-negro", label: "BURACO NEGRO",                icon: <IconBlackHole /> },
  { id: "queima-roupa", label: "QUEIMA ROUPA – POUCO PRAZO", icon: <IconFire /> },
  { id: "xxl",          label: "JOB GRANDE",                  icon: <IconXXL /> },
  { id: "estrategico-pub",    label: "JOB ESTRATÉGICO PARA PUB",    icon: <IconPriority /> },
  { id: "estrategico-cliente",label: "JOB ESTRATÉGICO PARA CLIENTE",icon: <IconWarning /> },
  { id: "montagem",     label: "MONTAGEM",                    icon: <IconHelmet /> },
  { id: "sussa",        label: "JOB SUSSA",                   icon: <IconIsland /> },
  { id: "visibilidade", label: "JOB COM MUITA VISIBILIDADE",  icon: <IconEye /> },
];

// ─── Badge Slot (clickable, shows picker) ───────────────────────
function BadgeSlot({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const badge = value ? BADGE_DEFS.find((b) => b.id === value) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`w-8 h-8 rounded flex items-center justify-center border transition-colors
            ${badge
              ? "border-foreground/30 text-foreground bg-card"
              : "border-dashed border-muted-foreground/30 text-muted-foreground/40 hover:border-muted-foreground/60"
            }`}
          title={badge?.label || "Adicionar símbolo"}
        >
          {badge ? (
            <span className="w-5 h-5 block">{badge.icon}</span>
          ) : (
            <span className="text-[16px] leading-none font-light select-none">+</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" side="right" align="start">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Símbolo
          </span>
          {badge && (
            <button
              onClick={() => { onChange(null); setOpen(false); }}
              className="text-muted-foreground hover:text-destructive"
              title="Remover"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="space-y-0.5">
          {BADGE_DEFS.map((b) => (
            <button
              key={b.id}
              onClick={() => { onChange(b.id); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-2 py-1.5 rounded hover:bg-accent/50 text-left transition-colors
                ${b.id === value ? "bg-accent/40 font-bold" : ""}`}
            >
              <span className="w-5 h-5 shrink-0 block text-foreground">{b.icon}</span>
              <span className="text-[11px] font-medium tracking-wide uppercase text-foreground">
                {b.label}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Date helpers ─────────────────────────────────────────────────
function parseDate(s: string): Date {
  return new Date(s + "T12:00:00");
}

function datePct(date: Date, start: Date, end: Date): number {
  const total = end.getTime() - start.getTime();
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, ((date.getTime() - start.getTime()) / total) * 100));
}

// ─── Main component ───────────────────────────────────────────────
export default function ProjectTimelines() {
  const { state, updateCard } = useProjectCards();

  const activeCards = state.cards.filter(
    (c) => c.active !== false && c.name?.trim().toUpperCase() !== "PUB INTERNO"
  );

  if (activeCards.length === 0) return null;

  // Compute global date window (all active project dates)
  const allDates = activeCards
    .flatMap((c) => [c.entryDate, c.deliveryDate])
    .filter(Boolean)
    .map((d) => parseDate(d));

  const today = new Date();
  const windowStart = allDates.length
    ? new Date(Math.min(...allDates.map((d) => d.getTime())))
    : today;
  const windowEnd = allDates.length
    ? new Date(Math.max(...allDates.map((d) => d.getTime())))
    : today;

  // Expand window a bit for padding
  const padMs = (windowEnd.getTime() - windowStart.getTime()) * 0.04 + 1000 * 60 * 60 * 24 * 2;
  const rangeStart = new Date(windowStart.getTime() - padMs);
  const rangeEnd = new Date(windowEnd.getTime() + padMs);

  const todayPct = datePct(today, rangeStart, rangeEnd);

  return (
    <section className="px-4 sm:px-6 pb-0">
      <div className="border border-border rounded-lg bg-card/40 backdrop-blur-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-card/60">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-primary" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12" />
            <circle cx="7" cy="12" r="2" fill="currentColor" />
            <circle cx="17" cy="12" r="2" fill="currentColor" />
          </svg>
          <h2 className="text-sm font-bold font-heading tracking-wide">Timelines dos Projetos</h2>
        </div>

        <div className="overflow-x-auto">
          {/* Date ruler */}
          <div className="flex min-w-[700px]">
            {/* Label column spacer */}
            <div className="w-[200px] shrink-0 border-r border-border" />
            {/* Ruler */}
            <div className="flex-1 relative h-6 border-b border-border bg-card/30">
              {/* Today line label */}
              <div
                className="absolute top-0 h-full border-l border-primary/60 flex items-center"
                style={{ left: `${todayPct}%` }}
              >
                <span className="absolute -top-0 left-1 text-[9px] text-primary font-bold uppercase">Hoje</span>
              </div>
              {/* Month labels */}
              {(() => {
                const labels: React.JSX.Element[] = [];
                const cur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
                const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
                while (cur <= rangeEnd) {
                  const pct = datePct(cur, rangeStart, rangeEnd);
                  labels.push(
                    <span
                      key={cur.toISOString()}
                      className="absolute text-[9px] text-muted-foreground/60 font-mono top-1"
                      style={{ left: `${pct}%` }}
                    >
                      {MONTHS[cur.getMonth()]}
                    </span>
                  );
                  cur.setMonth(cur.getMonth() + 1);
                }
                return labels;
              })()}
            </div>
          </div>

          {/* Rows */}
          {activeCards.map((card) => {
            const badges: (string | null)[] = [
              (card as any).badges?.[0] ?? null,
              (card as any).badges?.[1] ?? null,
              (card as any).badges?.[2] ?? null,
            ];

            const setBadge = (slotIdx: number, val: string | null) => {
              const next = [...badges];
              next[slotIdx] = val;
              updateCard(card.id, { badges: next.filter(Boolean) } as any);
            };

            const hasDates = card.entryDate && card.deliveryDate;
            const entryPct = hasDates ? datePct(parseDate(card.entryDate), rangeStart, rangeEnd) : 0;
            const deliveryPct = hasDates ? datePct(parseDate(card.deliveryDate), rangeStart, rangeEnd) : 0;

            return (
              <div
                key={card.id}
                className="flex group/row hover:bg-accent/5 transition-colors border-b border-border last:border-b-0 min-w-[700px]"
              >
                {/* Label column */}
                <div className="w-[200px] shrink-0 border-r border-border px-3 py-2 flex flex-col justify-center gap-1">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold font-heading uppercase tracking-wide leading-tight">
                      {card.name}
                    </span>
                    <span className="text-[9px] text-muted-foreground uppercase font-semibold tracking-widest leading-tight">
                      {card.client}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {[0, 1, 2].map((i) => (
                      <BadgeSlot
                        key={i}
                        value={badges[i]}
                        onChange={(val) => setBadge(i, val)}
                      />
                    ))}
                  </div>
                </div>

                {/* Timeline track */}
                <div className="flex-1 relative h-[52px]">
                  {/* Today line */}
                  <div
                    className="absolute top-0 bottom-0 w-px bg-primary/40 z-10"
                    style={{ left: `${todayPct}%` }}
                  />

                  {/* Project bar */}
                  {hasDates && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 h-3 rounded-full opacity-80"
                      style={{
                        left: `${entryPct}%`,
                        width: `${Math.max(0.5, deliveryPct - entryPct)}%`,
                        backgroundColor: `hsl(var(--primary))`,
                      }}
                    />
                  )}

                  {/* Timeline Pins */}
                  {(card.timelinePins || []).map((pin) => {
                    if (!pin.date) return null;
                    const pct = datePct(parseDate(pin.date), rangeStart, rangeEnd);
                    return (
                      <div
                        key={pin.id}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group/pin z-20"
                        style={{ left: `${pct}%` }}
                        title={pin.labels?.join(" · ")}
                      >
                        <div
                          className="w-2.5 h-2.5 rounded-full border-2 border-background shadow-sm cursor-pointer transition-transform group-hover/pin:scale-125"
                          style={{
                            backgroundColor:
                              pin.color === "red" ? "#ef4444"
                              : pin.color === "yellow" ? "#eab308"
                              : "#ffffff",
                          }}
                        />
                        {/* Tooltip */}
                        {pin.labels?.length > 0 && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/pin:block z-30">
                            <div className="bg-popover border border-border rounded px-2 py-1 shadow-lg whitespace-nowrap">
                              {pin.labels.map((l, i) => (
                                <p key={i} className="text-[9px] font-medium text-foreground">{l}</p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* No dates message */}
                  {!hasDates && (
                    <span className="absolute inset-0 flex items-center px-3 text-[10px] text-muted-foreground/40 italic">
                      Datas não definidas
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
