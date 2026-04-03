import React, { createContext, useContext, useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
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
  const { user, loading: authLoading } = useAuth();
  const [authorizedUsers, setAuthorizedUsers] = useState<AuthorizedUser[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Two independent listeners on specific documents — avoids fetching the whole collection
  useEffect(() => {
    // Wait for Firebase Auth to resolve before starting Firestore listeners
    // to avoid a race where `user` is null while onAuthStateChanged is still pending.
    if (authLoading) return;

    const unsubUsers = onSnapshot(
      doc(db, "config", "authorized_users"),
      (snapshot) => {
        setAuthorizedUsers(snapshot.exists() ? (snapshot.data().list || []) : []);
        setLoading(false);
      },
      (error) => {
        console.error("PermissionsProvider: Erro ao carregar authorized_users:", error);
        setLoading(false);
      }
    );

    const unsubPending = onSnapshot(
      doc(db, "config", "pending_users"),
      (snapshot) => {
        setPendingUsers(snapshot.exists() ? (snapshot.data().list || []) : []);
      },
      (error) => {
        console.error("PermissionsProvider: Erro ao carregar pending_users:", error);
      }
    );

    return () => {
      unsubUsers();
      unsubPending();
    };
  }, [authLoading]);

  // Role is derived exclusively from Firestore — no hardcoded admin fallback
  const currentUserRole = React.useMemo(() => {
    if (!user) return null;
    const email = user.email?.toLowerCase();
    if (!email) return null;
    const found = authorizedUsers.find(u => u.email.toLowerCase() === email);
    return found ? found.role : null;
  }, [user, authorizedUsers]);

  const isAuthorized = !!currentUserRole;

  // Combine Firestore loading with auth loading so consumers see a single boolean
  const isLoading = loading || (authLoading ?? false);

  // ─── Write helpers — read from Firestore before writing to avoid concurrent overwrites ──

  const addAuthorizedUser = async (email: string, role: UserRole) => {
    const ref = doc(db, "config", "authorized_users");
    const snapshot = await getDoc(ref);
    const currentList: AuthorizedUser[] = snapshot.exists() ? (snapshot.data().list || []) : [];
    const newList = [
      ...currentList.filter(u => u.email.toLowerCase() !== email.toLowerCase()),
      { email: email.toLowerCase(), role, addedAt: Date.now() }
    ];
    await setDoc(ref, { list: newList });
  };

  const removeAuthorizedUser = async (email: string) => {
    const ref = doc(db, "config", "authorized_users");
    const snapshot = await getDoc(ref);
    const currentList: AuthorizedUser[] = snapshot.exists() ? (snapshot.data().list || []) : [];
    const newList = currentList.filter(u => u.email.toLowerCase() !== email.toLowerCase());
    await setDoc(ref, { list: newList });
  };

  const requestAccess = async (userData: { email: string; name?: string; photoURL?: string }) => {
    const normalizedEmail = userData.email.toLowerCase();

    // Check if already authorized
    const isAuth = authorizedUsers.find(u => u.email.toLowerCase() === normalizedEmail);
    if (isAuth) return;

    // Check if already requested
    const alreadyPending = pendingUsers.find(u => u.email.toLowerCase() === normalizedEmail);
    if (alreadyPending) return;

    const ref = doc(db, "config", "pending_users");
    const snapshot = await getDoc(ref);
    const currentList: PendingUser[] = snapshot.exists() ? (snapshot.data().list || []) : [];

    const newList = [
      ...currentList.filter(u => u.email.toLowerCase() !== normalizedEmail),
      {
        email: normalizedEmail, // normalized at save time
        name: userData.name,
        photoURL: userData.photoURL,
        requestedAt: Date.now()
      }
    ];
    await setDoc(ref, { list: newList });
  };

  const removePendingRequest = async (email: string) => {
    const ref = doc(db, "config", "pending_users");
    const snapshot = await getDoc(ref);
    const currentList: PendingUser[] = snapshot.exists() ? (snapshot.data().list || []) : [];
    const newList = currentList.filter(u => u.email.toLowerCase() !== email.toLowerCase());
    await setDoc(ref, { list: newList });
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
      loading: isLoading
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
