import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { nanoid } from "nanoid";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useAuth } from "./AuthContext";
import { usePermissions } from "./PermissionsContext";
import { sanitizeForFirestore } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────
export type MemberRole = "creative" | "architect" | "3d";

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
}

export interface NetworkState {
  members: TeamMember[];
  projects: Project[];
  assignments: Assignment[];
  settings: AppSettings;
}

interface NetworkContextType {
  state: NetworkState;
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
  creative: "#dc2626",
  architect: "#16a34a",
  "3d": "#7c3aed",
};

export const ROLE_LABELS: Record<MemberRole, string> = {
  creative: "Criativo",
  architect: "Arquiteto",
  "3d": "3D",
};

// ─── Default data ────────────────────────────────────────────────
const defaultMembers: TeamMember[] = [
  { id: "m1", name: "Rod", role: "creative", color: "#dc2626", email: "rod@thepublic.house" },
  { id: "m2", name: "Paula", role: "architect", color: "#16a34a" },
  { id: "m3", name: "Paola", role: "architect", color: "#16a34a", email: "paola@thepublic.house" },
  { id: "m4", name: "Marcel", role: "3d", color: "#2563eb", email: "marcel@thepublic.house" },
  { id: "m5", name: "Julio", role: "3d", color: "#2563eb", email: "julio@thepublic.house" },
  { id: "m6", name: "Evandro", role: "3d", color: "#2563eb", email: "evandro@thepublic.house" },
  { id: "m7", name: "Mari", role: "3d", color: "#2563eb", email: "mariana@thepublic.house" },
  { id: "TdyNfZ0C", name: "Vinicius", role: "creative", color: "#7c3aed" }
];

const defaultProjects: Project[] = [
  { id: "8IkoPBzY", name: "GULOZITOS", color: "#64748b", status: "active" },
  { id: "GPhSiPJl", name: "SESC SENAC", color: "#64748b", status: "active" },
  { id: "VLEC3mz6", name: "TIKTOK", color: "#64748b", status: "active" },
  { id: "2S4yXlfs", name: "TNS SUMMIT", color: "#64748b", status: "active" },
  { id: "tNT6ivzP", name: "BEFLY BE TOGETHER", color: "#64748b", status: "active" },
  { id: "2iJoYkNk", name: "MBRF", color: "#64748b", status: "active" },
  { id: "Kyx_zt5V", name: "NESTLÉ", color: "#64748b", status: "active" },
  { id: "zwTpeSmf", name: "HONDA INTERLAGOS", color: "#64748b", status: "completed" },
  { id: "TorDd7bS", name: "GEELY EX5", color: "#64748b", status: "completed" },
  { id: "aXJB3qkC", name: "KITKAT RIR", color: "#64748b", status: "completed" },
  { id: "3ge1eg7M", name: "BOTICÁRIO DIA MÃES", color: "#64748b", status: "completed" },
  { id: "5x0gQuhc", name: "JETOUR", color: "#64748b", status: "completed" },
  { id: "94ngjY7L", name: "PBSF PACAEMBU", color: "#64748b", status: "completed" },
  { id: "PyiUJCTY", name: "P&G PDV", color: "#64748b", status: "completed" },
  { id: "3JsUW-c9", name: "TIM RIR", color: "#64748b", status: "completed" },
  { id: "PVcrCz_L", name: "MERCEDES 70 ANOS", color: "#64748b", status: "completed" },
  { id: "K51HlkO1", name: "ZAMP", color: "#64748b", status: "completed" },
  { id: "6ytgKP2r", name: "MBRF", color: "#64748b", status: "completed" },
  { id: "Gjb1Y4YF", name: "OTO SYNGENTA", color: "#64748b", status: "completed" },
  { id: "OYuO3QyQ", name: "CLARO RIO OPEN", color: "#64748b", status: "completed" },
  { id: "Ft6-CNpK", name: "PIRACANJUBA", color: "#64748b", status: "completed" },
  { id: "zLLNiirf", name: "XP RIO OPEN", color: "#64748b", status: "completed" },
  { id: "R0Do3qf0", name: "HAVAIANAS", color: "#64748b", status: "completed" },
  { id: "UJIlYtn9", name: "CIELO LOLLA", color: "#64748b", status: "completed" },
  { id: "JdodsLuE", name: "FORD INTERLAGOS", color: "#64748b", status: "active" },
  { id: "Wr72p_7y", name: "COCA COLA NATAL", color: "#64748b", status: "active" },
  { id: "n6yC51hh", name: "TCL GAMES COM", color: "#64748b", status: "active" },
  { id: "VYp2d9kn", name: "MERCEDES FENATRAN", color: "#64748b", status: "active" },
  { id: "Epfz7_ji", name: "SANTANDER INTERLAGOS", color: "#64748b", status: "active" }
];

const defaultAssignments: Assignment[] = [
  { id: "qbIXKpGv", memberId: "m2", projectId: "2iJoYkNk", role: "architect" }
];

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
        return parsed;
      }
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return {
    members: defaultMembers,
    projects: defaultProjects,
    assignments: defaultAssignments,
    settings: {
      autoBackupEnabled: false,
    },
  };
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
  const { user } = useAuth();
  const { currentUserRole } = usePermissions();
  const isInitialMount = useRef(true);
  const isSyncingFromCloud = useRef(false);

  // ☁️ SYNC FROM CLOUD
  useEffect(() => {
    if (!user) return;

    const docRef = doc(db, "data", "network");
    const unsub = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const cloudData = snapshot.data() as NetworkState;
        isSyncingFromCloud.current = true;
        setStateInternal(cloudData);
        saveState(cloudData); // Keeps local backup
        setTimeout(() => { isSyncingFromCloud.current = false; }, 100);
      }
    });

    return () => unsub();
  }, [user]);

  // ☁️ SYNC TO CLOUD
  const updateState = useCallback((updater: (prev: NetworkState) => NetworkState) => {
    setStateInternal((prev) => {
      const next = updater(prev);
      saveState(next);

      // Only push to cloud if NOT currently receiving an update FROM cloud
      // and if user has permission to edit
      if (!isSyncingFromCloud.current && (currentUserRole === "admin" || currentUserRole === "editor")) {
        setDoc(doc(db, "data", "network"), sanitizeForFirestore(next)).catch(err => {
          console.error("Erro ao salvar no Firestore:", err);
        });
      }

      return next;
    });
  }, [currentUserRole]);

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
      const validatedState: NetworkState = {
        members: newState.members || [],
        projects: newState.projects || [],
        assignments: newState.assignments || [],
        settings: newState.settings || { autoBackupEnabled: false },
      };
      saveState(validatedState);
      setStateInternal(validatedState);
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

  // 🛡️ Ensure PUB INTERNO exists in projects for graph connections
  useEffect(() => {
    if (state.projects.length > 0 && !state.projects.some(p => p.name === "PUB INTERNO")) {
      addProject("PUB INTERNO", "#ffffff");
    }
  }, [state.projects, addProject]);

  return (
    <NetworkContext.Provider
      value={{
        state,
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
