/**
 * Configurações — Agenda semanal + Cards de projetos
 */
import { useState } from "react";
import TopBar from "@/components/TopBar";
import WeeklySchedule from "@/components/WeeklySchedule";
import ProjectCard from "@/components/ProjectCard";
import NewProjectDialog from "@/components/NewProjectDialog";
import { useProjectCards } from "@/contexts/ProjectCardsContext";
import { Button } from "@/components/ui/button";
import { CalendarDays, FolderKanban, Plus } from "lucide-react";

function ProjectCardsSection({ onOpenDialog }: { onOpenDialog: () => void }) {
  const { state } = useProjectCards();
  const [filter, setFilter] = useState<"ativos" | "inativos">("ativos");

  const filteredCards = state.cards.filter((card) =>
    filter === "ativos" ? card.active !== false : card.active === false
  );

  return (
    <section className="p-4 sm:p-6 pt-0">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FolderKanban className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold font-heading tracking-wide">
            Cards de Projetos
          </h2>
          <div className="flex items-center ml-2 bg-muted rounded-md p-0.5">
            <button
              onClick={() => setFilter("ativos")}
              className={`px-2.5 py-1 text-[10px] font-semibold rounded transition-colors ${
                filter === "ativos"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Ativos
            </button>
            <button
              onClick={() => setFilter("inativos")}
              className={`px-2.5 py-1 text-[10px] font-semibold rounded transition-colors ${
                filter === "inativos"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Inativos
            </button>
          </div>
          <span className="text-xs text-muted-foreground ml-1">
            ({filteredCards.length})
          </span>
        </div>
        <Button size="sm" className="gap-1.5 text-xs" onClick={onOpenDialog}>
          <Plus className="w-3.5 h-3.5" />
          Novo Projeto
        </Button>
      </div>

      {filteredCards.length === 0 ? (
        <div className="border border-border rounded-lg bg-card/40 backdrop-blur-sm min-h-[200px] flex flex-col items-center justify-center gap-3">
          <p className="text-muted-foreground text-sm">
            {filter === "ativos" ? "Nenhum projeto ativo" : "Nenhum projeto inativo"}
          </p>
          {filter === "ativos" && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={onOpenDialog}>
              <Plus className="w-3.5 h-3.5" />
              Criar primeiro projeto
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-4">
          {filteredCards.map((card) => (
            <ProjectCard key={card.id} card={card} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function Configuracoes() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <div className="h-screen flex flex-col overflow-hidden bg-background">
        <TopBar />
        <div className="flex-1 overflow-auto">
          <section className="p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold font-heading tracking-wide">
                Agenda Semanal
              </h2>
            </div>
            <WeeklySchedule />
          </section>
          <ProjectCardsSection onOpenDialog={() => setDialogOpen(true)} />
        </div>
      </div>
      <NewProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
