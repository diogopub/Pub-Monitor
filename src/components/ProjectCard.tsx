/**
 * ProjectCard — Card individual de projeto
 * Feed, prazo, equipe, documentos com toggle
 */
import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import {
  useProjectCards,
  type ProjectCardData,
  type ProjectStatus,
} from "@/contexts/ProjectCardsContext";
import { useNetwork } from "@/contexts/NetworkContext";
import { Switch } from "@/components/ui/switch";
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
const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; next: ProjectStatus }> = {
  "em-desenvolvimento": { label: "WORK IN PROGRESS", color: "#22c55e", next: "onboarding" },
  "onboarding": { label: "ONBOARDING", color: "#eab308", next: "standby" },
  "standby": { label: "STANDBY", color: "#f97316", next: "aguardando-retorno" },
  "aguardando-retorno": { label: "VALIDAÇÃO CLIENTE", color: "#ef4444", next: "em-desenvolvimento" },
};

// ─── Team Role Badge ─────────────────────────────────────────────
const ROLE_STYLES: Record<string, { bg: string; label: string }> = {
  criacao: { bg: "#dc2626", label: "CRIAÇÃO" },
  arq: { bg: "#16a34a", label: "ARQ" },
  "3d": { bg: "#2563eb", label: "3D" },
};

