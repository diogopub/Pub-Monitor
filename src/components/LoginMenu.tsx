import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { LogIn, LogOut, User as UserIcon, ShieldAlert } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function LoginMenu() {
  const { user, loginWithGoogle, logout, loading: authLoading } = useAuth();
  const { currentUserRole, loading: permsLoading } = usePermissions();

  const loading = authLoading || permsLoading;

  if (loading) return null;
  if (!user) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-4">
        {/* Layer de vidro jateado / Frosted glass background */}
        <div className="absolute inset-0 bg-background/30 backdrop-blur-md" />
        
        {/* Caixa de Login Centralizada */}
        <div className="relative z-10 w-full max-w-sm space-y-6 bg-card/80 backdrop-blur-xl border border-border/50 shadow-2xl rounded-2xl p-8 text-center animate-in fade-in zoom-in-95 duration-500">
          <div className="flex flex-col items-center gap-4 text-red-500">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold uppercase tracking-widest font-heading">
              Acesso Restrito
            </h2>
          </div>
          <p className="text-sm text-center text-muted-foreground leading-relaxed">
            O Monitor é exclusivo para a equipe. Faça login com sua conta <strong>Google</strong> para acessar os dados e visualizar o painel.
          </p>
          <Button 
            className="w-full h-12 gap-3 text-sm font-bold shadow-lg hover:scale-[1.02] transition-all bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={loginWithGoogle}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Entrar com Google
          </Button>
        </div>
      </div>
    );
  }

  // If logged in but not authorized
  // An admin must add their email to the authorized users list
  if (!currentUserRole) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-4">
        {/* Layer de vidro jateado / Frosted glass background */}
        <div className="absolute inset-0 bg-background/30 backdrop-blur-md" />
        
        {/* Caixa de Aviso Centralizada */}
        <div className="relative z-10 w-full max-w-sm space-y-6 bg-card/80 backdrop-blur-xl border border-border/50 shadow-2xl rounded-2xl p-8 text-center animate-in fade-in zoom-in-95 duration-500">
          <div className="flex flex-col items-center gap-4 text-yellow-500">
            <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold uppercase tracking-widest font-heading">
              Acesso Restrito
            </h2>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-bold text-foreground">
              {user.email}
            </p>
            <p className="text-sm text-center text-muted-foreground leading-relaxed">
              Você está logado, mas seu e-mail ainda não possui permissão para acessar o Monitor.
            </p>
            <p className="text-xs text-center text-muted-foreground mt-2 border-t border-border pt-4">
              Solicite acesso a um Administrador informando seu e-mail.
            </p>
          </div>
          
          <Button 
            variant="outline"
            className="w-full gap-2 text-xs border-border mt-4"
            onClick={logout}
          >
            <LogOut className="w-4 h-4" />
            Sair e tentar outra conta
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 z-50">
      <Popover>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            size="icon" 
            className="w-12 h-12 rounded-full shadow-lg border-2 transition-all border-primary/50 bg-card/80 backdrop-blur-md hover:scale-110"
          >
            <Avatar className="w-10 h-10">
              <AvatarImage src={user.photoURL || ""} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {user.displayName?.charAt(0) || <UserIcon className="w-5 h-5" />}
              </AvatarFallback>
            </Avatar>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-4 mb-2 bg-card/95 backdrop-blur-xl border-border/50 shadow-2xl rounded-2xl">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar className="w-12 h-12 border-2 border-primary/20">
                <AvatarImage src={user.photoURL || ""} />
                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                  {user.displayName?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{user.displayName}</p>
                <p className="text-[10px] text-muted-foreground truncate uppercase tracking-tighter">
                  {currentUserRole ? `${currentUserRole}` : "Acesso Pendente"}
                </p>
              </div>
            </div>
            
            <div className="p-2 bg-primary/5 rounded-lg border border-primary/10">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Conectado</p>
              </div>
              <p className="text-[10px] text-muted-foreground">Sincronização em tempo real ativa.</p>
            </div>

            <Button 
              variant="outline" 
              size="sm" 
              className="w-full justify-start text-xs gap-2 border-red-500/20 text-red-500 hover:bg-red-500/10"
              onClick={logout}
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair da conta
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
