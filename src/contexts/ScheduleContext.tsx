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
import { sanitizeForFirestore, toUtcNoon, computeAutoSlot } from "@/lib/utils";

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
  description?: string; // user-editable description, also synced to GCal
  duration?: number;    // int slots [1–8] when startSlot is set; float fraction otherwise (legacy)
  slotIndex?: number;   // row stacking index: 0, 1, 2
  startOffset?: number; // kept for GCal / legacy; = startSlot / SCHEDULE_SLOTS when new system
  startSlot?: number;   // integer 0–7; presence marks new 8-slot system
  googleEventIds?: string[];
}

export interface AddEntryPayload {
  memberId: string;
  date: string;
  activityId: string;
  projectId?: string;
  customLabel?: string;
  description?: string;
  duration?: number;
  slotIndex?: number;
  startOffset?: number;
  id?: string;
  startSlot?: number;
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
  colorMode: "activity" | "project";
}

interface ScheduleContextType {
  state: ScheduleState;
  addEntry: (input: AddEntryPayload) => void;
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
  setColorMode: (mode: "activity" | "project") => void;
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
          colorMode: parsed.colorMode || "activity",
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
    colorMode: "activity"
  };
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
      const newEntries: ScheduleEntry[] = [];
      const seen = new Set<string>();

      // Deduplicate on read
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as ScheduleEntry;
        if (data.id && !seen.has(data.id)) {
          seen.add(data.id);
          newEntries.push(data);
        }
      });
      
      setStateInternal((prev) => {
        const next = { ...prev, entries: newEntries };
        saveLocalState(next);
        return next;
      });
    }, (error) => {
      console.error("Erro ao sincronizar tarefas no Firestore:", error);
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
    }, (error) => {
      console.error("Erro ao sincronizar metadados no Firestore:", error);
    });
  }, [user]);

  // Operations
  const addEntry = useCallback(
    (input: AddEntryPayload) => {
      const {
        memberId, date, activityId, projectId, customLabel,
        duration = 1, slotIndex, startOffset = 0, id, startSlot, googleEventIds
      } = input;
      
      const newId = id || nanoid(8);
      let newEntry: ScheduleEntry | null = null;
      
      setStateInternal(prev => {
        // Optimistic check for duplicates
        const isDuplicate = prev.entries.some(e =>
          e.memberId === memberId && e.date === date && e.projectId === projectId && e.activityId === activityId &&
          (slotIndex === undefined || e.slotIndex === slotIndex)
        );
        if (isDuplicate) return prev;

        const autoSlot = slotIndex ?? computeAutoSlot(prev.entries, memberId, date);

        newEntry = {
          id: newId,
          memberId, date, activityId, projectId, customLabel,
          duration,
          slotIndex: autoSlot,
          startOffset,
          startSlot,
          googleEventIds,
        };

        const next = { ...prev, entries: [...prev.entries, newEntry] };
        saveLocalState(next);
        return next;
      });

      // Efectuar escrita fora do callback de setState
      if (canWrite && newEntry) {
        setDoc(doc(db, ENTRIES_COLLECTION, newId), sanitizeForFirestore(newEntry))
          .catch(err => console.error("Firestore addEntry error:", err));
      }
    },
    [canWrite]
  );

  const updateEntry = useCallback((id: string, updates: Partial<ScheduleEntry>) => {
    let shouldUpdateFirestore = false;
    setStateInternal(prev => {
      if (!prev.entries.some(e => e.id === id)) return prev;
      shouldUpdateFirestore = true;
      const next = {
        ...prev,
        entries: prev.entries.map(e => e.id === id ? { ...e, ...updates } : e),
      };
      saveLocalState(next);
      return next;
    });

    if (canWrite && shouldUpdateFirestore) {
      updateDoc(doc(db, ENTRIES_COLLECTION, id), sanitizeForFirestore(updates))
        .catch(err => console.error("Firestore updateEntry error:", err));
    }
  }, [canWrite]);

  const removeEntry = useCallback((id: string) => {
    let shouldUpdateFirestore = false;
    setStateInternal(prev => {
      if (!prev.entries.some(e => e.id === id)) return prev;
      shouldUpdateFirestore = true;
      const next = { ...prev, entries: prev.entries.filter(e => e.id !== id) };
      saveLocalState(next);
      return next;
    });

    if (canWrite && shouldUpdateFirestore) {
      deleteDoc(doc(db, ENTRIES_COLLECTION, id))
        .catch(err => console.error("Firestore removeEntry error:", err));
    }
  }, [canWrite]);

  const removeEntriesByCell = useCallback((memberId: string, date: string) => {
    let toRemove: ScheduleEntry[] = [];
    
    setStateInternal(prev => {
      toRemove = prev.entries.filter(e => e.memberId === memberId && e.date === date);
      if (toRemove.length === 0) return prev;

      const next = { ...prev, entries: prev.entries.filter(e => !(e.memberId === memberId && e.date === date)) };
      saveLocalState(next);
      return next;
    });

    if (canWrite && toRemove.length > 0) {
      const batch = writeBatch(db);
      toRemove.forEach(e => batch.delete(doc(db, ENTRIES_COLLECTION, e.id)));
      batch.commit().catch(err => console.error("Firestore removeEntriesByCell error:", err));
    }
  }, [canWrite]);

  const getEntriesForCell = useCallback((memberId: string, date: string): ScheduleEntry[] => {
    // A deduplicação já foi feita na leitura do Firestore.
    // Retorna apenas filtrando.
    return state.entries.filter(e => e.memberId === memberId && e.date === date);
  }, [state.entries]);

  const addSpecialRow = useCallback((name: string, type: SpecialRow["type"]) => {
    const newRow = { id: nanoid(8), name, type };
    let nextSpecialRows: SpecialRow[] = [];
    let nextWeeklyRosters: Record<string, string[]> = {};

    setStateInternal(prev => {
      const next = { ...prev, specialRows: [...prev.specialRows, newRow] };
      nextSpecialRows = next.specialRows;
      nextWeeklyRosters = next.weeklyRosters;
      saveLocalState(next);
      return next;
    });

    if (canWrite) {
      setDoc(doc(db, "data", META_DOC), sanitizeForFirestore({
        specialRows: nextSpecialRows,
        weeklyRosters: nextWeeklyRosters,
      })).catch(console.error);
    }
  }, [canWrite]);

  const removeSpecialRow = useCallback((id: string) => {
    let toRemoveEntries: ScheduleEntry[] = [];
    let nextSpecialRows: SpecialRow[] = [];
    let nextWeeklyRosters: Record<string, string[]> = {};

    setStateInternal(prev => {
      toRemoveEntries = prev.entries.filter(e => e.memberId === id);
      const next = {
        ...prev,
        specialRows: prev.specialRows.filter(r => r.id !== id),
        entries: prev.entries.filter(e => e.memberId !== id)
      };
      nextSpecialRows = next.specialRows;
      nextWeeklyRosters = next.weeklyRosters;
      saveLocalState(next);
      return next;
    });

    if (canWrite) {
      const batch = writeBatch(db);
      toRemoveEntries.forEach(e => batch.delete(doc(db, ENTRIES_COLLECTION, e.id)));
      batch.set(doc(db, "data", META_DOC), sanitizeForFirestore({
        specialRows: nextSpecialRows,
        weeklyRosters: nextWeeklyRosters,
      }));
      batch.commit().catch(console.error);
    }
  }, [canWrite]);

  const updateSpecialRow = useCallback((id: string, name: string) => {
    let nextSpecialRows: SpecialRow[] = [];
    let nextWeeklyRosters: Record<string, string[]> = {};

    setStateInternal(prev => {
      const next = { ...prev, specialRows: prev.specialRows.map(r => r.id === id ? { ...r, name } : r) };
      nextSpecialRows = next.specialRows;
      nextWeeklyRosters = next.weeklyRosters;
      saveLocalState(next);
      return next;
    });

    if (canWrite) {
      setDoc(doc(db, "data", META_DOC), sanitizeForFirestore({
        specialRows: nextSpecialRows,
        weeklyRosters: nextWeeklyRosters,
      })).catch(console.error);
    }
  }, [canWrite]);

  const getWeekRoster = useCallback((weekKey: string, allMemberIds: string[]): string[] => {
    const rosters = state.weeklyRosters || {};
    if (rosters[weekKey]) return rosters[weekKey];
    const editedKeys = Object.keys(rosters).filter(k => k < weekKey).sort((a, b) => (a > b ? -1 : 1));
    return editedKeys.length > 0 ? rosters[editedKeys[0]] : allMemberIds;
  }, [state.weeklyRosters]);

  const setWeekRoster = useCallback((weekKey: string, memberIds: string[]) => {
    let nextSpecialRows: SpecialRow[] = [];
    let nextWeeklyRosters: Record<string, string[]> = {};

    setStateInternal(prev => {
      const next = { ...prev, weeklyRosters: { ...prev.weeklyRosters, [weekKey]: memberIds } };
      nextSpecialRows = next.specialRows;
      nextWeeklyRosters = next.weeklyRosters;
      saveLocalState(next);
      return next;
    });

    if (canWrite) {
      setDoc(doc(db, "data", META_DOC), sanitizeForFirestore({
        specialRows: nextSpecialRows,
        weeklyRosters: nextWeeklyRosters,
      })).catch(console.error);
    }
  }, [canWrite]);

  const setState = useCallback(async (newState: ScheduleState) => {
    const validated: ScheduleState = {
      entries: newState.entries || [],
      specialRows: newState.specialRows || DEFAULT_SPECIAL_ROWS,
      weeklyRosters: newState.weeklyRosters || {},
    };
    
    // Otimista: atualiza a interface local e salva estado
    setStateInternal(validated);
    saveLocalState(validated);
    
    if (canWrite) {
      try {
        // Primeiro envia os metadados (menos risco)
        await setDoc(doc(db, "data", META_DOC), sanitizeForFirestore({
          specialRows: validated.specialRows,
          weeklyRosters: validated.weeklyRosters,
        }));
        
        // Agora prossegue para os entries. Buscamos tudo e substituímos limitados aos batchs de 500
        const existingDocs = await getDocs(collection(db, ENTRIES_COLLECTION));
        
        // Em um cenário de produção em massa, batch deletes seriam pageados. 
        // Aqui assumimos < 500 docs. Para ser totalmente seguro, agrupamos:
        const deleteBatch = writeBatch(db);
        let deleteCount = 0;
        existingDocs.forEach(d => {
            deleteBatch.delete(d.ref);
            deleteCount++;
        });
        
        if(deleteCount > 0){
          await deleteBatch.commit();
        }

        const addBatch = writeBatch(db);
        let addCount = 0;
        validated.entries.forEach(e => {
          if(!e.id) return;
          addBatch.set(doc(db, ENTRIES_COLLECTION, e.id), sanitizeForFirestore(e));
          addCount++;
        });
        
        if(addCount > 0){
           await addBatch.commit();
        }

      } catch (err) {
        console.error("Bulk setState (Firestore sync) error:", err);
        // Opcional: toastar erro aqui para o usuário saber que a nuvem rejeitou as infos em lote
      }
    }
  }, [canWrite]);

  const setColorMode = useCallback((mode: "activity" | "project") => {
    setStateInternal(prev => ({ ...prev, colorMode: mode }));
  }, []);

  return (
    <ScheduleContext.Provider value={{
      state, addEntry, updateEntry, removeEntry, removeEntriesByCell, getEntriesForCell,
      addSpecialRow, removeSpecialRow, updateSpecialRow, setState, getWeekRoster, setWeekRoster, setColorMode,
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
