/**
 * ProjectCard — Card individual de projeto
 * Feed, prazo, equipe, documentos com toggle
 */
import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useSchedule } from "@/contexts/ScheduleContext";
import {
  useProjectCards,
  type ProjectCardData,
  type ProjectStatus,
} from "@/contexts/ProjectCardsContext";
import { useNetwork } from "@/contexts/NetworkContext";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, entryToSlots } from "@/lib/utils";
import { usePermissions } from "@/contexts/PermissionsContext";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import DailyAllocationPanel from "@/components/DailyAllocationPanel";
import {
  Rss,
  GripVertical,
  Plus,
  Pencil,
  Trash2,
  X,
  ChevronUp,
  ChevronDown,
  CalendarDays,
} from "lucide-react";
import { nanoid } from "nanoid";

// ─── Helpers ─────────────────────────────────────────────────────
function calcProgress(entry: string, delivery: string): number {
  if (!entry || !delivery) return 0;
  const start = new Date(entry).getTime();
  const end = new Date(delivery).getTime();
  const now = Date.now();
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.round(((now - start) / (end - start)) * 100);
}

function calcDaysFromNow(dateStr: string): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function formatDateBR(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

// ─── Progress Bar Color ──────────────────────────────────────────
function getProgressColor(pct: number): string {
  if (pct >= 90) return "#ef4444";
  if (pct >= 70) return "#f59e0b";
  if (pct >= 40) return "#eab308";
  return "#22c55e";
}

// ─── Project Status ───────────────────────────────────────────────
const STATUS_CONFIG: Record<ProjectStatus | string, { label: string; color: string }> = {
  // Ativos
  "onboarding": { label: "ONBOARDING", color: "#eab308" },
  "wip": { label: "WORK IN PROGRESS", color: "#22c55e" },
  
  // Inativos
  "inativo": { label: "INATIVO", color: "#ef4444" },
  "declinado": { label: "DECLINADO", color: "#ef4444" },
  "proposta-recusada": { label: "PROPOSTA NÃO APROVADA", color: "#ef4444" },

  // Legados
  "em-desenvolvimento": { label: "WORK IN PROGRESS", color: "#22c55e" },
  "standby": { label: "INATIVO", color: "#ef4444" },
  "aguardando-retorno": { label: "WORK IN PROGRESS", color: "#22c55e" },
};

// ─── Team Role Badge ─────────────────────────────────────────────
const ROLE_STYLES: Record<string, { bg: string; label: string; networkRole: string }> = {
  criacao: { bg: "#dc2626", label: "CRIAÇÃO", networkRole: "creative" },
  arq: { bg: "#16a34a", label: "ARQ", networkRole: "architect" },
  "3d": { bg: "#2563eb", label: "3D", networkRole: "3d" },
};

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function TeamRow({
  member,
  cardId,
}: {
  member: { id: string; role: "criacao" | "arq" | "3d"; name: string };
  cardId: string;
}) {
  const { state } = useNetwork();
  const { updateTeamMember, removeTeamMember } = useProjectCards();
  const { getWeekRoster } = useSchedule();
  const style = ROLE_STYLES[member.role];

  // Identificar se o nome atual é "Personalizado" (não está na lista oficial de members)
  const isActuallyInList = state.members.some(m => m.name === member.name);
  const [isCustom, setIsCustom] = useState(member.name !== "" && !isActuallyInList);

  const membersForRole = useMemo(() => {
    const monday = getMonday(new Date());
    const weekKey = monday.toISOString().split("T")[0];
    const allIds = state.members.map(m => m.id);
    const rosterIds = getWeekRoster(weekKey, allIds);
    
    return state.members
      .filter(m => rosterIds.includes(m.id));
  }, [state.members, getWeekRoster]);

  return (
    <div className="flex items-center gap-2 group/team">
      <span
        className="text-[10px] font-bold px-2 py-1 rounded min-w-[60px] text-center text-white shrink-0"
        style={{ backgroundColor: style.bg }}
      >
        {style.label}
      </span>

      {isCustom ? (
        <div className="relative flex-1">
          <Input
            value={member.name}
            onChange={(e) => updateTeamMember(cardId, member.id, e.target.value)}
            className="h-7 text-[10px] md:text-[10px] font-bold font-heading uppercase tracking-wider bg-secondary/30 border-border px-2"
            autoFocus
          />
          <button 
            onClick={() => {
              setIsCustom(false);
              updateTeamMember(cardId, member.id, "");
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <Select
          value={member.name || "__empty__"}
          onValueChange={(v) => {
            if (v === "__custom__") {
              setIsCustom(true);
              updateTeamMember(cardId, member.id, "");
            } else {
              updateTeamMember(cardId, member.id, v === "__empty__" ? "" : v);
            }
          }}
        >
          <SelectTrigger className="h-7 text-[10px] md:text-[10px] font-bold font-heading uppercase tracking-wider flex-1 bg-secondary/30 border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__empty__">
              <span className="italic opacity-60">Personalizado</span>
            </SelectItem>
            <SelectItem value="__custom__">
              <span className="font-bold text-primary">✏️ Escrever nome...</span>
            </SelectItem>
            {membersForRole.map((m) => (
              <SelectItem key={m.id} value={m.name}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <button
        onClick={() => removeTeamMember(cardId, member.id)}
        className="opacity-0 group-hover/team:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

function AddTeamMemberForm({ cardId }: { cardId: string }) {
  const { state } = useNetwork();
  const { addTeamMember } = useProjectCards();
  const { getWeekRoster } = useSchedule();
  const [role, setRole] = useState<"criacao" | "arq" | "3d">("criacao");
  const [name, setName] = useState("");

  const membersForRole = useMemo(() => {
    const monday = getMonday(new Date());
    const weekKey = monday.toISOString().split("T")[0];
    const allIds = state.members.map(m => m.id);
    const rosterIds = getWeekRoster(weekKey, allIds);
    
    return state.members
      .filter(m => rosterIds.includes(m.id));
  }, [state.members, getWeekRoster]);

  const handleAdd = () => {
    addTeamMember(cardId, role, name === "__empty__" ? "" : name);
    setName("");
  };

  return (
    <div className="space-y-2">
      <Select value={role} onValueChange={(v) => { setRole(v as typeof role); setName(""); }}>
        <SelectTrigger className="h-7 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="criacao">CRIAÇÃO</SelectItem>
          <SelectItem value="arq">ARQ</SelectItem>
          <SelectItem value="3d">3D</SelectItem>
        </SelectContent>
      </Select>
      <Select value={name || "__empty__"} onValueChange={setName}>
        <SelectTrigger className="h-7 text-xs">
          <SelectValue placeholder="Escolher..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__empty__">
            <span className="italic opacity-60">Personalizado</span>
          </SelectItem>
          {membersForRole.map((m) => (
            <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" className="w-full h-7 text-xs" onClick={handleAdd}>
        Adicionar
      </Button>
    </div>
  );
}


export default function ProjectCard({ card }: { card: ProjectCardData }) {
  const { updateCard, removeCard, removeFeedEntry } =
    useProjectCards();
  const { state: scheduleState, addEntry, updateEntry, removeEntry } = useSchedule();
  const [feedIndex, setFeedIndex] = useState(0);
  const [editingDates, setEditingDates] = useState<false | "entry" | "delivery" | "presentation">(false);
  const [entryDate, setEntryDate] = useState(card.entryDate);
  const [deliveryDate, setDeliveryDate] = useState(card.deliveryDate);
  const [presentationDate, setPresentationDate] = useState(card.presentationDate || "");
  const [estimatedDailies, setEstimatedDailies] = useState(card.estimatedDailies || 0);
  const [showDiarias, setShowDiarias] = useState(false);
  const { currentUserRole } = usePermissions();
  const { state: networkState } = useNetwork();
  const readOnly = currentUserRole === "viewer";

  const progress = calcProgress(card.entryDate, card.deliveryDate);
  const daysToEntry = calcDaysFromNow(card.entryDate);
  const daysToDelivery = calcDaysFromNow(card.deliveryDate);
  const daysToPresentation = calcDaysFromNow(card.presentationDate || "");

  const utilDailies = useMemo(() => {
    const projectMemberDaySlots = new Map<string, number>();
    
    // Logic same as WeeklySchedule.tsx
    scheduleState.entries.forEach(entry => {
      if (entry.projectId !== card.id) return;
      
      const member = networkState.members.find(m => m.id === entry.memberId);
      const role = member?.role;
      const isCountable = role === "creative" || role === "architect" || role === "3d";

      if (isCountable) {
        const { durationSlots } = entryToSlots(entry);
        const key = `${entry.memberId}_${entry.date}`;
        projectMemberDaySlots.set(key, (projectMemberDaySlots.get(key) || 0) + durationSlots);
      }
    });

    let total = 0;
    projectMemberDaySlots.forEach((slots) => {
      total += slots <= 4 ? 0.5 : 1.0;
    });
    return total;
  }, [scheduleState.entries, card.id, networkState.members]);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(card.name);

  useEffect(() => {
    if (!isEditingName) setEditedName(card.name);
  }, [card.name, isEditingName]);

  useEffect(() => {
    if (editingDates === false) {
      setEntryDate(card.entryDate || "");
      setDeliveryDate(card.deliveryDate || "");
      setPresentationDate(card.presentationDate || "");
    }
  }, [card.entryDate, card.deliveryDate, card.presentationDate, editingDates]);

  useEffect(() => {
    setEstimatedDailies(card.estimatedDailies || 0);
  }, [card.estimatedDailies]);

  const handleSaveDates = (newEntryDate?: string, newDeliveryDate?: string, newPresentationDate?: string) => {
    const finalEntryDate = newEntryDate !== undefined ? newEntryDate : entryDate;
    const finalDeliveryDate = newDeliveryDate !== undefined ? newDeliveryDate : deliveryDate;
    const finalPresentationDate = newPresentationDate !== undefined ? newPresentationDate : presentationDate;

    let updatedPins = [...(card.timelinePins || [])];
    
    const deliveryPinIndex = updatedPins.findIndex((p) => p.labels.includes("ENTREGA"));
    if (finalDeliveryDate) {
      if (deliveryPinIndex !== -1) {
        updatedPins[deliveryPinIndex] = { ...updatedPins[deliveryPinIndex], date: finalDeliveryDate, color: "red" };
      } else {
        updatedPins.push({ id: nanoid(8), date: finalDeliveryDate, color: "red", labels: ["ENTREGA"] });
      }
    } else if (deliveryPinIndex !== -1) {
      updatedPins.splice(deliveryPinIndex, 1);
    }

    const presentationPinIndex = updatedPins.findIndex((p) => p.labels.includes("APRESENTAÇÃO CLIENTE"));
    if (finalPresentationDate) {
      if (presentationPinIndex !== -1) {
        updatedPins[presentationPinIndex] = { ...updatedPins[presentationPinIndex], date: finalPresentationDate, color: "yellow" };
      } else {
        updatedPins.push({ id: nanoid(8), date: finalPresentationDate, color: "yellow", labels: ["APRESENTAÇÃO CLIENTE"] });
      }
    } else if (presentationPinIndex !== -1) {
      updatedPins.splice(presentationPinIndex, 1);
    }

    const existingDeliveryEntry = (scheduleState.entries || []).find(
      (e) => e.memberId === "sr-entradas" && e.projectId === card.id && e.activityId === "entrega-pub"
    );
    if (finalDeliveryDate) {
      if (existingDeliveryEntry) {
        updateEntry(existingDeliveryEntry.id, { date: finalDeliveryDate });
      } else {
        addEntry({ id: nanoid(8), memberId: "sr-entradas", date: finalDeliveryDate, activityId: "entrega-pub", projectId: card.id, duration: 8, startSlot: 0 });
      }
    } else if (existingDeliveryEntry) {
      removeEntry(existingDeliveryEntry.id);
    }

    const existingPresentationEntry = (scheduleState.entries || []).find(
      (e) => e.memberId === "sr-entradas" && e.projectId === card.id && e.activityId === "apresentacao-cliente"
    );
    if (finalPresentationDate) {
      if (existingPresentationEntry) {
        updateEntry(existingPresentationEntry.id, { date: finalPresentationDate });
      } else {
        addEntry({ id: nanoid(8), memberId: "sr-entradas", date: finalPresentationDate, activityId: "apresentacao-cliente", projectId: card.id, duration: 8, startSlot: 0 });
      }
    } else if (existingPresentationEntry) {
      removeEntry(existingPresentationEntry.id);
    }

    updateCard(card.id, { 
      entryDate: finalEntryDate, 
      deliveryDate: finalDeliveryDate, 
      presentationDate: finalPresentationDate,
      timelinePins: updatedPins, 
      showInTimeline: card.showInTimeline !== false 
    });
    setEditingDates(false);
  };

  const handleSaveName = () => {
    if (editedName.trim() && editedName !== card.name) {
      updateCard(card.id, { name: editedName.trim() });
    }
    setIsEditingName(false);
  };

  const allFeed = card.feed;
  const currentFeedIndex = Math.min(feedIndex, Math.max(0, allFeed.length - 1));

  const isMissingDates = !card.entryDate || !card.deliveryDate;
  const borderColorClass = isMissingDates ? "border-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.3)]" : "border-border";

  return (
    <div className={`border ${borderColorClass} rounded-xl bg-card/60 backdrop-blur-sm overflow-hidden flex flex-col w-full max-w-[280px] transition-colors duration-300`}>
      {/* STATUS */}
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[10px] font-bold font-heading uppercase tracking-wider text-muted-foreground">
            STATUS
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (readOnly) return;
              let current: string = card.projectStatus || "wip";
              // Tratar legados para não bugar o toggle
              if (current === "em-desenvolvimento" || current === "aguardando-retorno") current = "wip";
              if (current === "standby") current = "inativo";

              const isActive = card.active !== false;
              let nextStatus: ProjectStatus = "wip";

              if (isActive) {
                if (current === "wip") nextStatus = "onboarding";
                else nextStatus = "wip";
              } else {
                if (current === "inativo") nextStatus = "declinado";
                else if (current === "declinado") nextStatus = "proposta-recusada";
                else nextStatus = "inativo";
              }
              
              updateCard(card.id, { projectStatus: nextStatus });
            }}
            className={cn(
              "w-3 h-3 rounded-full shrink-0 transition-all shadow-md ring-2 ring-offset-2 ring-offset-card",
              !readOnly && "hover:scale-125 cursor-pointer"
            )}
            style={{
              backgroundColor: STATUS_CONFIG[card.projectStatus || "wip"]?.color || "#22c55e",
              boxShadow: `0 0 0 2px ${STATUS_CONFIG[card.projectStatus || "wip"]?.color || "#22c55e"}55`,
            }}
            title={readOnly ? undefined : "Clique para mudar o status"}
          />
          <span className="text-[10px] font-bold tracking-wide" style={{ color: STATUS_CONFIG[card.projectStatus || "wip"]?.color || "#22c55e" }}>
            {STATUS_CONFIG[card.projectStatus || "wip"]?.label || "WORK IN PROGRESS"}
          </span>
        </div>
      </div>

      {/* Project name + active toggle + client */}
      <div className="px-3 py-2 border-b border-border bg-primary/5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1 group/name">
              {isEditingName ? (
                <Input
                  className="h-6 text-xs font-bold py-0 bg-background/50 border-primary/50 uppercase"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value.toUpperCase())}
                  onBlur={handleSaveName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName();
                    if (e.key === "Escape") { setEditedName(card.name); setIsEditingName(false); }
                  }}
                  autoFocus
                />
              ) : (
                <>
                  <h3 className="text-xs font-bold font-heading uppercase tracking-wide text-foreground">
                    {card.name}
                  </h3>
                  {!readOnly && (
                    <button 
                      onClick={() => setIsEditingName(true)}
                      className="opacity-0 group-hover/name:opacity-100 transition-opacity p-0.5 hover:bg-accent/50 rounded"
                    >
                      <Pencil className="w-2.5 h-2.5 text-muted-foreground" />
                    </button>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Switch
                checked={card.active !== false}
                onCheckedChange={(checked) => {
                  const newStatus = checked ? "wip" : "inativo";
                  updateCard(card.id, { active: checked, projectStatus: newStatus as ProjectStatus });
                }}
                disabled={readOnly}
                className={`scale-75 origin-left ${
                  card.active !== false
                    ? "data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                    : ""
                } data-[state=unchecked]:bg-red-500 data-[state=unchecked]:border-red-500`}
              />
              <span className="text-[9px] text-muted-foreground">
                {card.active !== false ? "Ativo" : "Inativo"}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[9px] text-muted-foreground">{card.client}</span>
            {!readOnly && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className="p-0.5 hover:bg-accent/50 rounded">
                    <Trash2 className="w-3 h-3 text-destructive/60 hover:text-destructive" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-3" side="top">
                  <p className="text-xs mb-2">Remover este projeto?</p>
                  <Button size="sm" variant="destructive" className="w-full text-xs" onClick={() => removeCard(card.id)}>
                    Remover
                  </Button>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      </div>

      {/* Datas e Diárias */}
      <div className="px-3 py-2 border-b border-border text-[10px] font-bold">
        <div className="space-y-1.5">
          {/* Row 1: ENTRADA & DIÁRIAS PREV */}
          <div className="grid grid-cols-[1.1fr_0.9fr] gap-x-1">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground w-12 shrink-0 whitespace-nowrap text-[8px]">ENTRADA</span>
              {editingDates === "entry" ? (
                <Input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  onBlur={() => handleSaveDates()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveDates();
                    if (e.key === "Escape") setEditingDates(false);
                  }}
                  className="h-5 text-[10px] md:text-[10px] w-24 px-1"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => !readOnly && setEditingDates("entry")}
                  className={`px-1.5 py-0.5 rounded font-mono transition-colors min-w-[70px] text-left ${readOnly ? "" : "cursor-pointer"} ${card.entryDate ? 'bg-secondary/30 text-foreground' : 'bg-blue-500/10 text-blue-500/80'}`}
                >
                  {formatDateBR(card.entryDate) || "---"}
                </button>
              )}
            </div>
            <div className="flex items-center justify-between gap-1">
              <span className="text-muted-foreground whitespace-nowrap text-[8px] flex-1">DIÁRIAS PREV.</span>
              <Input
                type="text"
                inputMode="numeric"
                value={estimatedDailies === 0 ? "" : estimatedDailies}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, "");
                  setEstimatedDailies(val === "" ? 0 : parseInt(val));
                }}
                onBlur={() => updateCard(card.id, { estimatedDailies })}
                className="h-5 text-[10px] md:text-[10px] font-bold w-10 shrink-0 p-0 text-center bg-white/[0.05] border-none font-mono text-foreground focus-visible:ring-0 rounded drop-shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                disabled={readOnly}
              />
            </div>
          </div>

          {/* Row 2: ENTREGA & DIÁRIAS UTIL */}
          <div className="grid grid-cols-[1.1fr_0.9fr] gap-x-1">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground w-12 shrink-0 whitespace-nowrap text-[8px]">ENTREGA</span>
              {editingDates === "delivery" ? (
                <Input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  onBlur={() => handleSaveDates()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveDates();
                    if (e.key === "Escape") setEditingDates(false);
                  }}
                  className="h-5 text-[10px] md:text-[10px] w-24 px-1"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => !readOnly && setEditingDates("delivery")}
                  className={`px-1.5 py-0.5 rounded font-mono transition-colors min-w-[70px] text-left ${readOnly ? "" : "cursor-pointer"} ${card.deliveryDate ? 'bg-secondary/30 text-foreground' : 'bg-red-500/10 text-red-500/80'}`}
                >
                  {formatDateBR(card.deliveryDate) || "---"}
                </button>
              )}
            </div>
            <div className="flex items-center justify-between gap-1">
              <span className="text-muted-foreground whitespace-nowrap text-[8px] flex-1">DIÁRIAS UTIL.</span>
              <span className="w-10 h-5 shrink-0 flex items-center justify-center font-mono font-bold text-[10px] md:text-[10px] text-foreground bg-white/[0.05] rounded border-none drop-shadow-sm">
                {(utilDailies % 1 === 0) ? utilDailies : utilDailies.toFixed(1)}
              </span>
            </div>
          </div>

          {/* Row 3: APRESEN & ASSETS */}
          <div className="grid grid-cols-[1.1fr_0.9fr] gap-x-1">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground w-12 shrink-0 whitespace-nowrap text-[8px]">APRESEN</span>
              {editingDates === "presentation" ? (
                <Input
                  type="date"
                  value={presentationDate}
                  onChange={(e) => setPresentationDate(e.target.value)}
                  onBlur={() => handleSaveDates()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveDates();
                    if (e.key === "Escape") setEditingDates(false);
                  }}
                  className="h-5 text-[10px] md:text-[10px] w-24 px-1"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => !readOnly && setEditingDates("presentation")}
                  className={`px-1.5 py-0.5 rounded font-mono transition-colors min-w-[70px] text-left ${readOnly ? "" : "cursor-pointer"} ${card.presentationDate ? 'bg-secondary/30 text-foreground' : 'bg-blue-500/10 text-blue-500/80'}`}
                >
                  {formatDateBR(card.presentationDate || "") || "---"}
                </button>
              )}
            </div>

            <div className="flex items-center justify-between gap-1 w-full overflow-hidden">
              <div className="flex items-center gap-1 scale-[0.75] origin-left shrink-0">
                <Switch
                  checked={card.showInTimeline !== false}
                  onCheckedChange={(checked) => updateCard(card.id, { showInTimeline: checked })}
                  disabled={readOnly}
                  className="data-[state=checked]:bg-primary h-3.5 w-6 [&_span]:h-2.5 [&_span]:w-2.5"
                />
                <span className="text-[8px] font-bold uppercase tracking-tight text-white/50 whitespace-nowrap">TIMELINE</span>
              </div>
              <button
                onClick={() => setShowDiarias(true)}
                className="px-2 py-1 shrink-0 rounded bg-secondary hover:bg-secondary/80 text-foreground transition-all cursor-pointer text-[9px] font-bold uppercase tracking-wide h-5 leading-none flex items-center justify-center shadow-lg border border-white/5 active:scale-95"
              >
                Crono
              </button>
            </div>
          </div>
        </div>
      </div>

      {showDiarias && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80" onClick={() => setShowDiarias(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-[95vw] h-[95vh] max-w-none max-h-none overflow-hidden rounded-lg shadow-2xl relative">
            <DailyAllocationPanel
              cardId={card.id}
              cardName={card.name}
              entryDate={card.entryDate}
              deliveryDate={card.deliveryDate}
              allocations={card.dailyAllocations || {}}
              timelinePins={card.timelinePins || []}
              onClose={() => setShowDiarias(false)}
            />
          </div>
        </div>,
        document.body
      )}

      {/* Equipe */}
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold font-heading uppercase tracking-wider text-foreground">
            EQUIPE
          </span>
          {!readOnly && (
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-muted-foreground hover:text-foreground">
                  <Plus className="w-3 h-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" side="top">
                <AddTeamMemberForm cardId={card.id} />
              </PopoverContent>
            </Popover>
          )}
        </div>
        <div className="space-y-1.5">
          {(card.team || []).map((member) => (
            <TeamRow key={member.id} member={member} cardId={card.id} />
          ))}
          {(!card.team || card.team.length === 0) && (
            <p className="text-[10px] text-muted-foreground italic">Nenhum membro</p>
          )}
        </div>
      </div>

      {/* Feed */}
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center gap-1.5 mb-1">
          <Rss className="w-3 h-3 text-primary" />
          <span className="text-[10px] font-bold font-heading uppercase tracking-wider text-foreground flex-1">
            FEED
          </span>
          {allFeed.length > 1 && (
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setFeedIndex(Math.max(0, currentFeedIndex - 1))}
                disabled={currentFeedIndex === 0}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <ChevronUp className="w-3 h-3" />
              </button>
              <button
                onClick={() => setFeedIndex(Math.min(allFeed.length - 1, currentFeedIndex + 1))}
                disabled={currentFeedIndex >= allFeed.length - 1}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
        <div className="min-h-[20px]">
          {allFeed.length > 0 ? (
            <div className="flex items-start gap-1 group/feed">
              <p className="text-[10px] text-muted-foreground leading-tight flex-1">
                {allFeed[currentFeedIndex]?.message}
              </p>
              {!readOnly && (
                <button
                  onClick={() => {
                    const entry = allFeed[currentFeedIndex];
                    if (entry) {
                      removeFeedEntry(card.id, entry.id);
                      setFeedIndex(Math.max(0, currentFeedIndex - 1));
                    }
                  }}
                  className="opacity-0 group-hover/feed:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0 mt-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground italic">
              Nenhuma atualização.
            </p>
          )}
        </div>
      </div>

    </div>
  );
}
