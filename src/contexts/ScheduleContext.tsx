import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { nanoid } from "nanoid";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useAuth } from "./AuthContext";
import { usePermissions } from "./PermissionsContext";
import { sanitizeForFirestore } from "@/lib/utils";

// ─── Activity Types with exact colors from reference ─────────────
export interface ActivityType {
  id: string;
  label: string;
  color: string; // background color
  textColor: string; // text color for contrast
}

export const ACTIVITY_TYPES: ActivityType[] = [
  { id: "comunicacao-visual", label: "COMUNICAÇÃO VISUAL", color: "#16a34a", textColor: "#fff" },
  { id: "task", label: "TASK", color: "#f87171", textColor: "#fff" },
  { id: "criacao", label: "CRIAÇÃO", color: "#e11d48", textColor: "#fff" },
  { id: "canva", label: "CANVA", color: "#6b7280", textColor: "#fff" },
  { id: "ia", label: "IA", color: "#d1d5db", textColor: "#000" },
  { id: "planta", label: "PLANTA", color: "#34d399", textColor: "#fff" },
  { id: "descritivo", label: "DESCRITIVO", color: "#0d9488", textColor: "#fff" },
  { id: "executivo", label: "EXECUTIVO", color: "#67e8f9", textColor: "#000" },
  { id: "3d", label: "3D", color: "#60a5fa", textColor: "#fff" },
  { id: "pos", label: "PÓS", color: "#d9f99d", textColor: "#000" },
  { id: "video", label: "VÍDEO", color: "#e879f9", textColor: "#fff" },
  { id: "orcamento", label: "ORÇAMENTO", color: "#fb923c", textColor: "#fff" },
  { id: "dayoff", label: "DAYOFF", color: "#92400e", textColor: "#fff" },
];

export const ENTRADAS_ACTIVITIES: ActivityType[] = [
  { id: "apresentacao-cliente", label: "Apresentação Cliente", color: "#7c3aed", textColor: "#fff" },
  { id: "entrega-pub", label: "Entrega PUB", color: "#737373", textColor: "#fff" },
  { id: "feedback-interno", label: "Feedback Interno", color: "#db2777", textColor: "#fff" },
];

// ─── Schedule Entry ──────────────────────────────────────────────
export interface ScheduleEntry {
  id: string;
  memberId: string; // team member ID or special row ID
  date: string; // ISO date string YYYY-MM-DD
  activityId: string; // reference to ACTIVITY_TYPES
  projectId?: string; // optional project reference
  customLabel?: string; // optional custom label overriding project name + activity
  duration?: number; // length in slots, where 1 slot = 1 column wide
  slotIndex?: number; // 0, 1, or 2 for the vertical position
  startOffset?: number; // 0 or 0.5 for half-slot horizontal positioning
  googleEventIds?: string[]; // IDs of the events created in Google Calendar
}

// ─── Special Rows ────────────────────────────────────────────────
export interface SpecialRow {
  id: string;
  name: string;
  type: "freelancer" | "entradas-entregas";
}

export const DEFAULT_SPECIAL_ROWS: SpecialRow[] = [
  { "id": "sr-freelancer-1", "name": "Freelancer 1", "type": "freelancer" },
  { "id": "sr-freelancer-2", "name": "Freelancer 2", "type": "freelancer" },
  { "id": "sr-entradas", "name": "Entradas e Entregas", "type": "entradas-entregas" }
];

const DEFAULT_ENTRIES: ScheduleEntry[] = [];

// ─── State ───────────────────────────────────────────────────────
export interface ScheduleState {
  entries: ScheduleEntry[];
  specialRows: SpecialRow[];
  weeklyRosters: Record<string, string[]>;
}

interface ScheduleContextType {
  state: ScheduleState;
  addEntry: (memberId: string, date: string, activityId: string, projectId?: string, customLabel?: string, duration?: number, slotIndex?: number, startOffset?: number, id?: string) => void;
  updateEntry: (id: string, updates: Partial<ScheduleEntry>) => void;
  removeEntry: (id: string) => void;
  removeEntriesByCell: (memberId: string, date: string) => void;
  getEntriesForCell: (memberId: string, date: string) => ScheduleEntry[];
  addSpecialRow: (name: string, type: SpecialRow["type"]) => void;
  removeSpecialRow: (id: string) => void;
  updateSpecialRow: (id: string, name: string) => void;
  setState: (state: ScheduleState) => void;
  getWeekRoster: (weekKey: string, allMemberIds: string[]) => string[];
  setWeekRoster: (weekKey: string, memberIds: string[]) => void;
}

