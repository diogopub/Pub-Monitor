/**
 * TopBar — Barra superior com logo, navegação, filtros e ações
 */
import { useNetwork, ROLE_LABELS, type MemberRole } from "@/contexts/NetworkContext";
import { useSchedule } from "@/contexts/ScheduleContext";
import { useProjectCards } from "@/contexts/ProjectCardsContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Filter, Download, Upload, MoreVertical, StickyNote as StickyIcon } from "lucide-react";
import { toast } from "sonner";
import { useLocation, Link } from "wouter";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useReminders } from "@/contexts/RemindersContext";

interface TopBarProps {
  filterRole?: MemberRole | "all";
  onFilterChange?: (role: MemberRole | "all") => void;
  graphMode?: "agora" | "designado";
  onGraphModeChange?: (mode: "agora" | "designado") => void;
}

export default function TopBar({ filterRole, onFilterChange, graphMode, onGraphModeChange }: TopBarProps) {
  const { state: networkState, setState: setNetworkState } = useNetwork();
  const { state: scheduleState, setState: setScheduleState } = useSchedule();
  const { state: cardsState, setState: setCardsState } = useProjectCards();
  const { addReminder } = useReminders();
  const [location] = useLocation();

  const handleExport = () => {
    const fullData = {
      network: networkState,
      schedule: scheduleState,
      cards: cardsState,
    };
    const data = JSON.stringify(fullData, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const today = new Date().toISOString().split("T")[0];
    a.download = `pub-network-data-${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Dados exportados com sucesso");
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          // Support new format (with network/schedule/cards keys)
          if (data.network && data.network.members) {
            setNetworkState(data.network);
            if (data.schedule) setScheduleState(data.schedule);
            if (data.cards) setCardsState(data.cards);
            toast.success("Dados importados com sucesso");
          // Support legacy format (flat members/projects/assignments)
          } else if (data.members && data.projects && data.assignments) {
            setNetworkState(data);
            toast.success("Dados importados (formato legado)");
          } else {
            toast.error("Formato de arquivo inválido");
          }
        } catch {
          toast.error("Erro ao ler o arquivo");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };


  const { currentUserRole } = usePermissions();

  const navItems = [
    ...(currentUserRole === "admin" || currentUserRole === "editor" 
      ? [{ label: "Configurações", href: "/configuracoes" }] 
      : []),
    { label: "Painel", href: "/" },
  ];

  return (
    <div className="h-14 border-b border-border bg-card/60 backdrop-blur-md flex items-center px-3 sm:px-4 gap-2 sm:gap-4 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="w-8 h-8 rounded-md bg-white flex items-center justify-center shrink-0 overflow-hidden shadow-sm border border-white/10 transition-transform hover:scale-105">
          <img 
            src="/pub-logo.jpg" 
            alt="PUB Logo" 
            className="w-full h-full object-contain"
          />
        </div>
        <div className="hidden sm:block">
          <h1 className="text-sm font-bold font-heading tracking-wide leading-tight">
            Monitor PUB
          </h1>
          <p className="text-[10px] text-muted-foreground leading-tight">
            Equipe & Projetos
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex items-center gap-1 ml-4">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <span
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>


      {/* Spacer */}
      <div className="flex-1" />

      {/* Graph Mode Toggle */}
      {graphMode && onGraphModeChange && (
        <div className="hidden sm:flex bg-black/40 border border-white/10 rounded-md p-0.5 shadow-sm mr-2 shrink-0">
          <button
            onClick={() => onGraphModeChange("agora")}
            className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-sm transition-all ${
              graphMode === "agora" 
                ? "bg-primary text-primary-foreground shadow-md scale-100" 
                : "text-white/40 hover:text-white scale-95"
            }`}
            title="Mostra as conexões de acordo com a agenda neste momento"
          >
            Agora
          </button>
          <button
            onClick={() => onGraphModeChange("designado")}
            className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-sm transition-all ${
              graphMode === "designado" 
                ? "bg-primary text-primary-foreground shadow-md scale-100" 
                : "text-white/40 hover:text-white scale-95"
            }`}
            title="Mostra todas as conexões cadastradas no card do projeto"
          >
            Designado
          </button>
        </div>
      )}

      {/* Post-it Creator */}
      <Button
        variant="ghost"
        size="sm"
        className="h-9 px-3 gap-2 text-muted-foreground hover:text-yellow-400 transition-colors"
        onClick={() => addReminder(window.innerWidth / 2 - 90, window.innerHeight / 2 - 90)}
        title="Novo Post-it"
      >
        <StickyIcon className="w-4 h-4" />
        <span className="hidden lg:inline text-[10px] font-bold uppercase tracking-wider">Novo Recado</span>
      </Button>

      {/* Filter — only on Painel */}
      {filterRole !== undefined && onFilterChange && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs gap-1.5 shrink-0">
              <Filter className="w-3 h-3" />
              <span className="hidden sm:inline">
                {filterRole === "all" ? "Todos" : ROLE_LABELS[filterRole]}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onFilterChange("all")}>
              Todos
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onFilterChange("creative")}>
              <div className="w-2 h-2 rounded-full bg-red-500 mr-2" />
              Criativos
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onFilterChange("architect")}>
              <div className="w-2 h-2 rounded-full bg-green-500 mr-2" />
              Arquitetos
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onFilterChange("3d")}>
              <div className="w-2 h-2 rounded-full bg-violet-500 mr-2" />
              3D
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="text-xs shrink-0">
            <MoreVertical className="w-3 h-3 sm:hidden" />
            <span className="hidden sm:inline">Ações</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleExport}>
            <Download className="w-3 h-3 mr-2" />
            Exportar JSON
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleImport}>
            <Upload className="w-3 h-3 mr-2" />
            Importar JSON
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
