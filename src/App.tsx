import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { NetworkProvider } from "./contexts/NetworkContext";
import { ScheduleProvider } from "./contexts/ScheduleContext";
import { ProjectCardsProvider } from "./contexts/ProjectCardsContext";
import { AuthProvider } from "./contexts/AuthContext";
import { PermissionsProvider } from "./contexts/PermissionsContext";
import Home from "./pages/Home";
import Configuracoes from "./pages/Configuracoes";
import { useAutoBackup } from "./hooks/useAutoBackup";
import { LoginMenu } from "./components/LoginMenu";
import { RemindersProvider } from "./contexts/RemindersContext";

function BackupManager() {
  useAutoBackup();
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/configuracoes"} component={Configuracoes} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <AuthProvider>
          <PermissionsProvider>
            <NetworkProvider>
              <ScheduleProvider>
                <ProjectCardsProvider>
                  <RemindersProvider>
                    <BackupManager />
                    <LoginMenu />
                    <TooltipProvider>
                      <Toaster
                        theme="dark"
                        toastOptions={{
                          style: {
                            background: "oklch(0.16 0.025 260)",
                            border: "1px solid oklch(0.28 0.02 260)",
                            color: "oklch(0.92 0.01 250)",
                          },
                        }}
                      />
                      <Router />
                    </TooltipProvider>
                  </RemindersProvider>
                </ProjectCardsProvider>
              </ScheduleProvider>
            </NetworkProvider>
          </PermissionsProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
