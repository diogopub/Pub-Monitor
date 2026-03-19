import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { nanoid } from "nanoid";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useAuth } from "./AuthContext";
import { usePermissions } from "./PermissionsContext";
import { sanitizeForFirestore } from "@/lib/utils";
import { 
  createGoogleEvent, 
  updateGoogleEvent, 
  deleteGoogleEvent, 
  formatEntryForGoogle 
} from "@/lib/googleCalendar";

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
  { id: "entrega-pub", label: "Entrega PUB", color: "#2563eb", textColor: "#fff" },
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
  googleEventId?: string; // ID of the corresponding Google Calendar event
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
  addEntry: (memberId: string, date: string, activityId: string, projectId?: string, customLabel?: string, duration?: number, slotIndex?: number, startOffset?: number) => void;
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
      return {
        entries: parsed.entries || [],
        specialRows: parsed.specialRows || DEFAULT_SPECIAL_ROWS,
        weeklyRosters: parsed.weeklyRosters || {},
      };
    }
  } catch { /* ignore */ }
  return { entries: DEFAULT_ENTRIES, specialRows: DEFAULT_SPECIAL_ROWS, weeklyRosters: {} };
}

function saveState(state: ScheduleState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

const ScheduleContext = createContext<ScheduleContextType | null>(null);

export function ScheduleProvider({ children }: { children: React.ReactNode }) {
  const [state, setStateInternal] = useState<ScheduleState>(loadState);
  const { user, accessToken } = useAuth();
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
      saveState(next);
      if (!isSyncingFromCloud.current && (currentUserRole === "admin" || currentUserRole === "editor")) {
        setDoc(doc(db, "data", "schedule"), sanitizeForFirestore(next));
      }
      return next;
    });
  }, [currentUserRole]);

  const updateEntry = useCallback((id: string, updates: Partial<ScheduleEntry>) => {
    updateState((s) => {
      const entry = s.entries.find(e => e.id === id);
      if (!entry) return s;

      const updatedEntry = { ...entry, ...updates };

      // Sync to Google
      if (accessToken && updatedEntry.googleEventId) {
        const allActs = [...ACTIVITY_TYPES, ...ENTRADAS_ACTIVITIES];
        const activity = allActs.find(a => a.id === updatedEntry.activityId);
        const gEvent = formatEntryForGoogle(
          updatedEntry.date,
          updatedEntry.duration || 1,
          updatedEntry.customLabel || activity?.label || "Atividade",
          "Sincronizado via PUB Monitor",
          activity?.color
        );
        updateGoogleEvent(accessToken, updatedEntry.googleEventId, gEvent);
      }

      return {
        ...s,
        entries: s.entries.map(e => e.id === id ? updatedEntry : e),
      };
    });
  }, [updateState, accessToken]);

  const addEntry = useCallback(
    (memberId: string, date: string, activityId: string, projectId?: string, customLabel?: string, duration?: number, slotIndex?: number, startOffset?: number) => {
      const entryId = nanoid(8);
      
      updateState((s) => {
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
        while (takenSlots.has(autoSlot) && autoSlot < 3) autoSlot++;

        const newEntry: ScheduleEntry = { 
          id: entryId, 
          memberId, 
          date, 
          activityId, 
          projectId, 
          customLabel, 
          duration: duration ?? 1, 
          slotIndex: slotIndex ?? autoSlot, 
          startOffset: startOffset ?? 0 
        };

        // Sync to Google
        if (accessToken) {
          const allActs = [...ACTIVITY_TYPES, ...ENTRADAS_ACTIVITIES];
          const activity = allActs.find(a => a.id === activityId);
          const gEvent = formatEntryForGoogle(
            date, 
            duration ?? 1, 
            customLabel || activity?.label || "Atividade",
            "Sincronizado via PUB Monitor",
            activity?.color
          );
          
          createGoogleEvent(accessToken, gEvent).then(gId => {
            if (gId) {
              updateEntry(entryId, { googleEventId: gId });
            }
          });
        }

        return {
          ...s,
          entries: [...s.entries, newEntry],
        };
      });
    },
    [updateState, accessToken, updateEntry]
  );

  const removeEntry = useCallback(
    (id: string) => {
      updateState((s) => {
        const entry = s.entries.find(e => e.id === id);
        if (accessToken && entry?.googleEventId) {
          deleteGoogleEvent(accessToken, entry.googleEventId);
        }
        return {
          ...s,
          entries: s.entries.filter((e) => e.id !== id),
        };
      });
    },
    [updateState, accessToken]
  );

  const removeEntriesByCell = useCallback(
    (memberId: string, date: string) => {
      updateState((s) => {
        const cellEntries = s.entries.filter(e => e.memberId === memberId && e.date === date);
        if (accessToken) {
          cellEntries.forEach(e => {
            if (e.googleEventId) deleteGoogleEvent(accessToken, e.googleEventId);
          });
        }
        return {
          ...s,
          entries: s.entries.filter((e) => !(e.memberId === memberId && e.date === date)),
        };
      });
    },
    [updateState, accessToken]
  );

  const getEntriesForCell = useCallback(
    (memberId: string, date: string) => {
      return state.entries.filter((e) => e.memberId === memberId && e.date === date);
    },
    [state.entries]
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
