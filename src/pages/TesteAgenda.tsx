import React from "react";
import TopBar from "@/components/TopBar";
import WeeklySchedule from "@/components/WeeklySchedule";
import { CalendarDays } from "lucide-react";

export default function TesteAgenda() {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <TopBar />
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-6">
          <CalendarDays className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold font-heading tracking-wide">
            Teste Agenda
          </h1>
          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full uppercase font-bold tracking-tighter">
            Experimental
          </span>
        </div>
        
        <div className="bg-card/30 backdrop-blur-md border border-border rounded-xl p-4 shadow-2xl">
          <WeeklySchedule />
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
          <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-primary">Instruções de Teste</h3>
            <ul className="text-xs text-muted-foreground space-y-2">
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span><strong>Duplicar:</strong> Segure <strong>Alt</strong> enquanto clica e arrasta uma tarefa para outro slot.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span><strong>Mover:</strong> Clique e arraste normalmente.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span><strong>Redimensionar:</strong> Use a alça lateral direita para mudar a duração.</span>
              </li>
            </ul>
          </div>
          <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-primary">Status do Sistema</h3>
            <p className="text-xs text-muted-foreground">
              Este ambiente é isolado para validar interações na WeeklySchedule antes de serem integradas permanentemente. 
              As alterações feitas aqui são salvas no banco de dados real.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
