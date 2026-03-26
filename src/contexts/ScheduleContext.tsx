import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { nanoid } from "nanoid";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  updateDoc,
  writeBatch,
  getDocs,
} from "firebase/firestore";
import { useAuth } from "./AuthContext";
import { usePermissions } from "./PermissionsContext";
import { sanitizeForFirestore } from "@/lib/utils";

// ─── Activity Types ───────────────────────────────────────────────
export interface ActivityType {
  id: string;
  label: string;
  color: string;
  textColor: string;
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
  { id: "reuniao-cliente", label: "REUNIÃO CLIENTE", color: "#a855f7", textColor: "#fff" },
  { id: "orcamento", label: "ORÇAMENTO", color: "#fb923c", textColor: "#fff" },
  { id: "dayoff", label: "DAYOFF", color: "#92400e", textColor: "#fff" },
];

export const ENTRADAS_ACTIVITIES: ActivityType[] = [
  { id: "apresentacao-cliente", label: "APRESENTAÇÃO CLIENTE", color: "#f9a825", textColor: "#000" },
  { id: "entrega-pub", label: "ENTREGA PUB", color: "#737373", textColor: "#fff" },
  { id: "reuniao-cliente", label: "REUNIÃO CLIENTE", color: "#a855f7", textColor: "#fff" },
  { id: "briefing", label: "BRIEFING", color: "#1a237e", textColor: "#fff" },
];

// ─── Schedule Entry ───────────────────────────────────────────────
export interface ScheduleEntry {
  id: string;
  memberId: string;
  date: string;
  activityId: string;
  projectId?: string;
  customLabel?: string;
  duration?: number;    // int slots [1–8] when startSlot is set; float fraction otherwise (legacy)
  slotIndex?: number;   // row stacking index: 0, 1, 2
  startOffset?: number; // kept for GCal / legacy; = startSlot / SCHEDULE_SLOTS when new system
  startSlot?: number;   // integer 0–7; presence marks new 8-slot system
  googleEventIds?: string[];
}

// ─── Special Rows ─────────────────────────────────────────────────
export interface SpecialRow {
  id: string;
  name: string;
  type: "freelancer" | "entradas-entregas";
}

export const DEFAULT_SPECIAL_ROWS: SpecialRow[] = [
  { id: "sr-freelancer-1", name: "Freelancer 1", type: "freelancer" },
  { id: "sr-freelancer-2", name: "Freelancer 2", type: "freelancer" },
  { id: "sr-entradas", name: "Entradas e Entregas", type: "entradas-entregas" },
];

// ─── State ────────────────────────────────────────────────────────
export interface ScheduleState {
  entries: ScheduleEntry[];
  specialRows: SpecialRow[];
  weeklyRosters: Record<string, string[]>;
}

