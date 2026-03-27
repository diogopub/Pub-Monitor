import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { 
  onAuthStateChanged,
  signInWithPopup,
  signOut, 
  User,
  GoogleAuthProvider
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { toast } from "sonner";

// ─── Constants ───────────────────────────────────────────────────
const GOOGLE_TOKEN_TTL_MS = 55 * 60 * 1000;
const GOOGLE_TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

const STORAGE_KEYS = {
  TOKEN: "g_token",
  EXPIRES: "g_token_expires"
} as const;

// ─── Helpers ─────────────────────────────────────────────────────
function isTokenExpired(expiresAt: number): boolean {
  if (!expiresAt) return true;
  // Expira se o tempo atual for maior que (expiração - buffer de segurança)
  return Date.now() > (expiresAt - GOOGLE_TOKEN_REFRESH_BUFFER_MS);
}

function getAuthErrorMessage(code?: string): string {
  switch (code) {
    case "auth/popup-blocked":
      return "O navegador bloqueou o login. Por favor, permita popups para este site.";
    case "auth/popup-closed-by-user":
      return "Login cancelado.";
    case "auth/unauthorized-domain":
      return "Domínio não autorizado no Firebase. Verifique as configurações do console.";
    case "auth/network-request-failed":
      return "Erro de conexão. Verifique sua internet.";
    default:
      return "Erro ao autenticar com Google. Tente novamente.";
  }
}

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

  // Inicializa validando se o token no storage ainda é útil
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(() => {
    const saved = sessionStorage.getItem(STORAGE_KEYS.TOKEN);
    const expires = Number(sessionStorage.getItem(STORAGE_KEYS.EXPIRES) || "0");
    
    if (saved && !isTokenExpired(expires)) {
      return saved;
    }
    
    // Se existir mas estiver expirado, limpa logo no boot
    if (saved) {
      sessionStorage.removeItem(STORAGE_KEYS.TOKEN);
      sessionStorage.removeItem(STORAGE_KEYS.EXPIRES);
    }
    return null;
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const clearGoogleToken = useCallback(() => {
    setGoogleAccessToken(null);
    sessionStorage.removeItem(STORAGE_KEYS.TOKEN);
    sessionStorage.removeItem(STORAGE_KEYS.EXPIRES);
  }, []);

  const saveGoogleToken = useCallback((token: string) => {
    const expiresAt = Date.now() + GOOGLE_TOKEN_TTL_MS;
    setGoogleAccessToken(token);
    sessionStorage.setItem(STORAGE_KEYS.TOKEN, token);
    sessionStorage.setItem(STORAGE_KEYS.EXPIRES, String(expiresAt));
  }, []);

  const ensureGoogleToken = async () => {
    const token = sessionStorage.getItem(STORAGE_KEYS.TOKEN);
    const expiresAt = Number(sessionStorage.getItem(STORAGE_KEYS.EXPIRES) || "0");

    if (!token || isTokenExpired(expiresAt)) {
      // Se não tem token ou expirou, não abre popup automaticamente.
      // Apenas limpa o estado e retorna null para que o chamador decida o que fazer.
      if (token) clearGoogleToken();
      return null;
    }
    
    return token;
  };

  const loginWithGoogle = async () => {
    try {
      // Limpa estado anterior por segurança
      clearGoogleToken();
      
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      
      if (credential?.accessToken) {
        saveGoogleToken(credential.accessToken);
        toast.success("Acesso Google renovado!");
      }
    } catch (error) {
      if (error instanceof Error) {
        const firebaseError = error as { code?: string };
        const message = getAuthErrorMessage(firebaseError.code);
        toast.error(message);
      } else {
        toast.error("Erro inesperado ao autenticar.");
      }
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      clearGoogleToken();
      toast.info("Você saiu do sistema");
    } catch (error) {
      // Logout raramente falha, mas tratamos com erro genérico se ocorrer
      toast.error("Houve um problema ao sair do sistema.");
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      loginWithGoogle, 
      logout, 
      clearGoogleToken, 
      googleAccessToken, 
      ensureGoogleToken 
    }}>
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

