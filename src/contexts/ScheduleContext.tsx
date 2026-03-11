import React, { createContext, useContext, useState, useCallback } from "react";
import { nanoid } from "nanoid";

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

// ─── Schedule Entry ──────────────────────────────────────────────
export interface ScheduleEntry {
  id: string;
  memberId: string; // team member ID or special row ID
  date: string; // ISO date string YYYY-MM-DD
  activityId: string; // reference to ACTIVITY_TYPES
  projectId?: string; // optional project reference
  duration?: number; // length in slots, where 1 slot = 1 column wide
  slotIndex?: number; // 0, 1, or 2 for the vertical position
  startOffset?: number; // 0 or 0.5 for half-slot horizontal positioning
}

// ─── Special Rows ────────────────────────────────────────────────
export interface SpecialRow {
  id: string;
  name: string;
  type: "freelancer" | "entradas-entregas";
}

export const DEFAULT_SPECIAL_ROWS: SpecialRow[] = [
  { id: "sr-entradas", name: "Entradas e Entregas", type: "entradas-entregas" },
];

// ─── State ───────────────────────────────────────────────────────
export interface ScheduleState {
  entries: ScheduleEntry[];
  specialRows: SpecialRow[];
}

interface ScheduleContextType {
  state: ScheduleState;
  addEntry: (memberId: string, date: string, activityId: string, projectId?: string) => void;
  updateEntry: (id: string, updates: Partial<ScheduleEntry>) => void;
  removeEntry: (id: string) => void;
  removeEntriesByCell: (memberId: string, date: string) => void;
  getEntriesForCell: (memberId: string, date: string) => ScheduleEntry[];
  addSpecialRow: (name: string, type: SpecialRow["type"]) => void;
  removeSpecialRow: (id: string) => void;
  updateSpecialRow: (id: string, name: string) => void;
  setState: (state: ScheduleState) => void;
}

// ─── Persistence ─────────────────────────────────────────────────
const STORAGE_KEY = "pub-schedule-state";

function loadState(): ScheduleState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed.entries) && Array.isArray(parsed.specialRows)) {
        const migrated = parsed.entries.map((e: any) => ({
          ...e,
          duration: e.duration || 1,
          slotIndex: e.slotIndex ?? 0,
          startOffset: e.startOffset ?? 0
        }));
        return { ...parsed, entries: migrated };
      }
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return { entries: [], specialRows: DEFAULT_SPECIAL_ROWS };
}

function saveState(state: ScheduleState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

// ─── Context ─────────────────────────────────────────────────────
const ScheduleContext = createContext<ScheduleContextType | null>(null);

export function ScheduleProvider({ children }: { children: React.ReactNode }) {
  const [state, setStateInternal] = useState<ScheduleState>(loadState);

  const updateState = useCallback((updater: (prev: ScheduleState) => ScheduleState) => {
    setStateInternal((prev) => {
      const next = updater(prev);
      saveState(next);
      return next;
    });
  }, []);

  const addEntry = useCallback(
    (memberId: string, date: string, activityId: string, projectId?: string) => {
      updateState((s) => {
        const memberEntries = s.entries.filter(e => e.memberId === memberId);
        const takenSlots = new Set<number>();
        const targetDate = new Date(date + "T12:00:00Z");

        memberEntries.forEach(e => {
          const dStart = new Date(e.date + "T12:00:00Z");
          const duration = e.duration || 1;
          const dEnd = new Date(e.date + "T12:00:00Z");
          dEnd.setDate(dEnd.getDate() + Math.ceil(duration) - 1);

          if (targetDate >= dStart && targetDate <= dEnd) {
            takenSlots.add(e.slotIndex || 0);
          }
        });

        let slotIndex = 0;
        while (takenSlots.has(slotIndex) && slotIndex < 3) slotIndex++;

        return {
          ...s,
          entries: [...s.entries, { id: nanoid(8), memberId, date, activityId, projectId, duration: 1, slotIndex, startOffset: 0 }],
        };
      });
    },
    [updateState]
  );

  const updateEntry = useCallback((id: string, updates: Partial<ScheduleEntry>) => {
    updateState((s) => ({
      ...s,
      entries: s.entries.map(e => e.id === id ? { ...e, ...updates } : e),
    }));
  }, [updateState]);

  const removeEntry = useCallback(
    (id: string) => {
      updateState((s) => ({
        ...s,
        entries: s.entries.filter((e) => e.id !== id),
      }));
    },
    [updateState]
  );

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

  const setStateBulk = useCallback((newState: ScheduleState) => {
    saveState(newState);
    setStateInternal(newState);
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
