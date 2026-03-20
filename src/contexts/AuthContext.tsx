import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  onAuthStateChanged,
  signInWithPopup,
  signOut, 
  User,
  GoogleAuthProvider
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { toast } from "sonner";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  clearGoogleToken: () => void;
  googleAccessToken: string | null;
  ensureGoogleToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(() => sessionStorage.getItem("g_token"));

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const clearGoogleToken = () => {
    setGoogleAccessToken(null);
    sessionStorage.removeItem("g_token");
    sessionStorage.removeItem("g_token_expires");
  };

  const ensureGoogleToken = async () => {
    const token = sessionStorage.getItem("g_token");
    if (!token) return null;
    
    const expiresAt = Number(sessionStorage.getItem("g_token_expires") || "0");
    // Se o token expirar nos próximos 5 minutos (ou já expirou), renova
    if (Date.now() > expiresAt) {
      try {
        console.log("Auto-renovando token do Google...");
        const result = await signInWithPopup(auth, googleProvider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          setGoogleAccessToken(credential.accessToken);
          sessionStorage.setItem("g_token", credential.accessToken);
          sessionStorage.setItem("g_token_expires", String(Date.now() + 3300 * 1000)); // 55 minutos
          return credential.accessToken;
        }
      } catch (error: any) {
        if (error.code === 'auth/popup-blocked') {
          toast.error("O navegador bloqueou a renovação. Clique no botão de Renovar Sync.");
        } else {
          console.error("Falha ao auto-renovar token", error);
        }
        clearGoogleToken();
        return null;
      }
    }
    return token;
  };

  const loginWithGoogle = async () => {
    try {
      // Antes de logar, limpa o antigo
      clearGoogleToken();
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setGoogleAccessToken(credential.accessToken);
        sessionStorage.setItem("g_token", credential.accessToken);
        sessionStorage.setItem("g_token_expires", String(Date.now() + 3300 * 1000)); // 55 minutos
      }
      toast.success("Acesso Google renovado!");
    } catch (error: any) {
      console.error("Erro ao fazer login:", error);
      const errorCode = error.code || "unknown";
      toast.error(`Falha ao entrar com Google: ${errorCode}`);

      if (errorCode === "auth/unauthorized-domain") {
        console.error("ERRO: O domínio do Vercel não está autorizado no Console do Firebase.");
      }
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      clearGoogleToken();
      toast.info("Você saiu do sistema");
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout, clearGoogleToken, googleAccessToken, ensureGoogleToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
}
