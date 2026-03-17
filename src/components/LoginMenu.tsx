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

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Popover>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            size="icon" 
            className={`w-12 h-12 rounded-full shadow-lg border-2 transition-all ${
              user ? "border-primary/50" : "border-red-500/50 animate-pulse"
            } bg-card/80 backdrop-blur-md hover:scale-110`}
          >
            {user ? (
              <Avatar className="w-10 h-10">
                <AvatarImage src={user.photoURL || ""} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {user.displayName?.charAt(0) || <UserIcon className="w-5 h-5" />}
                </AvatarFallback>
              </Avatar>
            ) : (
              <LogIn className="w-5 h-5 text-red-500" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-4 mb-2 bg-card/95 backdrop-blur-xl border-border/50 shadow-2xl rounded-2xl">
          {user ? (
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
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-red-500">
                <ShieldAlert className="w-4 h-4" />
                <p className="text-xs font-bold uppercase tracking-wider">Acesso Restrito</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Faça login com sua conta <strong>PUB</strong> para visualizar e editar os dados da equipe.
              </p>
              <Button 
                className="w-full gap-2 font-bold"
                onClick={loginWithGoogle}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
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
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
