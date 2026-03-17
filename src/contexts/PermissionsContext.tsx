import React, { createContext, useContext, useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { 
  doc, 
  onSnapshot, 
  setDoc, 
  collection,
  query,
  getDocs
} from "firebase/firestore";
import { useAuth } from "./AuthContext";

export type UserRole = "admin" | "editor" | "viewer";

export interface AuthorizedUser {
  email: string;
  role: UserRole;
  addedAt: number;
}

interface PermissionsContextType {
  authorizedUsers: AuthorizedUser[];
  currentUserRole: UserRole | null;
  addAuthorizedUser: (email: string, role: UserRole) => Promise<void>;
  removeAuthorizedUser: (email: string) => Promise<void>;
  isAuthorized: boolean;
  loading: boolean;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [authorizedUsers, setAuthorizedUsers] = useState<AuthorizedUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Load authorized users list
  useEffect(() => {
    console.log("PermissionsProvider: Iniciando listener do Firestore...");
    const unsub = onSnapshot(collection(db, "config"), (snapshot) => {
      const usersDoc = snapshot.docs.find(d => d.id === "authorized_users");
      if (usersDoc) {
        const list = usersDoc.data().list || [];
        console.log("PermissionsProvider: Lista de usuários atualizada:", list);
        setAuthorizedUsers(list);
      } else {
        console.warn("PermissionsProvider: Documento 'authorized_users' não encontrado na coleção 'config'");
        setAuthorizedUsers([]);
      }
      setLoading(false);
    }, (error) => {
      console.error("PermissionsProvider: Erro no Firestore:", error);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const currentUserRole = React.useMemo(() => {
    if (!user) {
      console.log("PermissionsProvider: Nenhum usuário logado no AuthContext");
      return null;
    }
    const email = user.email?.toLowerCase();
    const found = authorizedUsers.find(u => u.email.toLowerCase() === email);
    console.log(`PermissionsProvider: Verificando e-mail ${email}. Encontrado:`, found);
    return found ? found.role : null;
  }, [user, authorizedUsers]);

  const isAuthorized = !!currentUserRole;

  const addAuthorizedUser = async (email: string, role: UserRole) => {
    const newList = [...authorizedUsers.filter(u => u.email !== email), {
      email,
      role,
      addedAt: Date.now()
    }];
    await setDoc(doc(db, "config", "authorized_users"), { list: newList });
  };

  const removeAuthorizedUser = async (email: string) => {
    const newList = authorizedUsers.filter(u => u.email !== email);
    await setDoc(doc(db, "config", "authorized_users"), { list: newList });
  };

  return (
    <PermissionsContext.Provider value={{ 
      authorizedUsers, 
      currentUserRole, 
      addAuthorizedUser, 
      removeAuthorizedUser,
      isAuthorized,
      loading
    }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error("usePermissions deve ser usado dentro de um PermissionsProvider");
  }
  return context;
}
