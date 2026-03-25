/**
 * WeeklySchedule — Grid de agenda semanal
 * Linhas: membros da equipe + linhas especiais (freelancers, entradas/entregas)
 * Colunas: dias da semana (seg-sex) com navegação
 */
import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useProjectCards } from "@/contexts/ProjectCardsContext";
import { useNetwork, ROLE_COLORS, type MemberRole } from "@/contexts/NetworkContext";
import { useAuth } from "@/contexts/AuthContext";
import { pushEventToGoogleCalendar, deleteEventsFromGoogleCalendar } from "@/lib/googleCalendar";
import {
  useSchedule,
  ACTIVITY_TYPES,
  ENTRADAS_ACTIVITIES,
  type ActivityType,
  type ScheduleEntry,
} from "@/contexts/ScheduleContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  UserPlus,
  CalendarPlus,
  X,
  Search,
  Trash2,
  Calendar as CalendarIcon,
  ChevronUp,
  ChevronDown,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { isHolidayBR } from "@/lib/utils";

// ─── Date helpers ────────────────────────────────────────────────
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
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDayHeader(d: Date): { day: string; weekday: string } {
  const day = String(d.getDate()).padStart(2, "0");
  const weekdays = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  return { day, weekday: weekdays[d.getDay()] };
}

function formatWeekRange(monday: Date): string {
  const friday = addDays(monday, 4);
  const months = [
    "jan", "fev", "mar", "abr", "mai", "jun",
    "jul", "ago", "set", "out", "nov", "dez",
  ];
  const d1 = String(monday.getDate()).padStart(2, "0");
  const d2 = String(friday.getDate()).padStart(2, "0");
  const m = months[monday.getMonth()];
  const y = monday.getFullYear();
  return `${d1} – ${d2} ${m} ${y}`;
}

