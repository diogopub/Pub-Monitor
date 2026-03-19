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
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  return d.toISOString().split("T")[0];
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
    <div className="w-56">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold font-heading text-muted-foreground uppercase tracking-wider">
          Atividade
        </span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <ScrollArea className="max-h-[320px]">
        <div className="p-1.5 space-y-0.5">
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
      <div className="w-56">
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

  return (
    <div className="w-56">
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
      <ScrollArea className="max-h-[260px]">
        <div className="p-1.5 space-y-0.5">
          {/* Personalizado */}
          <button
            onClick={() => setCustomMode(true)}
            className="w-full text-left px-2.5 py-1.5 rounded-md text-xs font-semibold text-primary hover:bg-primary/10 transition-colors border border-primary/20"
          >
            ✏️ Personalizado
          </button>
          {/* Option without project */}
          <button
            onClick={() => onSelect("")}
            className="w-full text-left px-2.5 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-accent/50 transition-colors"
          >
            Sem projeto
          </button>
          {filtered.map((proj) => (
            <button
              key={proj.id}
              onClick={() => onSelect(proj.id)}
              className="w-full text-left px-2.5 py-1.5 rounded-md text-xs font-medium hover:bg-accent/50 transition-colors text-foreground"
            >
              {proj.name}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground px-2.5 py-2">
              Nenhum projeto encontrado
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Special activities for Entradas e Entregas row ──────────────
const ENTRADAS_ACTIVITIES: ActivityType[] = [
  { id: "briefing", label: "BRIEFING", color: "#1a237e", textColor: "#fff" },
  { id: "entrega-pub", label: "ENTREGA PUB", color: "#263238", textColor: "#fff" },
  { id: "apresentacao-cliente", label: "APRESENTAÇÃO CLIENTE", color: "#f9a825", textColor: "#000" },
];

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
      className={`absolute flex items-center rounded text-[10px] font-semibold leading-tight group/bar shadow-sm ${isDragging ? "z-50 ring-2 ring-primary" : "z-10"} cursor-grab active:cursor-grabbing hover:-translate-y-[1px] transition-transform`}
      style={{
        backgroundColor: act.color,
        color: act.textColor,
        top: `${slotIndex * 22 + 2}px`,
        left: startOffset === 0 ? '2px' : `calc(${startOffset * 100}% + 2px)`,
        width: `calc(${duration * 100}% - 4px + ${paddingCompensation}px)`,
        height: '20px',
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
  const { googleAccessToken } = useAuth();
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
    slotIdx: number,
    membId: string,
    projectId?: string,
    customLabel?: string
  ): Promise<string[]> => {
    if (isEntradaEntrega) return [];
    const memberEmail = getMemberEmail(membId);
    const projectName = getProjectName(projectId, customLabel);
    if (!googleAccessToken || !memberEmail || !projectName) return [];
    try {
      return await pushEventToGoogleCalendar(
        { startDate: entryDate, duration, slotIndex: slotIdx },
        projectName,
        memberEmail,
        googleAccessToken
      );
    } catch (err) {
      console.error("GCal push error:", err);
      return [];
    }
  };

  // ─── Handlers com sincronização Calendar ─────────────────────────
  // 1. CRIAR
  const handleProjectSelect = async (projectId: string, customLabel?: string) => {
    if (!selectedActivity) return;
    // Gera ID antecipadamente para poder salvar os IDs do GCal de volta
    const newId = nanoidLocal();
    const autoSlot = entries.length;
    addEntry(memberId, date, selectedActivity.id, projectId || undefined, customLabel, 0.5, autoSlot, 0, newId);

    // Push imediato ao Google Calendar
    const googleIds = await pushToCalendar(date, 0.5, autoSlot, memberId, projectId, customLabel);
    if (googleIds.length > 0) {
      updateEntry(newId, { googleEventIds: googleIds });
    }

    setOpen(false);
    setStep("activity");
    setSelectedActivity(null);
  };

  // 2. MOVER ou COPIAR (drag & drop)
  const handleDrop = (e: React.DragEvent) => {
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

      if (isCopy) {
        // Cópia: criar nova entry + novo evento no Calendar
        const newId = nanoidLocal();
        addEntry(memberId, date, sourceEntry.activityId, sourceEntry.projectId, sourceEntry.customLabel, sourceEntry.duration, targetSlot, targetOffset, newId);
        pushToCalendar(date, sourceEntry.duration || 1, targetSlot, memberId, sourceEntry.projectId, sourceEntry.customLabel)
          .then(googleIds => { if (googleIds.length > 0) updateEntry(newId, { googleEventIds: googleIds }); });
      } else {
        // Mover: deletar eventos antigos, criar novos
        if (sourceEntry.googleEventIds?.length && googleAccessToken) {
          deleteEventsFromGoogleCalendar(sourceEntry.googleEventIds, googleAccessToken).catch(console.error);
        }
        updateEntry(data.entryId, { memberId, date, slotIndex: targetSlot, startOffset: targetOffset, googleEventIds: [] });
        pushToCalendar(date, sourceEntry.duration || 1, targetSlot, memberId, sourceEntry.projectId, sourceEntry.customLabel)
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

    const durationChanged = updates.duration !== undefined && updates.duration !== entry.duration;
    const positionChanged = (updates.date !== undefined && updates.date !== entry.date) ||
      (updates.slotIndex !== undefined && updates.slotIndex !== entry.slotIndex) ||
      (updates.memberId !== undefined && updates.memberId !== entry.memberId);

    if (durationChanged || positionChanged) {
      // Deletar eventos Google antigos
      if (entry.googleEventIds?.length && googleAccessToken) {
        deleteEventsFromGoogleCalendar(entry.googleEventIds, googleAccessToken).catch(console.error);
      }
      // Atualizar localmente zerando os IDs
      updateEntry(entryId, { ...updates, googleEventIds: [] });
      // Criar novos eventos com os dados atualizados
      const newDate = updates.date ?? entry.date;
      const newDuration = updates.duration ?? entry.duration ?? 1;
      const newSlot = updates.slotIndex ?? entry.slotIndex ?? 0;
      const newMemberId = updates.memberId ?? entry.memberId;
      const googleIds = await pushToCalendar(newDate, newDuration, newSlot, newMemberId, entry.projectId, entry.customLabel);
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
    if (entry?.googleEventIds?.length && googleAccessToken) {
      deleteEventsFromGoogleCalendar(entry.googleEventIds, googleAccessToken).catch(console.error);
    }
    removeEntry(entryId);
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
        className="p-0 w-auto"
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
          <button
            key={m.id}
            onClick={() => handleAdd(m.id)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/50 text-xs"
          >
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
            {m.name}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export default function WeeklySchedule() {
  const { state: networkState } = useNetwork();
  const { state: scheduleState, getWeekRoster, setWeekRoster } = useSchedule();
  const { state: cardsState } = useProjectCards();
  const [currentMonday, setCurrentMonday] = useState(() => getMonday(new Date()));

  const weekKey = useMemo(() => formatDate(currentMonday), [currentMonday]);

  // Active projects allocations summary
  const activeProjectSummaries = useMemo(() => {
    const summaries = new Map<string, number>();
    const activeCards = cardsState.cards.filter(c => c.active !== false);
    const activeCardIds = new Set(activeCards.map(c => c.id));
    scheduleState.entries.forEach(entry => {
      if (entry.projectId && activeCardIds.has(entry.projectId)) {
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
    return Array.from({ length: 5 }, (_, i) => addDays(currentMonday, i));
  }, [currentMonday]);

  const goToPrevWeek = () => setCurrentMonday((m) => addDays(m, -7));
  const goToNextWeek = () => setCurrentMonday((m) => addDays(m, 7));
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
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="ghost" size="icon-sm" onClick={goToPrevWeek}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={goToNextWeek}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="text-sm font-semibold font-heading ml-1">
            {formatWeekRange(currentMonday)}
          </span>
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
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[700px]">
          <thead>
            <tr>
              <th className="w-[120px] text-left px-3 py-2 text-[10px] border-b border-border bg-card/40 sticky left-0 z-10">
                <AddMemberPopover weekKey={weekKey} weekRosterIds={weekRosterIds} />
              </th>
              {weekDays.map((day) => {
                const { day: dayNum, weekday } = formatDayHeader(day);
                const isToday = formatDate(day) === today;
                return (
                  <th
                    key={formatDate(day)}
                    className={`text-center px-2 py-2 border-b border-l border-border min-w-[140px] ${isToday ? "bg-primary/10" : "bg-card/40"
                      }`}
                  >
                    <div className="flex flex-col items-center select-none pointer-events-none -space-y-0.5">
                      <div className={`text-[10px] font-bold font-heading uppercase tracking-wider ${isToday ? "text-primary/80" : "text-muted-foreground/60"}`}>
                        {weekday}
                      </div>
                      <div className={`text-[13px] font-bold font-heading ${isToday ? "text-primary" : "text-foreground"}`}>
                        {dayNum}
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isEntrada = row.type === "entradas-entregas";
              return (
                <tr key={row.id} className={`group/row hover:bg-accent/10 transition-colors ${isEntrada ? "min-h-[64px]" : ""}`}>
                  <td className={`px-3 border-b border-border bg-card/30 sticky left-0 z-10 ${isEntrada ? "py-3" : "py-1.5"}`}>
                    <div className="flex items-center gap-1 group/rowlabel">
                      <EditMemberPopover member={row}>
                        <button className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer flex-1 text-left">
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: row.color }}
                          />
                          <span className={`text-xs font-medium ${isEntrada ? "whitespace-normal max-w-[70px]" : "truncate max-w-[70px]"}`}>
                            {row.name}
                          </span>
                        </button>
                      </EditMemberPopover>
                      {row.type === "member" && (
                        <button
                          onClick={() => handleRemoveMemberFromWeek(row.id)}
                          className="opacity-0 group-hover/rowlabel:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
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
                    return (
                      <td
                        key={dateStr}
                        className={`border-b border-l border-border align-top relative ${isToday ? "bg-primary/5" : ""
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
