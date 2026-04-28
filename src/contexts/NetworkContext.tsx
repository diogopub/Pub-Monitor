import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { nanoid } from "nanoid";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useAuth } from "./AuthContext";
import { usePermissions } from "./PermissionsContext";
import { sanitizeForFirestore } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────
export type MemberRole = "creative" | "architect" | "3d" | "management";

export interface TeamMember {
  id: string;
  name: string;
  role: MemberRole;
  color: string;
  email?: string;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  status: "active" | "paused" | "completed";
}

export interface Assignment {
  id: string;
  memberId: string;
  projectId: string;
  role: MemberRole;
}

export interface AppSettings {
  googleAppsScriptUrl?: string;
  autoBackupEnabled: boolean;
  notificationEmails?: string[];
}

export interface NetworkState {
  members: TeamMember[];
  projects: Project[];
  assignments: Assignment[];
  settings: AppSettings;
}

interface NetworkContextType {
  state: NetworkState;
  hydrated: boolean;
  // Members
  addMember: (name: string, role: MemberRole, color: string, email?: string) => void;
  updateMember: (id: string, updates: Partial<Omit<TeamMember, "id">>) => void;
  removeMember: (id: string) => void;
  // Projects
  addProject: (name: string, color?: string, status?: Project["status"]) => void;
  updateProject: (id: string, updates: Partial<Omit<Project, "id">>) => void;
  removeProject: (id: string) => void;
  // Assignments
  addAssignment: (memberId: string, projectId: string, role: MemberRole) => void;
  removeAssignment: (id: string) => void;
  removeAssignmentByLink: (memberId: string, projectId: string) => void;
  // Bulk
  setState: (state: NetworkState) => void;
  // Settings
  updateSettings: (updates: Partial<AppSettings>) => void;
}

// ─── Role colors ─────────────────────────────────────────────────
export const ROLE_COLORS: Record<MemberRole, string> = {
  creative: "#dc2626", // Red-600
  architect: "#16a34a", // Green-600
  "3d": "#2563eb", // Blue-600
  management: "#f59e0b", // Amber-500
};

export const ROLE_LABELS: Record<MemberRole, string> = {
  creative: "Criativo",
  architect: "Arquiteto",
  "3d": "3D",
  management: "Gestão",
};

// ─── Helpers ─────────────────────────────────────────────────────
function normalizeNetworkState(data: any): NetworkState {
  const projects: Project[] = Array.isArray(data?.projects) ? data.projects : [];
  
  // Garantir a existência do PUB INTERNO sem gerar loops de renderização
  if (!projects.some(p => p.name === "PUB INTERNO")) {
    projects.push({
      id: nanoid(8),
      name: "PUB INTERNO",
      color: "#ffffff",
      status: "active",
    });
  }

  return {
    members: Array.isArray(data?.members) ? data.members : [],
    projects,
    assignments: Array.isArray(data?.assignments) ? data.assignments : [],
    settings: data?.settings || { autoBackupEnabled: false },
  };
}

// ─── Persistence ─────────────────────────────────────────────────
const STORAGE_KEY = "pub-network-state";

function loadState(): NetworkState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (
        Array.isArray(parsed.members) &&
        Array.isArray(parsed.projects) &&
        Array.isArray(parsed.assignments)
      ) {
        return normalizeNetworkState(parsed);
      }
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return normalizeNetworkState({});
}

