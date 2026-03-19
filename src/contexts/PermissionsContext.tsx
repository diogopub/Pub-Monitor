import React, { createContext, useContext, useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { 
  doc, 
  onSnapshot, 
  setDoc, 
  collection,
} from "firebase/firestore";
import { useAuth } from "./AuthContext";

export type UserRole = "admin" | "editor" | "viewer";

export interface AuthorizedUser {
  email: string;
  role: UserRole;
  addedAt: number;
}

export interface PendingUser {
  email: string;
  name?: string;
  photoURL?: string;
  requestedAt: number;
}

interface PermissionsContextType {
  authorizedUsers: AuthorizedUser[];
  pendingUsers: PendingUser[];
  currentUserRole: UserRole | null;
  addAuthorizedUser: (email: string, role: UserRole) => Promise<void>;
  removeAuthorizedUser: (email: string) => Promise<void>;
  requestAccess: (user: { email: string; name?: string; photoURL?: string }) => Promise<void>;
  removePendingRequest: (email: string) => Promise<void>;
  isAuthorized: boolean;
  loading: boolean;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [authorizedUsers, setAuthorizedUsers] = useState<AuthorizedUser[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Load authorized and pending users
  useEffect(() => {
    console.log("PermissionsProvider: Iniciando listener do Firestore...");
    const unsub = onSnapshot(collection(db, "config"), (snapshot) => {
      const usersDoc = snapshot.docs.find(d => d.id === "authorized_users");
      const pendingDoc = snapshot.docs.find(d => d.id === "pending_users");
      
      if (usersDoc) {
        setAuthorizedUsers(usersDoc.data().list || []);
      } else {
        setAuthorizedUsers([]);
      }

      if (pendingDoc) {
        setPendingUsers(pendingDoc.data().list || []);
      } else {
        setPendingUsers([]);
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

  const requestAccess = async (userData: { email: string; name?: string; photoURL?: string }) => {
    // Check if already authorized
    const isAuth = authorizedUsers.find(u => u.email.toLowerCase() === userData.email.toLowerCase());
    if (isAuth) return;

    // Check if already requested
    const alreadyPending = pendingUsers.find(u => u.email.toLowerCase() === userData.email.toLowerCase());
    if (alreadyPending) return;

    const newList = [...pendingUsers, {
      email: userData.email,
      name: userData.name,
      photoURL: userData.photoURL,
      requestedAt: Date.now()
    }];
    await setDoc(doc(db, "config", "pending_users"), { list: newList });
  };

  const removePendingRequest = async (email: string) => {
    const newList = pendingUsers.filter(u => u.email !== email);
    await setDoc(doc(db, "config", "pending_users"), { list: newList });
  };

  return (
    <PermissionsContext.Provider value={{ 
      authorizedUsers, 
      pendingUsers,
      currentUserRole, 
      addAuthorizedUser, 
      removeAuthorizedUser,
      requestAccess,
      removePendingRequest,
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
