/**
 * Configurações — Agenda semanal + Cards de projetos
 */
import { useState } from "react";
import TopBar from "@/components/TopBar";
import WeeklySchedule from "@/components/WeeklySchedule";
import ProjectCard from "@/components/ProjectCard";
import NewProjectDialog from "@/components/NewProjectDialog";
import { useProjectCards } from "@/contexts/ProjectCardsContext";
import { useNetwork } from "@/contexts/NetworkContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { usePermissions, UserRole } from "@/contexts/PermissionsContext";
import { useAuth } from "@/contexts/AuthContext";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useSchedule } from "@/contexts/ScheduleContext";
import { toast } from "sonner";
import { 
  ShieldCheck, 
  Mail, 
  UserPlus, 
  Trash2, 
  DatabaseZap,
  FolderKanban,
  Plus,
  Cloud,
  CalendarDays
} from "lucide-react";

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

function CloudMigrationSection() {
  const { state: networkState } = useNetwork();
  const { state: scheduleState } = useSchedule();
  const { state: cardsState } = useProjectCards();
  const { currentUserRole } = usePermissions();
  const [isMigrating, setIsMigrating] = useState(false);

  // Migration should only be visible to admins or if no cloud data exists
  if (currentUserRole !== "admin") return null;

  const handleMigration = async () => {
    if (!confirm("Isso irá sobrescrever os dados na nuvem com seus dados locais atuais. Deseja continuar?")) return;
    
    setIsMigrating(true);
    try {
      await Promise.all([
        setDoc(doc(db, "data", "network"), networkState),
        setDoc(doc(db, "data", "schedule"), scheduleState),
        setDoc(doc(db, "data", "cards"), cardsState),
      ]);
      toast.success("Migração para nuvem concluída!");
    } catch (error) {
      console.error("Migration error:", error);
      toast.error("Erro na migração");
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <section className="p-4 sm:p-6 pt-0 border-t border-border mt-8">
      <div className="flex items-center gap-2 mb-6">
        <DatabaseZap className="w-5 h-5 text-amber-500" />
        <h2 className="text-lg font-bold font-heading tracking-wide">
          Sincronização Forçada
        </h2>
      </div>

      <div className="max-w-2xl bg-amber-500/5 border border-amber-500/20 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-amber-500 uppercase tracking-wider">Migrar Local p/ Nuvem</h3>
            <p className="text-xs text-muted-foreground max-w-md">
              Use este botão se os dados na nuvem estiverem vazios ou desatualizados e você queira enviar seu estado local atual como a nova verdade.
            </p>
          </div>
          <Button 
            variant="outline" 
            className="border-amber-500/50 text-amber-500 hover:bg-amber-500/10 gap-2 shrink-0"
            onClick={handleMigration}
            disabled={isMigrating}
          >
            <DatabaseZap className="w-4 h-4" />
            {isMigrating ? "Migrando..." : "Enviar p/ Nuvem"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function PermissionsSettingsSection() {
  const { authorizedUsers, addAuthorizedUser, removeAuthorizedUser, currentUserRole } = usePermissions();
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("editor");
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

  return (
    <section className="p-4 sm:p-6 pt-0 border-t border-border mt-8">
      <div className="flex items-center gap-2 mb-6">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold font-heading tracking-wide">
          Usuários e Permissões
        </h2>
      </div>

      <div className="max-w-3xl space-y-6">
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
              className="bg-black/20 border border-border rounded-md px-3 text-xs font-semibold"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as UserRole)}
            >
              <option value="viewer">Visualizador (Leitura)</option>
              <option value="editor">Editor (Edita dados)</option>
              <option value="admin">Admin (Total)</option>
            </select>
            <Button size="sm" className="gap-2" onClick={handleAdd}>
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
                  <td className="p-3 capitalize">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      u.role === "admin" ? "bg-red-500/10 text-red-500" : 
                      u.role === "editor" ? "bg-blue-500/10 text-blue-500" : 
                      "bg-muted text-muted-foreground"
                    }`}>
                      {u.role}
                    </span>
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
              {authorizedUsers.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-muted-foreground italic">
                    Nenhum usuário autorizado cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function BackupSettingsSection() {
  const { state, updateSettings } = useNetwork();
  const { googleAppsScriptUrl, autoBackupEnabled } = state.settings;

  return (
    <section className="p-4 sm:p-6 pt-0 border-t border-border mt-8">
      <div className="flex items-center gap-2 mb-6">
        <Cloud className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold font-heading tracking-wide">
          Backup em Nuvem
        </h2>
      </div>

      <div className="max-w-2xl bg-card/40 backdrop-blur-sm border border-border rounded-xl p-6 space-y-6">
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
          <PermissionsSettingsSection />
          <CloudMigrationSection />
          <BackupSettingsSection />
        </div>
      </div>
      <NewProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
