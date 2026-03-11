/**
 * SidePanel — Painel lateral para gerenciar conexões
 * Design: Constellation dark theme
 */
import { useNetwork, ROLE_LABELS } from "@/contexts/NetworkContext";
import { useProjectCards } from "@/contexts/ProjectCardsContext";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Trash2,
  Link2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

interface SidePanelProps {
  collapsed: boolean;
  onToggle: () => void;
  selectedNodeId?: string | null;
  selectedNodeType?: "member" | "project" | null;
  onClearSelection: () => void;
}

export default function SidePanel({
  collapsed,
  onToggle,
  selectedNodeId,
  selectedNodeType,
  onClearSelection,
}: SidePanelProps) {
  const {
    state,
    addAssignment,
    removeAssignment,
  } = useNetwork();

  const { state: cardsState } = useProjectCards();

  // Assignment form state
  const [assignMemberId, setAssignMemberId] = useState("");
  const [assignProjectId, setAssignProjectId] = useState("");

  // Get selected node details
  const selectedMember =
    selectedNodeType === "member"
      ? state.members.find((m) => m.id === selectedNodeId)
      : null;
  const selectedProject =
    selectedNodeType === "project"
      ? state.projects.find((p) => p.id === selectedNodeId)
      : null;

  // Get connections for selected node
  const selectedConnections = selectedNodeId
    ? state.assignments.filter(
        (a) =>
          a.memberId === selectedNodeId || a.projectId === selectedNodeId
      )
    : [];

  return (
    <div
      className={`h-full transition-all duration-300 ease-in-out relative ${
        collapsed ? "w-12" : "w-80"
      }`}
    >
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-6 z-10 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center hover:bg-accent transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </button>

      {collapsed ? (
        <div className="h-full bg-card/50 backdrop-blur-sm border-r border-border flex flex-col items-center py-4 gap-3">
          <Link2 className="w-4 h-4 text-muted-foreground" />
        </div>
      ) : (
        <div className="h-full bg-card/80 backdrop-blur-md border-r border-border flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-semibold font-heading tracking-wide text-foreground">
              PAINEL DE CONTROLE
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {state.members.length} membros · {cardsState.cards.length} projetos
            </p>
          </div>

          {/* Selected node detail */}
          {(selectedMember || selectedProject) && (
            <div className="p-4 border-b border-border bg-accent/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {selectedMember ? "Membro Selecionado" : "Projeto Selecionado"}
                </span>
                <button
                  onClick={onClearSelection}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Limpar
                </button>
              </div>
              {selectedMember && (
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: selectedMember.color }}
                  />
                  <span className="font-medium text-sm">{selectedMember.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {ROLE_LABELS[selectedMember.role]}
                  </span>
                </div>
              )}
              {selectedProject && (
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: selectedProject.color }}
                  />
                  <span className="font-medium text-sm">{selectedProject.name}</span>
                </div>
              )}
              {selectedConnections.length > 0 && (
                <div className="mt-2 space-y-1">
                  <span className="text-xs text-muted-foreground">Conexões:</span>
                  {selectedConnections.map((conn) => {
                    const member = state.members.find((m) => m.id === conn.memberId);
                    const project = state.projects.find((p) => p.id === conn.projectId);
                    return (
                      <div
                        key={conn.id}
                        className="flex items-center justify-between text-xs"
                      >
                        <span>
                          {member?.name} → {project?.name}
                        </span>
                        <button
                          onClick={() => {
                            removeAssignment(conn.id);
                            toast.success("Conexão removida");
                          }}
                          className="text-destructive hover:text-destructive/80"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <ScrollArea className="flex-1">
            <div className="p-3 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Link2 className="w-3 h-3" />
                Conexões
              </div>

              {/* Add assignment */}
              <div className="p-3 rounded-lg bg-secondary/30 border border-border space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Nova Conexão
                </p>
                <Select value={assignMemberId} onValueChange={setAssignMemberId}>
                  <SelectTrigger className="bg-secondary border-border text-xs">
                    <SelectValue placeholder="Selecione um membro" />
                  </SelectTrigger>
                  <SelectContent>
                    {state.members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full inline-block"
                            style={{ backgroundColor: m.color }}
                          />
                          {m.name} ({ROLE_LABELS[m.role]})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={assignProjectId} onValueChange={setAssignProjectId}>
                  <SelectTrigger className="bg-secondary border-border text-xs">
                    <SelectValue placeholder="Selecione um projeto" />
                  </SelectTrigger>
                  <SelectContent>
                    {cardsState.cards.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="w-full"
                  disabled={!assignMemberId || !assignProjectId}
                  onClick={() => {
                    const member = state.members.find(
                      (m) => m.id === assignMemberId
                    );
                    if (member) {
                      addAssignment(assignMemberId, assignProjectId, member.role);
                      const project = state.projects.find(
                        (p) => p.id === assignProjectId
                      );
                      toast.success(
                        `${member.name} conectado a ${project?.name}`
                      );
                      setAssignMemberId("");
                      setAssignProjectId("");
                    }
                  }}
                >
                  <Link2 className="w-3 h-3 mr-1" />
                  Conectar
                </Button>
              </div>

              <div className="border-t border-border" />

              {/* List all assignments */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Conexões Ativas ({state.assignments.length})
                </p>
                {state.assignments.map((a) => {
                  const member = state.members.find((m) => m.id === a.memberId);
                  const project = state.projects.find(
                    (p) => p.id === a.projectId
                  );
                  if (!member || !project) return null;
                  return (
                    <div
                      key={a.id}
                      className="flex items-center gap-2 p-1.5 rounded hover:bg-accent/30 transition-colors group text-xs"
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: member.color }}
                      />
                      <span className="truncate flex-1">
                        {member.name}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="truncate flex-1">{project.name}</span>
                      <button
                        onClick={() => {
                          removeAssignment(a.id);
                          toast.success("Conexão removida");
                        }}
                        className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-destructive/20 rounded transition-opacity"
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
