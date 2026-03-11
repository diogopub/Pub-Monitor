/**
 * NewProjectDialog — Dialog para criar novo projeto
 */
import { useState } from "react";
import { nanoid } from "nanoid";
import { useProjectCards } from "@/contexts/ProjectCardsContext";
import { useNetwork } from "@/contexts/NetworkContext";
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
import { Plus, Trash2 } from "lucide-react";

const ROLE_STYLES: Record<string, { bg: string; label: string; networkRole: string }> = {
  criacao: { bg: "#dc2626", label: "CRIAÇÃO", networkRole: "creative" },
  arq: { bg: "#16a34a", label: "ARQ", networkRole: "architect" },
  "3d": { bg: "#2563eb", label: "3D", networkRole: "3d" },
};

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
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [entryDate, setEntryDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [teamSlots, setTeamSlots] = useState<TeamSlot[]>([
    { role: "criacao", name: "" },
    { role: "arq", name: "" },
    { role: "3d", name: "" },
  ]);

  const handleSubmit = () => {
    if (!name.trim()) return;

    const team = teamSlots
      .filter((s) => s.name)
      .map((s) => ({ id: nanoid(8), role: s.role, name: s.name }));

    addCard({
      name: name.trim().toUpperCase(),
      client: client.trim(),
      entryDate,
      deliveryDate,
      team,
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

  const getMembersForRole = (_role: string) => {
    return networkState.members;
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
                    <Select
                      value={slot.name}
                      onValueChange={(v) => {
                        const newSlots = [...teamSlots];
                        newSlots[idx] = { ...slot, name: v };
                        setTeamSlots(newSlots);
                      }}
                    >
                      <SelectTrigger className="flex-1 h-8 text-xs">
                        <SelectValue placeholder="Nome" />
                      </SelectTrigger>
                      <SelectContent>
                        {members.map((m) => (
                          <SelectItem key={m.id} value={m.name}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            Criar Projeto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