const STORAGE_KEY = "pub-schedule-state";

function loadState(): ScheduleState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed.entries)) {
        // PREVENT INITIAL DUPLICATES
        const seen = new Set<string>();
        const uniqueEntries = (parsed.entries as ScheduleEntry[]).filter((e) => {
          // Deduplicate by ID
          if (!e.id || seen.has(e.id)) return false;
          
          // Deduplicate by EXACT identical content (member, date, project, activity, slot, offset)
          // This is a safety measure for corrupted data
          const contentKey = `${e.memberId}-${e.date}-${e.projectId}-${e.activityId}-${e.slotIndex}-${e.startOffset}`;
          if (seen.has(contentKey)) return false;
          
          seen.add(e.id);
          seen.add(contentKey);
          return true;
        });

        return {
          entries: uniqueEntries,
          specialRows: parsed.specialRows || DEFAULT_SPECIAL_ROWS,
          weeklyRosters: parsed.weeklyRosters || {},
        };
      }
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return {
    entries: [],
    specialRows: DEFAULT_SPECIAL_ROWS,
    weeklyRosters: {},
  };
}

function saveState(state: ScheduleState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

const ScheduleContext = createContext<ScheduleContextType | null>(null);

export function ScheduleProvider({ children }: { children: React.ReactNode }) {
  const [state, setStateInternal] = useState<ScheduleState>(loadState);
  const { user } = useAuth();
  const { currentUserRole } = usePermissions();
  const isSyncingFromCloud = useRef(false);

  useEffect(() => {
    if (!user) return;
    const docRef = doc(db, "data", "schedule");
    const unsub = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const cloudData = snapshot.data() as ScheduleState;
        isSyncingFromCloud.current = true;
        setStateInternal(cloudData);
        saveState(cloudData);
        setTimeout(() => { isSyncingFromCloud.current = false; }, 100);
      }
    });
    return () => unsub();
  }, [user]);

  const updateState = useCallback((updater: (prev: ScheduleState) => ScheduleState) => {
    setStateInternal((prev) => {
      const next = updater(prev);
      
      // Keep local backup
      saveState(next);
      
      // Async push to Firestore (MOVE OUTSIDE THE UPDATER)
      // We use a small delay or a separate call to ensure we're not inside the React update cycle
      if (!isSyncingFromCloud.current && (currentUserRole === "admin" || currentUserRole === "editor")) {
        // We can't await here, but we can launch it.
        // Moving it to a separate task keeps the state updater pure.
        Promise.resolve().then(() => {
          setDoc(doc(db, "data", "schedule"), sanitizeForFirestore(next)).catch(err => {
            console.error("Firestore sync error:", err);
            // Optional: toast.error("Erro ao sincronizar com nuvem");
          });
        });
      }
      
      return next;
    });
  }, [currentUserRole]);

  const removeEntry = useCallback(
    (id: string) => {
      updateState((s) => ({
        ...s,
        entries: s.entries.filter((e) => e.id !== id),
      }));
    },
    [updateState]
  );

  const updateEntry = useCallback((id: string, updates: Partial<ScheduleEntry>) => {
    updateState((s) => ({
      ...s,
      entries: s.entries.map(e => e.id === id ? { ...e, ...updates } : e),
    }));
  }, [updateState]);

  const removeEntriesByCell = useCallback(
    (memberId: string, date: string) => {
      updateState((s) => ({
        ...s,
        entries: s.entries.filter((e) => !(e.memberId === memberId && e.date === date)),
      }));
    },
    [updateState]
  );

  const getEntriesForCell = useCallback(
    (memberId: string, date: string) => {
      // Return entries for this cell, ensuring we don't return duplicates even if they exist in state
      const cellEntries = state.entries.filter((e) => e.memberId === memberId && e.date === date);
      // Optional: Deduplicate by ID just in case
      const seen = new Set();
      return cellEntries.filter(e => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });
    },
    [state.entries]
  );

  const addEntry = useCallback(
    (memberId: string, date: string, activityId: string, projectId?: string, customLabel?: string, duration?: number, slotIndex?: number, startOffset?: number, id?: string) => {
      updateState((s) => {
        // PREVENT EXACT DUPLICATES (same project, member, date, activity)
        // This stops the '3 repetidos' issue if they are truly identical content.
        const isDuplicate = s.entries.some(e => 
          e.memberId === memberId && 
          e.date === date && 
          e.projectId === projectId && 
          e.activityId === activityId &&
          (slotIndex === undefined || e.slotIndex === slotIndex)
        );
        if (isDuplicate) return s;

        const memberEntries = s.entries.filter(e => e.memberId === memberId);
        const takenSlots = new Set<number>();
        const targetDate = new Date(date + "T12:00:00Z");

        memberEntries.forEach(e => {
          const dStart = new Date(e.date + "T12:00:00Z");
          const dur = e.duration || 1;
          const dEnd = new Date(e.date + "T12:00:00Z");
          dEnd.setDate(dEnd.getDate() + Math.ceil(dur) - 1);

          if (targetDate >= dStart && targetDate <= dEnd) {
            takenSlots.add(e.slotIndex || 0);
          }
        });

        let autoSlot = 0;
        while (takenSlots.has(autoSlot) && autoSlot < 10) autoSlot++; // increased max slots to find free one

        const newEntry: ScheduleEntry = { 
          id: id || nanoid(8), 
          memberId, 
          date, 
          activityId, 
          projectId, 
          customLabel, 
          duration: duration ?? 1, 
          slotIndex: slotIndex ?? autoSlot, 
          startOffset: startOffset ?? 0 
        };

        return {
          ...s,
          entries: [...s.entries, newEntry],
        };
      });
    },
    [updateState]
  );

  const addSpecialRow = useCallback(
    (name: string, type: SpecialRow["type"]) => {
      updateState((s) => ({
        ...s,
        specialRows: [...s.specialRows, { id: nanoid(8), name, type }],
      }));
    },
    [updateState]
  );

  const removeSpecialRow = useCallback(
    (id: string) => {
      updateState((s) => ({
        ...s,
        specialRows: s.specialRows.filter((r) => r.id !== id),
        entries: s.entries.filter((e) => e.memberId !== id),
      }));
    },
    [updateState]
  );

  const updateSpecialRow = useCallback(
    (id: string, name: string) => {
      updateState((s) => ({
        ...s,
        specialRows: s.specialRows.map((r) => (r.id === id ? { ...r, name } : r)),
      }));
    },
    [updateState]
  );

  const getWeekRoster = useCallback(
    (weekKey: string, allMemberIds: string[]): string[] => {
      const rosters = state.weeklyRosters || {};
      if (rosters[weekKey]) return rosters[weekKey];
      const editedKeys = Object.keys(rosters).filter((k) => k < weekKey);
      if (editedKeys.length === 0) return allMemberIds;
      editedKeys.sort((a, b) => (a > b ? -1 : 1));
      return rosters[editedKeys[0]];
    },
    [state.weeklyRosters]
  );

  const setWeekRoster = useCallback(
    (weekKey: string, memberIds: string[]) => {
      updateState((s) => ({
        ...s,
        weeklyRosters: { ...s.weeklyRosters, [weekKey]: memberIds },
      }));
    },
    [updateState]
  );

  const setStateBulk = useCallback((newState: ScheduleState) => {
    const validatedState: ScheduleState = {
      entries: newState.entries || [],
      specialRows: newState.specialRows || DEFAULT_SPECIAL_ROWS,
      weeklyRosters: newState.weeklyRosters || {},
    };
    saveState(validatedState);
    setStateInternal(validatedState);
  }, []);

  return (
    <ScheduleContext.Provider
      value={{
        state,
        addEntry,
        updateEntry,
        removeEntry,
        removeEntriesByCell,
        getEntriesForCell,
        addSpecialRow,
        removeSpecialRow,
        updateSpecialRow,
        setState: setStateBulk,
        getWeekRoster,
        setWeekRoster,
      }}
    >
      {children}
    </ScheduleContext.Provider>
  );
}

export function useSchedule() {
  const ctx = useContext(ScheduleContext);
  if (!ctx) throw new Error("useSchedule must be used within ScheduleProvider");
  return ctx;
}