// ─── Activity Picker ─────────────────────────────────────────────
function ActivityPicker({
  onSelect,
  onClose,
  activities,
}: {
  onSelect: (activity: ActivityType) => void;
  onClose: () => void;
  activities?: ActivityType[];
}) {
  const items = activities || ACTIVITY_TYPES;
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold font-heading text-muted-foreground uppercase tracking-wider">
          Atividade
        </span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <ScrollArea className="max-h-[480px]">
        <div className="p-2 space-y-1 min-h-[300px]">
          {items.map((act) => (
            <button
              key={act.id}
              onClick={() => onSelect(act)}
              className="w-full text-left px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all hover:scale-[1.02] hover:shadow-md"
              style={{
                backgroundColor: act.color,
                color: act.textColor,
              }}
            >
              {act.label}
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Project Picker ──────────────────────────────────────────────
function ProjectPicker({
  onSelect,
  onBack,
  activityLabel,
}: {
  onSelect: (projectId: string, customLabel?: string) => void;
  onBack: () => void;
  activityLabel: string;
}) {
  const { state: cardsState } = useProjectCards();
  const [search, setSearch] = useState("");
  const [customMode, setCustomMode] = useState(false);
  const [customText, setCustomText] = useState("");
  const activeCards = cardsState.cards.filter((c) => c.active !== false);
  const filtered = search
    ? activeCards.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase())
    )
    : activeCards;

  if (customMode) {
    return (
      <div className="flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <button
            onClick={() => setCustomMode(false)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <ChevronLeft className="w-3 h-3" />
            Voltar
          </button>
          <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
            {activityLabel}
          </span>
        </div>
        <div className="p-3 space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase">Nome personalizado</p>
          <input
            type="text"
            placeholder="Digite o nome..."
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            autoFocus
            className="w-full bg-secondary/50 rounded px-2 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/50 border border-transparent focus:border-primary/30"
            onKeyDown={(e) => {
              if (e.key === "Enter" && customText.trim()) {
                onSelect("", customText.trim());
              }
            }}
          />
          <button
            disabled={!customText.trim()}
            onClick={() => onSelect("", customText.trim())}
            className="w-full text-center py-1.5 rounded text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            Confirmar
          </button>
        </div>
      </div>
    );
  }

  // Ordenar alfabeticamente
  const sortedProjects = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

  // Separar PUB INTERNO
  const pubInternoIndex = sortedProjects.findIndex(p => p.name.toUpperCase() === "PUB INTERNO");
  let pubInternoProject = null;
  if (pubInternoIndex !== -1) {
    pubInternoProject = sortedProjects.splice(pubInternoIndex, 1)[0];
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <button
          onClick={onBack}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <ChevronLeft className="w-3 h-3" />
          Voltar
        </button>
        <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
          {activityLabel}
        </span>
      </div>
      <div className="px-2 py-1.5 border-b border-border">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary/50">
          <Search className="w-3 h-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar projeto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-xs outline-none flex-1 text-foreground placeholder:text-muted-foreground"
            autoFocus
          />
        </div>
      </div>
      <ScrollArea className="max-h-[300px] overflow-y-auto">
        <div className="p-1.5 space-y-0.5">
          {/* Personalizado */}
          <button
            onClick={() => setCustomMode(true)}
            className="w-full text-left px-2.5 py-1.5 rounded-md text-xs font-semibold text-primary hover:bg-primary/10 transition-colors border border-primary/20"
          >
            ✏️ Personalizado
          </button>
          
          {/* PUB INTERNO fixado */}
          {pubInternoProject && (
            <button
              onClick={() => onSelect(pubInternoProject.id)}
              className="w-full text-left px-2.5 py-1.5 rounded-md text-xs font-semibold bg-accent/30 hover:bg-accent/50 transition-colors text-foreground border border-border/50"
            >
              🏢 PUB INTERNO
            </button>
          )}

          {sortedProjects.map((proj) => (
            <button
              key={proj.id}
              onClick={() => onSelect(proj.id)}
              className="w-full text-left px-2.5 py-1.5 rounded-md text-xs font-medium hover:bg-accent/50 transition-colors text-foreground"
            >
              {proj.name}
            </button>
          ))}
          {sortedProjects.length === 0 && !pubInternoProject && (
            <p className="text-xs text-muted-foreground px-2.5 py-2">
              Nenhum projeto encontrado
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function TaskBar({
  entry,
  act,
  proj,
  removeEntry,
  updateEntry,
}: {
  entry: ScheduleEntry;
  act: ActivityType;
  proj: any;
  removeEntry: (id: string) => void;
  updateEntry: (id: string, updates: Partial<ScheduleEntry>) => Promise<void> | void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const startDrag = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);

    const startX = e.clientX;
    const startDuration = entry.duration || 1;
    const parent = barRef.current?.closest('td');
    const colWidth = parent ? parent.getBoundingClientRect().width : 140;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      let newDuration = startDuration + (deltaX / colWidth);
      newDuration = Math.round(newDuration * 2) / 2; // snap to 0.5
      newDuration = Math.max(0.5, newDuration);
      setDragWidth(newDuration);
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      setIsDragging(false);

      const deltaX = upEvent.clientX - startX;
      let newDuration = startDuration + (deltaX / colWidth);
      newDuration = Math.round(newDuration * 2) / 2;
      newDuration = Math.max(0.5, newDuration);

      updateEntry(entry.id, { duration: newDuration });
      setDragWidth(null);
      setDragWidth(null);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.setData("application/json", JSON.stringify({
      entryId: entry.id,
      sourceMemberId: entry.memberId,
      sourceDate: entry.date,
      sourceSlot: entry.slotIndex || 0,
      sourceOffset: entry.startOffset || 0
    }));
    e.dataTransfer.effectAllowed = "all";

    // Create a drag image
    const dragIcon = document.createElement('div');
    dragIcon.style.width = '100px';
    dragIcon.style.height = '20px';
    dragIcon.style.backgroundColor = act.color;
    dragIcon.style.borderRadius = '4px';
    dragIcon.style.position = 'absolute';
    dragIcon.style.top = '-1000px';
    document.body.appendChild(dragIcon);
    e.dataTransfer.setDragImage(dragIcon, 50, 10);
    setTimeout(() => document.body.removeChild(dragIcon), 0);
  };

  const duration = dragWidth !== null ? dragWidth : (entry.duration || 1);
  const slotIndex = entry.slotIndex || 0;
  const startOffset = entry.startOffset || 0;
  const paddingCompensation = Math.max(0, Math.ceil(duration - 1)) * 1;

  return (
    <div
      ref={barRef}
      draggable
      onDragStart={handleDragStart}
      className={`absolute flex items-center rounded text-[10px] font-semibold leading-tight group/bar shadow-sm ${isDragging ? "z-50 ring-2 ring-primary" : "z-10"} 
        ${act.id === "entrega-pub" ? "border border-yellow-400/60 shadow-[0_0_8px_rgba(250,204,21,0.3)]" : ""} 
        cursor-grab active:cursor-grabbing hover:-translate-y-[1px] transition-transform`}
      style={{
        backgroundColor: act.color,
        color: act.textColor,
        top: `${slotIndex * 22 + 2}px`,
        left: startOffset === 0 ? '2px' : `calc(${startOffset * 100}% + 2px)`,
        width: `calc(${duration * 100}% - 4px + ${paddingCompensation}px)`,
        height: act.id === "entrega-pub" ? '18px' : '20px', // slightly smaller to account for border without growing row
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <div className="flex-1 truncate text-center px-1.5 pointer-events-none select-none relative">
        {entry.customLabel || (proj ? proj.name : act.label)}
      </div>

      <div className="absolute right-0 top-0 bottom-0 flex items-center opacity-0 group-hover/bar:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            removeEntry(entry.id);
          }}
          className="hover:bg-black/20 text-white rounded p-0.5 mr-1"
        >
          <X className="w-2.5 h-2.5" />
        </button>

        <div
          className="w-2.5 h-full cursor-col-resize flex items-center justify-center hover:bg-black/20 rounded-r border-l border-white/20"
          onMouseDown={startDrag}
        >
          <div className="w-[2px] h-2.5 bg-current opacity-50 rounded-full pointer-events-none" />
        </div>
      </div>
    </div>
  );
}

// ─── Cell content ────────────────────────────────────────────────
function isPastDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;
  return dateStr < todayStr;
}

function ScheduleCell({
  memberId,
  date,
  isEntradaEntrega = false,
}: {
  memberId: string;
  date: string;
  isEntradaEntrega?: boolean;
}) {
  const { state: scheduleState, getEntriesForCell, addEntry, removeEntry, updateEntry } = useSchedule();
  const { state: cardsState } = useProjectCards();
  const { state: networkState } = useNetwork();
  const { googleAccessToken, clearGoogleToken, loginWithGoogle, ensureGoogleToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"activity" | "project">("activity");
  const [selectedActivity, setSelectedActivity] = useState<ActivityType | null>(null);

  // ─── nanoid local (sem depender do contexto) ───────────────────
  const nanoidLocal = () => Math.random().toString(36).slice(2, 10);

  const entries = getEntriesForCell(memberId, date);

  const handleActivitySelect = (activity: ActivityType) => {
    setSelectedActivity(activity);
    setStep("project");
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = e.altKey ? "copy" : "move";
  };

  // ─── Google Calendar helpers ──────────────────────────────────────
  const getMemberEmail = (mId: string): string => {
    const member = networkState.members.find(m => m.id === mId);
    return member?.email || "";
  };

  const getProjectName = (projectId?: string, customLabel?: string): string => {
    if (customLabel) return customLabel.toUpperCase();
    if (!projectId) return "";
    const card = cardsState.cards.find(c => c.id === projectId);
    return card?.name?.toUpperCase() || "";
  };

  // Cria evento(s) no Google Calendar e retorna os IDs criados
  const pushToCalendar = async (
    entryDate: string,
    duration: number,
    startOffset: number,   // 0 = manhã (esquerda), 0.5 = tarde (direita)
    membId: string,
    projectId?: string,
    customLabel?: string
  ): Promise<string[]> => {
    if (isEntradaEntrega) return [];
    
    const validToken = await ensureGoogleToken();
    if (!validToken) {
      toast.error("Google Calendar não autorizado. Faça logout e login novamente.");
      return [];
    }

    const memberEmail = getMemberEmail(membId);
    const projectName = getProjectName(projectId, customLabel);
    if (!memberEmail) {
      toast.warning("Membro sem e-mail cadastrado. Sincronização ignorada.");
      return [];
    }
    if (!projectName) return [];
    
    try {
      const response = await pushEventToGoogleCalendar(
        { startDate: entryDate, duration, startOffset },
        projectName,
        memberEmail,
        validToken
      );
      if (response.error) {
        if (response.error.includes("401")) {
          clearGoogleToken();
          toast.error("Sua sessão do Google expirou. Clique no botão de status (bolinha) no topo para renovar.");
        } else {
          toast.error(`Erro Google: ${response.error}`);
        }
        return [];
      }
      return response.ids;
    } catch (err) {
      console.error("GCal push error:", err);
      toast.error("Erro técnico na sincronização com Google.");
      return [];
    }
  };

  // ─── Handlers com sincronização Calendar ─────────────────────────
  // 5. CRIAR
  const handleProjectSelect = async (projectId: string, customLabel?: string) => {
    if (!selectedActivity) return;
    if (isPastDate(date) && !window.confirm("Atenção: você está adicionando uma alocação em um dia que já passou. Deseja continuar?")) return;
    // Gera ID antecipadamente para poder salvar os IDs do GCal de volta
    const newId = nanoidLocal();
    // Deixa o slotIndex como undefined para o contexto calcular automaticamente o próximo livre
    addEntry(memberId, date, selectedActivity.id, projectId || undefined, customLabel, 0.5, undefined, 0, newId);

    // Push imediato ao Google Calendar (startOffset=0 → manhã)
    const googleIds = await pushToCalendar(date, 0.5, 0, memberId, projectId, customLabel);
    if (googleIds.length > 0) {
      updateEntry(newId, { googleEventIds: googleIds });
    }

    setOpen(false);
    setStep("activity");
    setSelectedActivity(null);
  };

  // 2. MOVER ou COPIAR (drag & drop)
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData("application/json");
      if (!dataStr) return;
      const data = JSON.parse(dataStr);

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const colWidth = rect.width;
      let targetOffset = x > colWidth * 0.5 ? 0.5 : 0;

      const y = e.clientY - rect.top;
      let targetSlot = Math.min(2, Math.max(0, Math.floor(y / 22)));

      const isCopy = e.altKey;
      const isDifferentPos = data.sourceMemberId !== memberId || data.sourceDate !== date ||
        data.sourceSlot !== targetSlot || data.sourceOffset !== targetOffset;

      if (!data.entryId || (!isDifferentPos && !isCopy)) return;

      const sourceEntry = scheduleState.entries.find(en => en.id === data.entryId);
      if (!sourceEntry) return;

      if ((isPastDate(data.sourceDate) || isPastDate(date)) && !window.confirm("Atenção: você está movendo/editando uma alocação de um dia que já passou. Deseja continuar?")) {
        return;
      }

      if (isCopy) {
        // Cópia: criar nova entry + novo evento no Calendar
        const newId = nanoidLocal();
        addEntry(memberId, date, sourceEntry.activityId, sourceEntry.projectId, sourceEntry.customLabel, sourceEntry.duration, targetSlot, targetOffset, newId);
        pushToCalendar(date, sourceEntry.duration || 0.5, targetOffset, memberId, sourceEntry.projectId, sourceEntry.customLabel)
          .then(googleIds => { if (googleIds.length > 0) updateEntry(newId, { googleEventIds: googleIds }); });
      } else {
        // Mover: deletar eventos antigos, criar novos
        if (sourceEntry.googleEventIds?.length) {
          const t = await ensureGoogleToken();
          if (t) deleteEventsFromGoogleCalendar(sourceEntry.googleEventIds, t).catch(console.error);
        }
        updateEntry(data.entryId, { memberId, date, slotIndex: targetSlot, startOffset: targetOffset, googleEventIds: [] });
        pushToCalendar(date, sourceEntry.duration || 0.5, targetOffset, memberId, sourceEntry.projectId, sourceEntry.customLabel)
          .then(googleIds => { if (googleIds.length > 0) updateEntry(data.entryId, { googleEventIds: googleIds }); });
      }
    } catch (err) {
      console.error("Failed to parse drop target", err);
    }
  };

  // 3. REDIMENSIONAR ou qualquer outra alteração vinda do TaskBar
  const handleUpdateEntry = async (entryId: string, updates: Partial<ScheduleEntry>) => {
    const entry = scheduleState.entries.find(e => e.id === entryId);
    if (!entry) { updateEntry(entryId, updates); return; }

    const newDate = updates.date ?? entry.date;
    if ((isPastDate(entry.date) || isPastDate(newDate)) && !window.confirm("Atenção: você está editando uma alocação de um dia que já passou. Deseja continuar?")) {
      return;
    }

    const durationChanged = updates.duration !== undefined && updates.duration !== entry.duration;
    const positionChanged = (updates.date !== undefined && updates.date !== entry.date) ||
      (updates.slotIndex !== undefined && updates.slotIndex !== entry.slotIndex) ||
      (updates.memberId !== undefined && updates.memberId !== entry.memberId);

    if (durationChanged || positionChanged) {
      // Deletar eventos Google antigos
      if (entry.googleEventIds?.length) {
        const t = await ensureGoogleToken();
        if (t) deleteEventsFromGoogleCalendar(entry.googleEventIds, t).catch(console.error);
      }
      // Atualizar localmente zerando os IDs
      updateEntry(entryId, { ...updates, googleEventIds: [] });
      // Criar novos eventos com os dados atualizados
      const newDate = updates.date ?? entry.date;
      const newDuration = updates.duration ?? entry.duration ?? 0.5;
      const newStartOffset = updates.startOffset ?? entry.startOffset ?? 0;
      const newMemberId = updates.memberId ?? entry.memberId;
      const googleIds = await pushToCalendar(newDate, newDuration, newStartOffset, newMemberId, entry.projectId, entry.customLabel);
      if (googleIds.length > 0) {
        updateEntry(entryId, { googleEventIds: googleIds });
      }
    } else {
      updateEntry(entryId, updates);
    }
  };

  // 4. DELETAR
  const handleRemoveEntry = async (entryId: string) => {
    const entry = scheduleState.entries.find(e => e.id === entryId);
    if (entry && isPastDate(entry.date)) {
      if (!window.confirm("Atenção: você está excluindo uma alocação de um dia que já passou. Deseja continuar?")) return;
    }
    
    // CHAMAR REMOVE IMEDIATAMENTE PARA UX RÁPIDA
    removeEntry(entryId);

    if (entry?.googleEventIds?.length) {
      const t = await ensureGoogleToken();
      if (t) {
        deleteEventsFromGoogleCalendar(entry.googleEventIds, t).catch(err => {
          console.error("GCal delete error:", err);
        });
      }
    }
  };

  const handleClose = () => {
    setOpen(false);
    setStep("activity");
    setSelectedActivity(null);
  };

  return (
    <Popover open={open} onOpenChange={(o) => {
      setOpen(o);
      if (!o) {
        setStep("activity");
        setSelectedActivity(null);
      }
    }}>
      <PopoverTrigger asChild>
        <div
          className="h-[68px] relative cursor-pointer hover:bg-black/5 rounded-sm"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {entries.map((entry) => {
            const allActs = isEntradaEntrega ? ENTRADAS_ACTIVITIES : ACTIVITY_TYPES;
            const act = allActs.find((a) => a.id === entry.activityId) || ACTIVITY_TYPES.find((a) => a.id === entry.activityId);
            const proj = entry.projectId
              ? cardsState.cards.find((c) => c.id === entry.projectId)
              : null;
            if (!act) return null;
            return (
              <TaskBar
                key={entry.id}
                entry={entry}
                act={act}
                proj={proj}
                removeEntry={handleRemoveEntry}
                updateEntry={handleUpdateEntry}
              />
            );
          })}
        </div>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        className="p-0 w-64 bg-popover text-popover-foreground rounded-lg shadow-xl border border-border overflow-hidden max-h-[85vh] flex flex-col"
        sideOffset={4}
      >
        {step === "activity" ? (
          <ActivityPicker
            onSelect={handleActivitySelect}
            onClose={handleClose}
            activities={isEntradaEntrega ? ENTRADAS_ACTIVITIES : undefined}
          />
        ) : (
          <ProjectPicker
            onSelect={handleProjectSelect}
            onBack={() => setStep("activity")}
            activityLabel={selectedActivity?.label || ""}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

// ─── Color Picker ────────────────────────────────────────────────
const PRESET_COLORS = [
  "#dc2626", "#16a34a", "#2563eb", "#7c3aed", "#f59e0b",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
];

// ─── Edit Member Popover ─────────────────────────────────────────
function EditMemberPopover({
  member,
  children,
}: {
  member: { id: string; name: string; color: string; type: string; email?: string };
  children: React.ReactNode;
}) {
  const { updateMember, removeMember } = useNetwork();
  const [name, setName] = useState(member.name);
  const [color, setColor] = useState(member.color);
  const [role, setRole] = useState<MemberRole>((member as any).role || "creative");
  const [email, setEmail] = useState(member.email || "");
  const [open, setOpen] = useState(false);

  if (member.type !== "member") return <>{children}</>;

  const handleSave = () => {
    if (name.trim()) {
      updateMember(member.id, { 
        name: name.trim(), 
        role,
        color, 
        email: email.trim() || undefined 
      });
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(o) => {
      setOpen(o);
      if (o) { 
        setName(member.name); 
        setColor(member.color); 
        setRole((member as any).role || "creative");
        setEmail(member.email || ""); 
      }
    }}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-52 p-3 space-y-3" side="right" align="start">
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase">Nome</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-7 text-xs"
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase">E-mail (opcional)</label>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-7 text-xs"
            placeholder="email@pub.com"
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase">Função</label>
          <Select value={role} onValueChange={(v) => {
            const r = v as MemberRole;
            setRole(r);
            setColor(ROLE_COLORS[r]);
          }}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="creative">Criativo</SelectItem>
              <SelectItem value="architect">Arquiteto</SelectItem>
              <SelectItem value="3d">3D</SelectItem>
              <SelectItem value="management">Gestão</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase">Cor</label>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  borderColor: color === c ? "white" : "transparent",
                  transform: color === c ? "scale(1.15)" : undefined,
                }}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleSave}>
            Salvar
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-7 w-7 p-0"
            onClick={() => { removeMember(member.id); setOpen(false); }}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Add Member Popover ──────────────────────────────────────────
function AddMemberPopover({ weekKey, weekRosterIds }: { weekKey: string; weekRosterIds: string[] }) {
  const { addMember, state: networkState } = useNetwork();
  const { setWeekRoster } = useSchedule();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("creative");
  const [color, setColor] = useState(ROLE_COLORS.creative);
  // Ref sinaliza que queremos adicionar o próximo novo membro à semana
  const pendingAdd = useRef(false);

  // Quando networkState.members mudar e tivermos um addMember pendente,
  // pega o membro mais novo e adiciona ao roster da semana
  useEffect(() => {
    if (!pendingAdd.current) return;
    pendingAdd.current = false;
    const newest = networkState.members[networkState.members.length - 1];
    if (newest && !weekRosterIds.includes(newest.id)) {
      setWeekRoster(weekKey, [...weekRosterIds, newest.id]);
    }
  }, [networkState.members]);

  const handleAdd = () => {
    if (!name.trim()) return;
    pendingAdd.current = true; // sinaliza antes de disparar o addMember
    addMember(name.trim(), role, color, email.trim() || undefined);
    setName("");
    setEmail("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(o) => {
      setOpen(o);
      if (o) { setName(""); setEmail(""); setRole("creative"); setColor(ROLE_COLORS.creative); }
    }}>
      <PopoverTrigger asChild>
        <button className="text-muted-foreground hover:text-foreground transition-colors" title="Criar novo membro (global)">
          <UserPlus className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-3 space-y-3" side="right" align="start">
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase">Nome</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-7 text-xs"
            placeholder="Nome do membro"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase">E-mail (opcional)</label>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-7 text-xs"
            placeholder="email@pub.com"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase">Função</label>
          <Select value={role} onValueChange={(v) => {
            const r = v as MemberRole;
            setRole(r);
            setColor(ROLE_COLORS[r]);
          }}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="creative">Criativo</SelectItem>
              <SelectItem value="architect">Arquiteto</SelectItem>
              <SelectItem value="3d">3D</SelectItem>
              <SelectItem value="management">Gestão</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase">Cor</label>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  borderColor: color === c ? "white" : "transparent",
                  transform: color === c ? "scale(1.15)" : undefined,
                }}
              />
            ))}
          </div>
        </div>
        <Button size="sm" className="w-full h-7 text-xs" onClick={handleAdd} disabled={!name.trim()}>
          Adicionar
        </Button>
      </PopoverContent>
    </Popover>
  );
}

// ─── Add Member To Week Popover ──────────────────────────────────
function AddMemberToWeekPopover({
  weekKey,
  currentRoster,
  allMembers,
}: {
  weekKey: string;
  currentRoster: string[];
  allMembers: { id: string; name: string; color: string }[];
}) {
  const { setWeekRoster } = useSchedule();
  const { removeMember } = useNetwork();
  const [open, setOpen] = useState(false);

  const missing = allMembers.filter((m) => !currentRoster.includes(m.id));

  const handleAdd = (memberId: string) => {
    setWeekRoster(weekKey, [...currentRoster, memberId]);
    setOpen(false);
  };

  if (missing.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="text-muted-foreground hover:text-foreground transition-colors" title="Adicionar membro nesta semana">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1.5 space-y-0.5" side="right" align="start">
        <p className="text-[10px] font-semibold uppercase text-muted-foreground px-2 py-1">
          Adicionar nesta semana
        </p>
        {missing.map((m) => (
          <div key={m.id} className="flex items-center group/member">
            <button
              onClick={() => handleAdd(m.id)}
              className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/50 text-xs transition-colors"
            >
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
              <span className="truncate">{m.name}</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Excluir permanentemente ${m.name}? Ele será removido de todos os projetos e da lista geral.`)) {
                  removeMember(m.id);
                }
              }}
              className="px-2 py-1.5 text-muted-foreground hover:text-destructive opacity-0 group-hover/member:opacity-100 transition-all"
              title="Excluir membro permanentemente"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export default function WeeklySchedule({ viewMode = "week" }: { viewMode?: "week" | "fortnight" | "month" }) {
  const { state: networkState } = useNetwork();
  const { state: scheduleState, getWeekRoster, setWeekRoster } = useSchedule();
  const { state: cardsState } = useProjectCards();
  const { googleAccessToken, loginWithGoogle } = useAuth();
  const [currentMonday, setCurrentMonday] = useState(() => getMonday(new Date()));

  useEffect(() => {
    if (viewMode === "month") {
      const today = new Date();
      setCurrentMonday(new Date(today.getFullYear(), today.getMonth(), 1));
    } else if (viewMode === "fortnight") {
      setCurrentMonday(getMonday(new Date()));
    } else {
      setCurrentMonday(getMonday(new Date()));
    }
  }, [viewMode]);

  const weekKey = useMemo(() => formatDate(currentMonday), [currentMonday]);

  // Active projects allocations summary
  const activeProjectSummaries = useMemo(() => {
    const summaries = new Map<string, number>();
    const activeCards = cardsState.cards.filter(c => c.active !== false && c.name?.trim().toUpperCase() !== "PUB INTERNO");
    const activeCardIds = new Set(activeCards.map(c => c.id));
    scheduleState.entries.forEach(entry => {
      // Don't count "Entradas e Entregas" row in the daily allocation summaries
      if (entry.projectId && entry.memberId !== "sr-entradas" && activeCardIds.has(entry.projectId)) {
        const dur = entry.duration || 1;
        summaries.set(entry.projectId, (summaries.get(entry.projectId) || 0) + dur);
      }
    });
    const result: string[] = [];
    summaries.forEach((dur, pId) => {
      const card = activeCards.find(c => c.id === pId);
      if (card) result.push(`${card.name}: ${dur}`);
    });
    return result.sort().join("   |   ");
  }, [scheduleState.entries, cardsState.cards]);

  const weekDays = useMemo(() => {
    if (viewMode === "month") {
      const y = currentMonday.getFullYear();
      const m = currentMonday.getMonth();
      const daysCount = new Date(y, m + 1, 0).getDate(); // days in month
      return Array.from({ length: daysCount }, (_, i) => addDays(currentMonday, i));
    }
    if (viewMode === "fortnight") {
      return Array.from({ length: 12 }, (_, i) => addDays(currentMonday, i));
    }
    return Array.from({ length: 5 }, (_, i) => addDays(currentMonday, i));
  }, [currentMonday, viewMode]);

  const goToPrevPeriod = () => setCurrentMonday((m) => addDays(m, -7));
  const goToNextPeriod = () => setCurrentMonday((m) => addDays(m, 7));
  const goToToday = () => setCurrentMonday(getMonday(new Date()));

  const today = formatDate(new Date());

  // Master member list (all members defined in NetworkContext)
  const allMemberIds = useMemo(() => networkState.members.map((m) => m.id), [networkState.members]);

  // Per-week effective roster (inherits from previous edited week)
  const weekRosterIds = useMemo(() => getWeekRoster(weekKey, allMemberIds), [weekKey, allMemberIds, getWeekRoster]);

  // Remove a member from this week's roster
  const handleRemoveMemberFromWeek = useCallback((memberId: string) => {
    setWeekRoster(weekKey, weekRosterIds.filter((id) => id !== memberId));
  }, [weekKey, weekRosterIds, setWeekRoster]);

  // Reorder members in this week's roster (and future weeks)
  const handleMoveMember = useCallback((memberId: string, direction: 'up' | 'down') => {
    const idx = weekRosterIds.indexOf(memberId);
    if (idx === -1) return;
    const newRoster = [...weekRosterIds];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= newRoster.length) return;
    
    [newRoster[idx], newRoster[targetIdx]] = [newRoster[targetIdx], newRoster[idx]];
    setWeekRoster(weekKey, newRoster);
  }, [weekKey, weekRosterIds, setWeekRoster]);

  // All rows: team members (from per-week roster) + special rows
  const rows = useMemo(() => {
    // Only members present in this week's roster, preserving roster order
    const memberRows = weekRosterIds
      .map((id) => networkState.members.find((m) => m.id === id))
      .filter(Boolean)
      .map((m) => ({ id: m!.id, name: m!.name, color: m!.color, role: m!.role, email: m!.email, type: "member" as const }));
    const specialRows = scheduleState.specialRows
      .filter((r) => r.type !== "freelancer")
      .map((r) => ({ id: r.id, name: r.name, color: "#6366f1", type: r.type as "entradas-entregas" }));
    return [...memberRows, ...specialRows];
  }, [weekRosterIds, networkState.members, scheduleState.specialRows]);

  return (
    <div className="border border-border rounded-lg bg-card/40 backdrop-blur-sm overflow-hidden">
      {/* Week navigation header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/60">
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Status de Sincronização Google */}
          <div className="flex items-center gap-2 pr-2 border-r border-border">
            <button
              onClick={() => loginWithGoogle()}
              className="flex items-center gap-2 group transition-colors"
              title={googleAccessToken ? "Sincronizado com Google" : "Acesso Google Expirado - Clique para renovar"}
            >
              <div className={`w-2.5 h-2.5 rounded-full shadow-sm animate-pulse ${googleAccessToken ? 'bg-green-500 shadow-green-500/50' : 'bg-red-500 shadow-red-500/50'}`} />
              <span className={`text-[10px] font-bold uppercase tracking-wider ${googleAccessToken ? 'text-green-500/80' : 'text-red-500'}`}>
                {googleAccessToken ? 'Google Sync' : 'Renovar Sync'}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" onClick={goToPrevPeriod}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={goToNextPeriod}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <span className="text-sm font-semibold font-heading ml-1">
              {viewMode === "month" || viewMode === "fortnight"
                ? `${String(weekDays[0].getDate()).padStart(2, '0')}/${String(weekDays[0].getMonth() + 1).padStart(2, '0')} - ${String(weekDays[weekDays.length - 1].getDate()).padStart(2, '0')}/${String(weekDays[weekDays.length - 1].getMonth() + 1).padStart(2, '0')}` 
                : formatWeekRange(currentMonday)}
            </span>
          </div>
        </div>

        {/* Project summaries inline */}
        <div className="flex-1 overflow-hidden px-6">
          <p className="text-[11px] font-medium text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis w-full">
            {activeProjectSummaries}
          </p>
        </div>

        <Button variant="outline" size="sm" className="text-xs flex-shrink-0" onClick={goToToday}>
          <CalendarIcon className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Grid */}
      <div className={`overflow-x-auto ${viewMode === "month" || viewMode === "fortnight" ? "" : ""}`}>
        <table className={`w-full border-collapse ${viewMode === "month" || viewMode === "fortnight" ? "min-w-0" : "min-w-[700px]"}`}>
          <thead>
            <tr>
              <th className="w-[120px] text-left px-3 py-2 text-[10px] border-b border-border bg-card/40 sticky left-0 z-10 w-fit">
                <div className="flex items-center gap-2">
                  <AddMemberPopover weekKey={weekKey} weekRosterIds={weekRosterIds} />
                  <AddMemberToWeekPopover weekKey={weekKey} currentRoster={weekRosterIds} allMembers={networkState.members} />
                </div>
              </th>
              {weekDays.map((day) => {
                const { day: dayNum, weekday } = formatDayHeader(day);
                const isToday = formatDate(day) === today;
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                const isHoliday = isHolidayBR(day);
                const isOffDay = isWeekend || isHoliday;
                return (
                  <th
                    key={formatDate(day)}
                    className={`text-center py-2 border-b border-l border-border 
                      ${viewMode === "month" ? "min-w-[40px] px-0.5" : viewMode === "fortnight" ? "min-w-[70px] px-1" : "min-w-[140px] px-2"} 
                      ${isToday ? "bg-primary/20" : isOffDay ? "bg-slate-400/20" : "bg-card/40"}`}
                  >
                    <div className="flex flex-col items-center select-none pointer-events-none -space-y-0.5">
                      <div className={`font-bold font-heading uppercase tracking-wider ${isToday ? "text-primary/80" : "text-muted-foreground/60"} ${viewMode === "month" ? "text-[8px]" : viewMode === "fortnight" ? "text-[9px]" : "text-[10px]"}`}>
                        {weekday}
                      </div>
                      <div className={`font-bold font-heading ${isToday ? "text-primary" : "text-foreground"} ${viewMode === "month" ? "text-[10px]" : viewMode === "fortnight" ? "text-[11px]" : "text-[13px]"}`}>
                        {dayNum}
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => {
              const isEntrada = row.type === "entradas-entregas";
              const isMember = row.type === "member";
              const canMoveUp = isMember && rowIdx > 0 && rows[rowIdx - 1]?.type === "member";
              const canMoveDown = isMember && rowIdx < rows.length - 1 && rows[rowIdx + 1]?.type === "member";

              return (
                <tr key={row.id} className={`group/row hover:bg-accent/10 transition-colors ${isEntrada ? "min-h-[64px]" : ""}`}>
                  <td className={`px-2 border-b border-border bg-card/30 sticky left-0 z-10 w-fit ${isEntrada ? "py-3" : "py-1.5"}`}>
                    <div className="flex items-center gap-1 group/rowlabel">
                      {/* Move Controls */}
                      <div className="flex flex-col -space-y-1 mr-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleMoveMember(row.id, 'up')}
                          disabled={!canMoveUp}
                          className={`hover:text-primary transition-colors disabled:opacity-0 ${!canMoveUp ? 'pointer-events-none' : ''}`}
                        >
                          <ChevronUp className="w-2.5 h-2.5" />
                        </button>
                        <button
                          onClick={() => handleMoveMember(row.id, 'down')}
                          disabled={!canMoveDown}
                          className={`hover:text-primary transition-colors disabled:opacity-0 ${!canMoveDown ? 'pointer-events-none' : ''}`}
                        >
                          <ChevronDown className="w-2.5 h-2.5" />
                        </button>
                      </div>

                      <EditMemberPopover member={row}>
                        <button className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer flex-1 text-left min-w-0">
                          <div
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: row.color }}
                          />
                          <span className={`text-[11px] font-semibold tracking-tight ${isEntrada ? "whitespace-normal max-w-[65px]" : "truncate max-w-[65px]"}`}>
                            {row.name}
                          </span>
                        </button>
                      </EditMemberPopover>
                      
                      {isMember && (
                        <button
                          onClick={() => handleRemoveMemberFromWeek(row.id)}
                          className="opacity-0 group-hover/rowlabel:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0 ml-auto"
                          title="Remover desta semana"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </td>
                  {weekDays.map((day, dayIdx) => {
                    const dateStr = formatDate(day);
                    const isToday = dateStr === today;
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    const isHoliday = isHolidayBR(day);
                    const isOffDay = isWeekend || isHoliday;
                    return (
                      <td
                        key={dateStr}
                        className={`border-b border-l border-border align-top relative ${isToday ? "bg-primary/5" : isOffDay ? "bg-slate-400/10" : ""
                          }`}
                        style={{ zIndex: 10 - dayIdx }}
                      >
                        <ScheduleCell memberId={row.id} date={dateStr} isEntradaEntrega={isEntrada} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
