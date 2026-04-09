/**
 * NewProjectDialog — Dialog para criar novo projeto
 */
import { useState } from "react";
import { nanoid } from "nanoid";
import { useProjectCards, type TimelinePin } from "@/contexts/ProjectCardsContext";
import { useNetwork } from "@/contexts/NetworkContext";
import { useSchedule } from "@/contexts/ScheduleContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, X } from "lucide-react";

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

interface TeamSlot {
  role: "criacao" | "arq" | "3d";
  name: string;
}

export default function NewProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { addCard } = useProjectCards();
  const { state: networkState } = useNetwork();
  const { getWeekRoster, addEntry } = useSchedule();
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [entryDate, setEntryDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [teamSlots, setTeamSlots] = useState<TeamSlot[]>([
    { role: "criacao", name: "" },
    { role: "arq", name: "" },
    { role: "3d", name: "" },
  ]);
  const [customSlotIndices, setCustomSlotIndices] = useState<Set<number>>(new Set());

  const handleSubmit = () => {
    if (!name.trim()) return;

    const team = teamSlots
      .filter((s) => s.name)
      .map((s) => ({ id: nanoid(8), role: s.role, name: s.name }));

    const cardId = nanoid(8);
    const pins: TimelinePin[] = [];
    if (deliveryDate) {
      pins.push({
        id: nanoid(8),
        date: deliveryDate,
        color: "red" as const,
        labels: ["ENTREGA"],
      });
      
      addEntry({
        id: nanoid(8),
        memberId: "sr-entradas",
        date: deliveryDate,
        activityId: "entrega-pub",
        projectId: cardId,
        duration: 8,
        startSlot: 0
      });
    }

    addCard({
      id: cardId,
      name: name.trim().toUpperCase(),
      client: client.trim(),
      entryDate,
      deliveryDate,
      team,
      timelinePins: pins,
      showInTimeline: true
    });

    // Reset
    setName("");
    setClient("");
    setEntryDate("");
    setDeliveryDate("");
    setTeamSlots([
      { role: "criacao", name: "" },
      { role: "arq", name: "" },
      { role: "3d", name: "" },
    ]);
    onOpenChange(false);
  };

  const getMembersForRole = (role: string) => {
    const monday = getMonday(new Date());
    const weekKey = monday.toISOString().split("T")[0];
    const allIds = networkState.members.map(m => m.id);
    const rosterIds = getWeekRoster(weekKey, allIds);

    return networkState.members
      .filter(m => rosterIds.includes(m.id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">Adicionar Novo Projeto</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name + Client */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Nome do Projeto
              </label>
              <Input
                placeholder="PROJETO / AG"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-primary/10 border-primary/30 font-semibold uppercase"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Cliente
              </label>
              <Input
                placeholder="Nome do cliente"
                value={client}
                onChange={(e) => setClient(e.target.value)}
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Data de Entrada
              </label>
              <Input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Data de Entrega
              </label>
              <Input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </div>
          </div>

          {/* Team */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-2">
              Equipe
            </label>
            <div className="space-y-2">
              {teamSlots.map((slot, idx) => {
                const style = ROLE_STYLES[slot.role];
                const members = getMembersForRole(slot.role);
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-bold px-2.5 py-1.5 rounded min-w-[70px] text-center text-white shrink-0"
                      style={{ backgroundColor: style.bg }}
                    >
                      {style.label}
                    </span>
                    {customSlotIndices.has(idx) ? (
                      <div className="relative flex-1">
                        <Input
                          value={slot.name}
                          onChange={(e) => {
                            const newSlots = [...teamSlots];
                            newSlots[idx] = { ...slot, name: e.target.value };
                            setTeamSlots(newSlots);
                          }}
                          placeholder="Digite o nome..."
                          className="h-8 text-[10px] md:text-[10px] font-bold font-heading uppercase tracking-wider bg-primary/10 border-primary/30"
                          autoFocus
                        />
                        <button 
                          onClick={() => {
                            const newCustom = new Set(customSlotIndices);
                            newCustom.delete(idx);
                            setCustomSlotIndices(newCustom);
                            const newSlots = [...teamSlots];
                            newSlots[idx] = { ...slot, name: "" };
                            setTeamSlots(newSlots);
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <Select
                        value={slot.name || "__empty__"}
                        onValueChange={(v) => {
                          if (v === "__custom__") {
                            const newCustom = new Set(customSlotIndices);
                            newCustom.add(idx);
                            setCustomSlotIndices(newCustom);
                            const newSlots = [...teamSlots];
                            newSlots[idx] = { ...slot, name: "" };
                            setTeamSlots(newSlots);
                          } else {
                            const newSlots = [...teamSlots];
                            newSlots[idx] = { ...slot, name: v === "__empty__" ? "" : v };
                            setTeamSlots(newSlots);
                          }
                        }}
                      >
                        <SelectTrigger className="flex-1 h-8 text-[10px] md:text-[10px] font-bold font-heading uppercase tracking-wider">
                          <SelectValue placeholder="Escolher..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__empty__">
                            <span className="italic opacity-60">Personalizado</span>
                          </SelectItem>
                          <SelectItem value="__custom__">
                            <span className="font-bold text-primary">✏️ Escrever nome...</span>
                          </SelectItem>
                          {members.map((m) => (
                            <SelectItem key={m.id} value={m.name}>
                              {m.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || !client.trim()}>
            Criar Projeto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
