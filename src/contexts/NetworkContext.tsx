import React, { createContext, useContext, useState, useCallback } from "react";
import { nanoid } from "nanoid";

// ─── Types ───────────────────────────────────────────────────────
export type MemberRole = "creative" | "architect" | "3d";

export interface TeamMember {
  id: string;
  name: string;
  role: MemberRole;
  color: string;
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

export interface NetworkState {
  members: TeamMember[];
  projects: Project[];
  assignments: Assignment[];
}

interface NetworkContextType {
  state: NetworkState;
  // Members
  addMember: (name: string, role: MemberRole, color: string) => void;
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
  { id: "m1", name: "Rod", role: "creative", color: "#dc2626" },
  { id: "m2", name: "Paula", role: "architect", color: "#16a34a" },
  { id: "m3", name: "Paola", role: "architect", color: "#16a34a" },
  { id: "m4", name: "Marcel", role: "3d", color: "#2563eb" },
  { id: "m5", name: "Julio", role: "3d", color: "#2563eb" },
  { id: "m6", name: "Evandro", role: "3d", color: "#2563eb" },
  { id: "m7", name: "Mari", role: "3d", color: "#2563eb" },
];

const defaultProjects: Project[] = [
  { id: "p1", name: "GULOZITOS", color: "#64748b", status: "active" },
  { id: "p2", name: "MBRF", color: "#64748b", status: "active" },
  { id: "p3", name: "TIKTOK", color: "#64748b", status: "active" },
  { id: "p4", name: "SESC SENAC", color: "#64748b", status: "active" },
  { id: "p5", name: "TNS SUMMIT", color: "#64748b", status: "active" },
  { id: "p6", name: "BEFLY", color: "#64748b", status: "active" },
  { id: "p7", name: "HONDA", color: "#64748b", status: "active" },
];

const defaultAssignments: Assignment[] = [
  // GULOZITOS
  { id: "a1", memberId: "m1", projectId: "p1", role: "creative" },
  { id: "a2", memberId: "m3", projectId: "p1", role: "architect" },
  { id: "a3", memberId: "m4", projectId: "p1", role: "3d" },
  // MBRF
  { id: "a4", memberId: "m1", projectId: "p2", role: "creative" },
  { id: "a5", memberId: "m2", projectId: "p2", role: "architect" },
  { id: "a6", memberId: "m6", projectId: "p2", role: "3d" },
  // TIKTOK
  { id: "a7", memberId: "m1", projectId: "p3", role: "creative" },
  { id: "a8", memberId: "m3", projectId: "p3", role: "architect" },
  { id: "a9", memberId: "m4", projectId: "p3", role: "3d" },
  // SESC SENAC
  { id: "a10", memberId: "m1", projectId: "p4", role: "creative" },
  { id: "a11", memberId: "m2", projectId: "p4", role: "architect" },
  { id: "a12", memberId: "m5", projectId: "p4", role: "3d" },
  // TNS SUMMIT
  { id: "a13", memberId: "m1", projectId: "p5", role: "creative" },
  { id: "a14", memberId: "m2", projectId: "p5", role: "architect" },
  { id: "a15", memberId: "m6", projectId: "p5", role: "3d" },
  { id: "a16", memberId: "m5", projectId: "p5", role: "3d" },
  // BEFLY
  { id: "a17", memberId: "m1", projectId: "p6", role: "creative" },
  { id: "a18", memberId: "m3", projectId: "p6", role: "architect" },
  { id: "a19", memberId: "m6", projectId: "p6", role: "3d" },
  // HONDA
  { id: "a20", memberId: "m1", projectId: "p7", role: "creative" },
  { id: "a21", memberId: "m2", projectId: "p7", role: "architect" },
  { id: "a22", memberId: "m4", projectId: "p7", role: "3d" },
  { id: "a23", memberId: "m5", projectId: "p7", role: "3d" },
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

  const updateState = useCallback((updater: (prev: NetworkState) => NetworkState) => {
    setStateInternal((prev) => {
      const next = updater(prev);
      saveState(next);
      return next;
    });
  }, []);

  const addMember = useCallback(
    (name: string, role: MemberRole, color: string) => {
      updateState((s) => ({
        ...s,
        members: [...s.members, { id: nanoid(8), name, role, color }],
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
      saveState(newState);
      setStateInternal(newState);
    },
    []
  );

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