function TeamRow({
  member,
  cardId,
}: {
  member: { id: string; role: "criacao" | "arq" | "3d"; name: string };
  cardId: string;
}) {
  const { state } = useNetwork();
  const { updateTeamMember, removeTeamMember } = useProjectCards();
  const style = ROLE_STYLES[member.role];

  const membersForRole = state.members;

  return (
    <div className="flex items-center gap-2 group/team">
      <span
        className="text-[10px] font-bold px-2 py-1 rounded min-w-[60px] text-center text-white"
        style={{ backgroundColor: style.bg }}
      >
        {style.label}
      </span>
      <Select
        value={member.name || "__empty__"}
        onValueChange={(v) => updateTeamMember(cardId, member.id, v === "__empty__" ? "" : v)}
      >
        <SelectTrigger className="h-7 text-xs flex-1 bg-secondary/30 border-border">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__empty__">
            <span className="italic opacity-60">Vazio</span>
          </SelectItem>
          {membersForRole.map((m) => (
            <SelectItem key={m.id} value={m.name}>
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
  const [role, setRole] = useState<"criacao" | "arq" | "3d">("criacao");
  const [name, setName] = useState("");

  const membersForRole = state.members;

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
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__empty__">
            <span className="italic opacity-60">Vazio</span>
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
  const { toggleDocument, addDocument, removeDocument, reorderDocument, updateCard, removeCard, removeFeedEntry } =
    useProjectCards();
  const [newDocLabel, setNewDocLabel] = useState("");
  const [feedIndex, setFeedIndex] = useState(0);
  const [editingDates, setEditingDates] = useState<false | "entry" | "delivery">(false);
  const [entryDate, setEntryDate] = useState(card.entryDate);
  const [deliveryDate, setDeliveryDate] = useState(card.deliveryDate);
  const [showDiarias, setShowDiarias] = useState(false);

  const progress = calcProgress(card.entryDate, card.deliveryDate);
  const daysToEntry = calcDaysFromNow(card.entryDate);
  const daysToDelivery = calcDaysFromNow(card.deliveryDate);

  const handleSaveDates = () => {
    updateCard(card.id, { entryDate, deliveryDate });
    setEditingDates(false);
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
              const current: ProjectStatus = card.projectStatus || "em-desenvolvimento";
              updateCard(card.id, { projectStatus: STATUS_CONFIG[current].next });
            }}
            className="w-3 h-3 rounded-full shrink-0 transition-all hover:scale-125 shadow-md ring-2 ring-offset-2 ring-offset-card"
            style={{
              backgroundColor: STATUS_CONFIG[card.projectStatus || "em-desenvolvimento"].color,
              boxShadow: `0 0 0 2px ${STATUS_CONFIG[card.projectStatus || "em-desenvolvimento"].color}55`,
            }}
            title="Clique para mudar o status"
          />
          <span className="text-[10px] font-bold tracking-wide" style={{ color: STATUS_CONFIG[card.projectStatus || "em-desenvolvimento"].color }}>
            {STATUS_CONFIG[card.projectStatus || "em-desenvolvimento"].label}
          </span>
        </div>
      </div>

      {/* Project name + active toggle + client */}
      <div className="px-3 py-2 border-b border-border bg-primary/5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold font-heading uppercase tracking-wide text-foreground">
              {card.name}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Switch
                checked={card.active !== false}
                onCheckedChange={(checked) => updateCard(card.id, { active: checked })}
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
            {card.hub && (
              <span className="text-[10px] text-muted-foreground">{card.hub}</span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
            <span>{card.client}</span>
            <Popover>
              <PopoverTrigger asChild>
                <button className="p-0.5 hover:bg-accent/50 rounded">
                  <Trash2 className="w-3 h-3 text-destructive/60 hover:text-destructive" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-3" side="top">
                <p className="text-xs mb-2">Remover este projeto?</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" className="text-xs flex-1" onClick={() => removeCard(card.id)}>
                    Remover
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Prazo */}
      <div className="px-3 py-2 border-b border-border">
        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-muted-foreground">ENTRADA</span>
              {editingDates === "entry" ? (
                <Input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  onBlur={() => { handleSaveDates(); setEditingDates(false); }}
                  className="h-6 text-[10px] w-28"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => setEditingDates("entry")}
                  className={`px-1.5 py-0.5 rounded font-mono transition-colors cursor-pointer ${card.entryDate ? 'bg-secondary/50 text-foreground hover:bg-secondary/80' : 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30'}`}
                >
                  {formatDateBR(card.entryDate) || "Adicionar"}
                </button>
              )}
            </div>
            <span className="text-muted-foreground font-mono">{daysToEntry !== null ? Math.abs(daysToEntry) : "-"}</span>
          </div>
          <div className="flex items-center text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-muted-foreground">ENTREGA</span>
              {editingDates === "delivery" ? (
                <Input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  onBlur={() => { handleSaveDates(); setEditingDates(false); }}
                  className="h-6 text-[10px] w-28"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => setEditingDates("delivery")}
                  className={`px-1.5 py-0.5 rounded font-mono transition-colors cursor-pointer ${card.deliveryDate ? 'bg-secondary/50 text-foreground hover:bg-secondary/80' : 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30'}`}
                >
                  {formatDateBR(card.deliveryDate) || "Adicionar"}
                </button>
              )}
            </div>
            <div className="flex-1 flex justify-center">
              <button
                onClick={() => setShowDiarias(true)}
                className="px-2.5 py-0.5 rounded border border-border bg-card font-semibold text-foreground hover:bg-secondary/80 transition-colors cursor-pointer text-[10px]"
              >
                Crono
              </button>
            </div>
            <span className="text-muted-foreground font-mono">{daysToDelivery !== null ? Math.abs(daysToDelivery) : "-"}</span>
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
        </div>
        <div className="space-y-1.5">
          {card.team.map((member) => (
            <TeamRow key={member.id} member={member} cardId={card.id} />
          ))}
          {card.team.length === 0 && (
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
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground italic">
              Nenhuma atualização.
            </p>
          )}
        </div>
      </div>

      {/* Documentos */}
      <div className="px-3 py-2">
        <div className="space-y-1">
          {card.documents.map((doc, idx) => (
            <div key={doc.id} className="flex items-center gap-1 group/doc">
              <div className="flex flex-col">
                <button
                  onClick={() => reorderDocument(card.id, doc.id, "up")}
                  disabled={idx === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-20 leading-none"
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button
                  onClick={() => reorderDocument(card.id, doc.id, "down")}
                  disabled={idx === card.documents.length - 1}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-20 leading-none"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
              <span className={`text-[10px] font-semibold flex-1 ${doc.enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                {doc.label}
              </span>
              <button
                onClick={() => removeDocument(card.id, doc.id)}
                className="opacity-0 group-hover/doc:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-3 h-3" />
              </button>
              <Switch
                checked={doc.enabled}
                onCheckedChange={() => toggleDocument(card.id, doc.id)}
                className="scale-75 data-[state=unchecked]:!bg-red-600 data-[state=unchecked]:!border-red-600 data-[state=checked]:!bg-green-600 data-[state=checked]:!border-green-600 [&_[data-slot=switch-thumb]]:!bg-white"
              />
            </div>
          ))}
        </div>

        {/* Add document */}
        <div className="flex items-center gap-1 mt-2">
          <Input
            placeholder="Novo documento"
            value={newDocLabel}
            onChange={(e) => setNewDocLabel(e.target.value)}
            className="h-6 text-[10px] flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newDocLabel.trim()) {
                addDocument(card.id, newDocLabel.trim().toUpperCase());
                setNewDocLabel("");
              }
            }}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-6 w-6"
            onClick={() => {
              if (newDocLabel.trim()) {
                addDocument(card.id, newDocLabel.trim().toUpperCase());
                setNewDocLabel("");
              }
            }}
          >
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
