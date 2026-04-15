import React, { useState, useMemo } from "react";
import { useProjectCards } from "@/contexts/ProjectCardsContext";
import { TimelineRow } from "@/components/ProjectTimelines";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Date helpers duplicate to avoid modifying other files
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function formatDateShort(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const DAYS_IN_VIEW = 14;

export default function ProjectTimelineEmbed({ params }: { params: { projectId: string } }) {
  const { state } = useProjectCards();
  const { projectId } = params;

  const card = state.cards.find(c => c.id === projectId);

  // Navigation state exactly like ProjectTimelines
  const [baseDate, setBaseDate] = useState(() => addDays(new Date(), -3));

  const daysArray = useMemo(() => {
    return Array.from({ length: DAYS_IN_VIEW }, (_, i) => addDays(baseDate, i));
  }, [baseDate]);

  const goToToday = () => setBaseDate(addDays(new Date(), -3));

  // No-op for updateCard since it's readOnly
  const handleUpdateCard = () => {};

  if (!card) {
    return (
      <div className="w-screen h-screen bg-[#11131a] flex items-center justify-center text-white/50 text-sm font-mono">
        Projeto não encontrado
      </div>
    );
  }

  // Same drag logic as ProjectTimelines
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest(".popover-content")) return;
    setIsDragging(true);
    setStartX(e.pageX);
    document.body.style.cursor = "grabbing";
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const x = e.pageX;
    const walk = startX - x;
    const threshold = 60; 
    if (Math.abs(walk) > threshold) {
      const daysToShift = Math.floor(walk / threshold);
      if (daysToShift !== 0) {
        setBaseDate(prev => addDays(prev, daysToShift));
        setStartX(x);
      }
    }
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
    document.body.style.cursor = "default";
  };

  return (
    <div 
      className="w-full h-full min-h-screen bg-[#11131a] overflow-hidden select-none cursor-grab active:cursor-grabbing"
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
        <h2 className="text-[12px] font-bold font-heading tracking-wide text-white/90 flex-1 uppercase">
          Timeline do Projeto
        </h2>

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

      {/* Single Project Row */}
      <TimelineRow
        card={card}
        daysArray={daysArray}
        updateCard={handleUpdateCard}
        readOnly={true}
      />
    </div>
  );
}
