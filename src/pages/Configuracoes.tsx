/**
 * Configurações — Agenda semanal + Cards de projetos
 */
import { useState } from "react";
import TopBar from "@/components/TopBar";
import WeeklySchedule from "@/components/WeeklySchedule";
import ProjectCard from "@/components/ProjectCard";
import ProjectTimelines from "@/components/ProjectTimelines";
import NewProjectDialog from "@/components/NewProjectDialog";
import { useProjectCards } from "@/contexts/ProjectCardsContext";
import { useNetwork } from "@/contexts/NetworkContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { usePermissions, UserRole } from "@/contexts/PermissionsContext";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useReminders } from "@/contexts/RemindersContext";
import StickyNote from "@/components/StickyNote";
import { 
  ShieldCheck, 
  Mail, 
  UserPlus, 
  Trash2, 
  FolderKanban,
  Plus,
  Cloud,
  CalendarDays,
  Check,
  UserX,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

function ProjectCardsSection({ onOpenDialog }: { onOpenDialog: () => void }) {
  const { state } = useProjectCards();
  const [filter, setFilter] = useState<"ativos" | "inativos">("ativos");

  const filteredCards = [...state.cards]
    .filter((card) =>
      filter === "ativos" ? card.active !== false : card.active === false
    )
    .sort((a, b) => {
      // 1. "PUB INTERNO" always first
      if (a.name === "PUB INTERNO") return -1;
      if (b.name === "PUB INTERNO") return 1;

      const aHasDates = !!a.entryDate && !!a.deliveryDate;
      const bHasDates = !!b.entryDate && !!b.deliveryDate;
      
      // 2. If one has dates and the other doesn't, prioritize the one with dates
      if (aHasDates && !bHasDates) return -1;
      if (!aHasDates && bHasDates) return 1;
      
      // 3. Alphabetical by name
      return (a.name || "").localeCompare(b.name || "");
    });

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

function PermissionsSettingsSection() {
  const { authorizedUsers, pendingUsers, addAuthorizedUser, removeAuthorizedUser, removePendingRequest, currentUserRole } = usePermissions();
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("editor");
  
  // Pending approvals state overrides per user
  const [pendingRoles, setPendingRoles] = useState<Record<string, UserRole>>({});

  const { user } = useAuth();

  if (currentUserRole !== "admin") return null;

  const handleAdd = async () => {
    if (!newEmail.includes("@")) {
      toast.error("E-mail inválido");
      return;
    }
    await addAuthorizedUser(newEmail.trim().toLowerCase(), newRole);
    setNewEmail("");
    toast.success("Usuário autorizado");
  };

  const handleApprove = async (email: string) => {
    const role = pendingRoles[email] || "viewer";
    await addAuthorizedUser(email, role);
    await removePendingRequest(email);
    toast.success("Acesso aprovado!");
  };

  const handleReject = async (email: string) => {
    if (!confirm(`Rejeitar '${email}'? Isso removerá o pedido da lista.`)) return;
    await removePendingRequest(email);
    toast.success("Acesso rejeitado.");
  };

  const handleRoleChange = async (email: string, role: UserRole) => {
    await addAuthorizedUser(email, role);
    toast.success("Permissão atualizada.");
  };

  return (
    <section className="p-4 sm:p-6 pt-0 border-t border-border mt-8">
      <div className="flex items-center gap-2 mb-6">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold font-heading tracking-wide">
          Usuários e Permissões
        </h2>
      </div>

      <div className="flex flex-col xl:flex-row gap-6 items-start">
        {/* Esquerda: Usuários Ativos e Cadastro */}
        <div className="flex-1 space-y-6 w-full">
          <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl p-6 space-y-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Adicionar Novo Membro</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="email@pub.com" 
                  className="pl-10 bg-black/20"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <select 
                className="bg-black/20 border border-border rounded-md px-3 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
              >
                <option value="viewer">Visualizador (Leitura)</option>
                <option value="editor">Editor (Edita dados)</option>
                <option value="admin">Admin (Total)</option>
              </select>
              <Button size="sm" className="gap-2 shrink-0" onClick={handleAdd}>
                <UserPlus className="w-4 h-4" />
                Autorizar
              </Button>
            </div>
          </div>

          <div className="bg-card/40 backdrop-blur-sm border border-border rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="p-3 font-bold uppercase tracking-wider text-[10px] text-muted-foreground border-b border-border">E-mail</th>
                  <th className="p-3 font-bold uppercase tracking-wider text-[10px] text-muted-foreground border-b border-border">Cargo</th>
                  <th className="p-3 font-bold uppercase tracking-wider text-[10px] text-muted-foreground border-b border-border text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {authorizedUsers.map((u) => (
                  <tr key={u.email} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="p-3 font-medium">
                      {u.email}
                      {u.email === user?.email && <span className="ml-2 text-[8px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full uppercase">você</span>}
                    </td>
                    <td className="p-3">
                      <select 
                        className={`bg-black/20 border border-border rounded-md px-2 py-1 text-[10px] font-bold uppercase focus:outline-none focus:ring-1 focus:ring-primary ${
                          u.role === "admin" ? "text-red-500" : 
                          u.role === "editor" ? "text-blue-500" : 
                          "text-muted-foreground"
                        }`}
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.email, e.target.value as UserRole)}
                        disabled={u.email === user?.email} // Não pode alterar o próprio nível facilmente por segurança mínima
                      >
                        <option value="viewer" className="text-foreground">Visualizador</option>
                        <option value="editor" className="text-foreground">Editor</option>
                        <option value="admin" className="text-foreground">Admin</option>
                      </select>
                    </td>
                    <td className="p-3 text-right">
                      {u.email !== user?.email && (
                        <button 
                          className="text-muted-foreground hover:text-red-500 transition-colors"
                          onClick={() => removeAuthorizedUser(u.email)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Direita: Aprovação Pendente */}
        <div className="w-full xl:w-[450px] shrink-0 space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Aprovação Pendente</h3>
            {pendingUsers.length > 0 && (
              <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse">
                {pendingUsers.length}
              </span>
            )}
          </div>

          {pendingUsers.length === 0 ? (
            <div className="bg-card/20 border border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center text-muted-foreground text-center h-[200px]">
              <ShieldCheck className="w-8 h-8 opacity-20 mb-2" />
              <p className="text-xs">Nenhum pedido pendente no momento.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingUsers.map(p => {
                const selectedRole = pendingRoles[p.email] || "viewer";
                return (
                  <div key={p.email} className="bg-card/60 backdrop-blur-md border border-red-500/30 shadow-[0_4px_20px_rgba(239,68,68,0.05)] rounded-xl p-4 flex flex-col gap-3 transition-all hover:bg-card/80">
                    <div className="flex items-center gap-3">
                      {p.photoURL ? (
                        <img src={p.photoURL} alt={p.name} className="w-8 h-8 rounded-full border border-border" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold uppercase">
                          {p.name ? p.name.charAt(0) : p.email.charAt(0)}
                        </div>
                      )}
                      <div className="overflow-hidden">
                        <p className="font-bold text-sm truncate">{p.name || "Usuário"}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{p.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <select 
                        className="bg-black/40 border border-border rounded-md px-2 h-7 flex-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                        value={selectedRole}
                        onChange={(e) => setPendingRoles(prev => ({ ...prev, [p.email]: e.target.value as UserRole }))}
                      >
                        <option value="viewer">Visualizador</option>
                        <option value="editor">Editor</option>
                        <option value="admin">Admin</option>
                      </select>
                      
                      <Button 
                        size="icon-sm" 
                        variant="outline"
                        className="h-7 w-7 text-green-500 hover:text-green-500 hover:bg-green-500/10 border-green-500/20"
                        title="Aprovar com esta permissão"
                        onClick={() => handleApprove(p.email)}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                      
                      <Button 
                        size="icon-sm" 
                        variant="outline"
                        className="h-7 w-7 text-red-500 hover:text-red-500 hover:bg-red-500/10 border-red-500/20"
                        title="Rejeitar pedido"
                        onClick={() => handleReject(p.email)}
                      >
                        <UserX className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}


function BackupSettingsSection() {
  const { state, updateSettings } = useNetwork();
  const { googleAppsScriptUrl, autoBackupEnabled } = state.settings;

  return (
    <section className="w-full">
      <div className="flex items-center gap-2 mb-6">
        <Cloud className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold font-heading tracking-wide">
          Backup em Nuvem
        </h2>
      </div>

      <div className="w-full bg-card/40 backdrop-blur-sm border border-border rounded-xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-foreground">Backup Automático</h3>
            <p className="text-xs text-muted-foreground">
              Enviar dados para o Google Drive diariamente às 12:00 e 20:00.
            </p>
          </div>
          <Switch
            checked={autoBackupEnabled}
            onCheckedChange={(v) => updateSettings({ autoBackupEnabled: v })}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            URL do Google Apps Script
          </label>
          <div className="flex gap-2">
            <Input
              placeholder="https://script.google.com/macros/s/.../exec"
              value={googleAppsScriptUrl || ""}
              onChange={(e) => updateSettings({ googleAppsScriptUrl: e.target.value })}
              className="bg-black/20 border-border text-xs"
            />
            {googleAppsScriptUrl && (
              <div className="flex items-center justify-center px-3 bg-green-500/10 text-green-500 rounded-md border border-green-500/20">
                <ShieldCheck className="w-4 h-4" />
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground italic">
            Cole a URL da implantação do App da Web gerada no Google Apps Script.
          </p>
        </div>
      </div>
    </section>
  );
}

export default function Configuracoes() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"week" | "fortnight" | "month">("week");
  const { reminders } = useReminders();
  const { currentUserRole, loading } = usePermissions();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && currentUserRole === "viewer") {
      toast.error("Visualizadores não têm acesso a esta página.");
      setLocation("/");
    }
  }, [currentUserRole, loading, setLocation]);

  if (currentUserRole === "viewer") {
    return null; // Don't render anything while redirecting
  }

  return (
    <div className="relative">
      <div className="h-screen flex flex-col overflow-hidden bg-background">
        <TopBar />
        <div id="main-scroll-container" className="flex-1 overflow-auto relative">
          <section className="p-4 sm:p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold font-heading tracking-wide">
                  Agenda
                </h2>
              </div>
              <div className="flex items-center gap-6 ml-4">
                {(['week', 'fortnight', 'month'] as const).map((mode) => {
                  const labels = { week: 'Semana', fortnight: 'Quinzena', month: 'Mês' };
                  const active = viewMode === mode;
                  return (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className="flex flex-col items-center gap-1 group transition-all"
                    >
                      <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        active 
                          ? 'bg-[#22c55e] shadow-[0_0_8px_rgba(34,197,94,0.6)] scale-110' 
                          : 'bg-white group-hover:bg-white/80'
                      }`} />
                      <span className={`text-[11px] font-medium transition-colors ${
                        active ? 'text-white' : 'text-white/40 group-hover:text-white/60'
                      }`}>
                        {labels[mode]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <WeeklySchedule viewMode={viewMode} />
          </section>
          <ProjectTimelines />
          <ProjectCardsSection onOpenDialog={() => setDialogOpen(true)} />
          <PermissionsSettingsSection />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 sm:p-6 pt-0 border-t border-border mt-8">
            <BackupSettingsSection />
          </div>

          {/* Floating Reminders inside scroll container */}
          {reminders.map((reminder) => (
            <StickyNote key={reminder.id} reminder={reminder} />
          ))}
        </div>
      </div>
      <NewProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