interface ScheduleContextType {
  state: ScheduleState;
  addEntry: (memberId: string, date: string, activityId: string, projectId?: string, customLabel?: string, duration?: number, slotIndex?: number, startOffset?: number, id?: string, startSlot?: number, googleEventIds?: string[]) => void;
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

const ENTRIES_COLLECTION = "schedule_entries";
const META_DOC = "schedule_meta";
const STORAGE_KEY = "pub-schedule-state-v2";

function loadLocalState(): ScheduleState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed.entries)) {
        const seen = new Set<string>();
        const uniqueEntries = (parsed.entries as ScheduleEntry[]).filter(e => {
          if (!e.id || seen.has(e.id)) return false;
          seen.add(e.id);
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
  return { entries: [], specialRows: DEFAULT_SPECIAL_ROWS, weeklyRosters: {} };
}

function saveLocalState(state: ScheduleState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

const ScheduleContext = createContext<ScheduleContextType | null>(null);

export function ScheduleProvider({ children }: { children: React.ReactNode }) {
  const [state, setStateInternal] = useState<ScheduleState>(loadLocalState);
  const { user } = useAuth();
  const { currentUserRole } = usePermissions();
  const canWrite = currentUserRole === "admin" || currentUserRole === "editor";

  // ☁️ Sync entries
  useEffect(() => {
    if (!user) return;
    const entriesCol = collection(db, ENTRIES_COLLECTION);
    return onSnapshot(entriesCol, (snapshot) => {
      const entries: ScheduleEntry[] = [];
      snapshot.forEach(d => {
        const data = d.data() as ScheduleEntry;
        if (data.id) entries.push(data);
      });
      setStateInternal(prev => {
        const next = { ...prev, entries };
        saveLocalState(next);
        return next;
      });
    });
  }, [user]);

  // ☁️ Sync meta
  useEffect(() => {
    if (!user) return;
    const metaRef = doc(db, "data", META_DOC);
    return onSnapshot(metaRef, (snapshot) => {
      if (snapshot.exists()) {
        const meta = snapshot.data();
        setStateInternal(prev => {
          const next = {
            ...prev,
            specialRows: meta.specialRows || DEFAULT_SPECIAL_ROWS,
            weeklyRosters: meta.weeklyRosters || {},
          };
          saveLocalState(next);
          return next;
        });
      }
    });
  }, [user]);

  // Operations
  const addEntry = useCallback(
    (memberId: string, date: string, activityId: string, projectId?: string, customLabel?: string, duration?: number, slotIndex?: number, startOffset?: number, id?: string, startSlot?: number, googleEventIds?: string[]) => {
      const newId = id || nanoid(8);
      
      setStateInternal(prev => {
        // Optimistic check for duplicates
        const isDuplicate = prev.entries.some(e =>
          e.memberId === memberId && e.date === date && e.projectId === projectId && e.activityId === activityId &&
          (slotIndex === undefined || e.slotIndex === slotIndex)
        );
        if (isDuplicate) return prev;

        // Auto-detect slot locally for instant UI response
        const memberEntries = prev.entries.filter(e => e.memberId === memberId);
        const takenSlots = new Set<number>();
        const targetDate = new Date(date + "T12:00:00Z");
        memberEntries.forEach(e => {
          const dStart = new Date(e.date + "T12:00:00Z");
          const dEnd = new Date(e.date + "T12:00:00Z");
          dEnd.setDate(dEnd.getDate() + Math.ceil(e.duration || 1) - 1);
          if (targetDate >= dStart && targetDate <= dEnd) takenSlots.add(e.slotIndex || 0);
        });
        let autoSlot = 0;
        while (takenSlots.has(autoSlot) && autoSlot < 10) autoSlot++;

        const newEntry: ScheduleEntry = {
          id: newId,
          memberId, date, activityId, projectId, customLabel,
          duration: duration ?? 1,
          slotIndex: slotIndex ?? autoSlot,
          startOffset: startOffset ?? 0,
          startSlot,
          googleEventIds,
        };

        // Firestore write moved outside pure state updater via Promise
        if (canWrite) {
          Promise.resolve().then(() => {
            setDoc(doc(db, ENTRIES_COLLECTION, newId), sanitizeForFirestore(newEntry))
              .catch(err => console.error("Firestore addEntry error:", err));
          });
        }

        const next = { ...prev, entries: [...prev.entries, newEntry] };
        saveLocalState(next);
        return next;
      });
    },
    [canWrite]
  );

  const updateEntry = useCallback((id: string, updates: Partial<ScheduleEntry>) => {
    setStateInternal(prev => {
      const next = {
        ...prev,
        entries: prev.entries.map(e => e.id === id ? { ...e, ...updates } : e),
      };
      saveLocalState(next);
      if (canWrite) {
        Promise.resolve().then(() => {
          updateDoc(doc(db, ENTRIES_COLLECTION, id), sanitizeForFirestore(updates))
            .catch(err => console.error("Firestore updateEntry error:", err));
        });
      }
      return next;
    });
  }, [canWrite]);

  const removeEntry = useCallback((id: string) => {
    setStateInternal(prev => {
      const next = { ...prev, entries: prev.entries.filter(e => e.id !== id) };
      saveLocalState(next);
      if (canWrite) {
        Promise.resolve().then(() => {
          deleteDoc(doc(db, ENTRIES_COLLECTION, id))
            .catch(err => console.error("Firestore removeEntry error:", err));
        });
      }
      return next;
    });
  }, [canWrite]);

  const removeEntriesByCell = useCallback((memberId: string, date: string) => {
    setStateInternal(prev => {
      const toRemove = prev.entries.filter(e => e.memberId === memberId && e.date === date);
      const next = { ...prev, entries: prev.entries.filter(e => !(e.memberId === memberId && e.date === date)) };
      saveLocalState(next);
      if (canWrite && toRemove.length > 0) {
        Promise.resolve().then(() => {
          const batch = writeBatch(db);
          toRemove.forEach(e => batch.delete(doc(db, ENTRIES_COLLECTION, e.id)));
          batch.commit().catch(err => console.error("Firestore removeEntriesByCell error:", err));
        });
      }
      return next;
    });
  }, [canWrite]);

  const getEntriesForCell = useCallback((memberId: string, date: string): ScheduleEntry[] => {
    const seen = new Set<string>();
    return state.entries.filter(e => {
      if (e.memberId !== memberId || e.date !== date) return false;
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  }, [state.entries]);

  const addSpecialRow = useCallback((name: string, type: SpecialRow["type"]) => {
    setStateInternal(prev => {
      const newRow = { id: nanoid(8), name, type };
      const next = { ...prev, specialRows: [...prev.specialRows, newRow] };
      saveLocalState(next);
      if (canWrite) {
        setDoc(doc(db, "data", META_DOC), sanitizeForFirestore({
          specialRows: next.specialRows,
          weeklyRosters: next.weeklyRosters,
        })).catch(console.error);
      }
      return next;
    });
  }, [canWrite]);

  const removeSpecialRow = useCallback((id: string) => {
    setStateInternal(prev => {
      const toRemove = prev.entries.filter(e => e.memberId === id);
      const next = {
        ...prev,
        specialRows: prev.specialRows.filter(r => r.id !== id),
        entries: prev.entries.filter(e => e.memberId !== id)
      };
      saveLocalState(next);
      if (canWrite) {
        const batch = writeBatch(db);
        toRemove.forEach(e => batch.delete(doc(db, ENTRIES_COLLECTION, e.id)));
        batch.set(doc(db, "data", META_DOC), sanitizeForFirestore({
          specialRows: next.specialRows,
          weeklyRosters: next.weeklyRosters,
        }));
        batch.commit().catch(console.error);
      }
      return next;
    });
  }, [canWrite]);

  const updateSpecialRow = useCallback((id: string, name: string) => {
    setStateInternal(prev => {
      const next = { ...prev, specialRows: prev.specialRows.map(r => r.id === id ? { ...r, name } : r) };
      saveLocalState(next);
      if (canWrite) {
        setDoc(doc(db, "data", META_DOC), sanitizeForFirestore({
          specialRows: next.specialRows,
          weeklyRosters: next.weeklyRosters,
        })).catch(console.error);
      }
      return next;
    });
  }, [canWrite]);

  const getWeekRoster = useCallback((weekKey: string, allMemberIds: string[]): string[] => {
    const rosters = state.weeklyRosters || {};
    if (rosters[weekKey]) return rosters[weekKey];
    const editedKeys = Object.keys(rosters).filter(k => k < weekKey).sort((a, b) => (a > b ? -1 : 1));
    return editedKeys.length > 0 ? rosters[editedKeys[0]] : allMemberIds;
  }, [state.weeklyRosters]);

  const setWeekRoster = useCallback((weekKey: string, memberIds: string[]) => {
    setStateInternal(prev => {
      const next = { ...prev, weeklyRosters: { ...prev.weeklyRosters, [weekKey]: memberIds } };
      saveLocalState(next);
      if (canWrite) {
        setDoc(doc(db, "data", META_DOC), sanitizeForFirestore({
          specialRows: next.specialRows,
          weeklyRosters: next.weeklyRosters,
        })).catch(console.error);
      }
      return next;
    });
  }, [canWrite]);

  const setState = useCallback(async (newState: ScheduleState) => {
    const validated: ScheduleState = {
      entries: newState.entries || [],
      specialRows: newState.specialRows || DEFAULT_SPECIAL_ROWS,
      weeklyRosters: newState.weeklyRosters || {},
    };
    if (canWrite) {
      try {
        const existing = await getDocs(collection(db, ENTRIES_COLLECTION));
        const deleteBatch = writeBatch(db);
        existing.forEach(d => deleteBatch.delete(d.ref));
        await deleteBatch.commit();
        const addBatch = writeBatch(db);
        validated.entries.forEach(e => {
          addBatch.set(doc(db, ENTRIES_COLLECTION, e.id), sanitizeForFirestore(e));
        });
        await addBatch.commit();
        await setDoc(doc(db, "data", META_DOC), sanitizeForFirestore({
          specialRows: validated.specialRows,
          weeklyRosters: validated.weeklyRosters,
        }));
      } catch (err) { console.error("Bulk setState error:", err); }
    }
    saveLocalState(validated);
    setStateInternal(validated);
  }, [canWrite]);

  return (
    <ScheduleContext.Provider value={{
      state, addEntry, updateEntry, removeEntry, removeEntriesByCell, getEntriesForCell,
      addSpecialRow, removeSpecialRow, updateSpecialRow, setState, getWeekRoster, setWeekRoster,
    }}>
      {children}
    </ScheduleContext.Provider>
  );
}

export function useSchedule() {
  const ctx = useContext(ScheduleContext);
  if (!ctx) throw new Error("useSchedule must be used within ScheduleProvider");
  return ctx;
}