function saveState(state: NetworkState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

// ─── Context ─────────────────────────────────────────────────────
const NetworkContext = createContext<NetworkContextType | null>(null);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [state, setStateInternal] = useState<NetworkState>(loadState);
  const [hydrated, setHydrated] = useState(false);
  const { user } = useAuth();
  const { currentUserRole } = usePermissions();

  const canWrite = currentUserRole === "admin" || currentUserRole === "editor";
  const canWriteRef = useRef(canWrite);

  useEffect(() => {
    canWriteRef.current = canWrite;
  }, [canWrite]);

  // ☁️ SYNC FROM CLOUD — real-time listener, merges into local state
  useEffect(() => {
    if (!user) return;

    const docRef = doc(db, "data", "network");
    const unsub = onSnapshot(docRef, (snapshot) => {
      const cloudData = normalizeNetworkState(snapshot.exists() ? snapshot.data() : {});
      setStateInternal(cloudData);
      saveState(cloudData);
      setHydrated(true);
    });

    return () => unsub();
  }, [user]);

  // ☁️ SYNC TO CLOUD
  // O Updater fica puramente local e o side-effect é executado com a ref
  const updateState = useCallback((updater: (prev: NetworkState) => NetworkState) => {
    let nextState: NetworkState | undefined;

    setStateInternal((prev) => {
      nextState = updater(prev);
      saveState(nextState);
      return nextState;
    });

    if (canWriteRef.current && nextState) {
      setDoc(doc(db, "data", "network"), sanitizeForFirestore(nextState)).catch(err => {
        console.error("Network sync error:", err);
      });
    }
  }, []);

  const addMember = useCallback(
    (name: string, role: MemberRole, color: string, email?: string) => {
      updateState((s) => ({
        ...s,
        members: [...s.members, { id: nanoid(8), name, role, color, email }],
      }));
    },
    [updateState]
  );

  const updateMember = useCallback(
    (id: string, updates: Partial<Omit<TeamMember, "id">>) => {
      updateState((s) => ({
        ...s,
        members: s.members.map((m) => (m.id === id ? { ...m, ...updates } : m)),
      }));
    },
    [updateState]
  );

  const removeMember = useCallback(
    (id: string) => {
      updateState((s) => ({
        ...s,
        members: s.members.filter((m) => m.id !== id),
        assignments: s.assignments.filter((a) => a.memberId !== id),
      }));
    },
    [updateState]
  );

  const addProject = useCallback(
    (name: string, color = "#64748b", status: Project["status"] = "active") => {
      updateState((s) => ({
        ...s,
        projects: [...s.projects, { id: nanoid(8), name, color, status }],
      }));
    },
    [updateState]
  );

  const updateProject = useCallback(
    (id: string, updates: Partial<Omit<Project, "id">>) => {
      updateState((s) => ({
        ...s,
        projects: s.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
      }));
    },
    [updateState]
  );

  const removeProject = useCallback(
    (id: string) => {
      updateState((s) => ({
        ...s,
        projects: s.projects.filter((p) => p.id !== id),
        assignments: s.assignments.filter((a) => a.projectId !== id),
      }));
    },
    [updateState]
  );

  const addAssignment = useCallback(
    (memberId: string, projectId: string, role: MemberRole) => {
      updateState((s) => {
        const exists = s.assignments.some(
          (a) => a.memberId === memberId && a.projectId === projectId
        );
        if (exists) return s;
        return {
          ...s,
          assignments: [
            ...s.assignments,
            { id: nanoid(8), memberId, projectId, role },
          ],
        };
      });
    },
    [updateState]
  );

  const removeAssignment = useCallback(
    (id: string) => {
      updateState((s) => ({
        ...s,
        assignments: s.assignments.filter((a) => a.id !== id),
      }));
    },
    [updateState]
  );

  const removeAssignmentByLink = useCallback(
    (memberId: string, projectId: string) => {
      updateState((s) => ({
        ...s,
        assignments: s.assignments.filter(
          (a) => !(a.memberId === memberId && a.projectId === projectId)
        ),
      }));
    },
    [updateState]
  );

  const setState = useCallback(
    (newState: NetworkState) => {
      const validatedState = normalizeNetworkState(newState);
      saveState(validatedState);
      setStateInternal(validatedState);
      
      if (canWriteRef.current) {
        setDoc(doc(db, "data", "network"), sanitizeForFirestore(validatedState)).catch(err => {
          console.error("Network bulk setState error:", err);
        });
      }
    },
    []
  );

  const updateSettings = useCallback(
    (updates: Partial<AppSettings>) => {
      updateState((s) => ({
        ...s,
        settings: { ...s.settings, ...updates },
      }));
    },
    [updateState]
  );

  return (
    <NetworkContext.Provider
      value={{
        state,
        hydrated,
        addMember,
        updateMember,
        removeMember,
        addProject,
        updateProject,
        removeProject,
        addAssignment,
        removeAssignment,
        removeAssignmentByLink,
        setState,
        updateSettings,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error("useNetwork must be used within NetworkProvider");
  return ctx;
}
