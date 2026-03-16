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
  customLabel?: string; // optional custom label overriding project name + activity
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
  { "id": "sr-freelancer-1", "name": "Freelancer 1", "type": "freelancer" },
  { "id": "sr-freelancer-2", "name": "Freelancer 2", "type": "freelancer" },
  { "id": "sr-entradas", "name": "Entradas e Entregas", "type": "entradas-entregas" }
];

const DEFAULT_ENTRIES: ScheduleEntry[] = [
  { "id": "jDNKSv2r", "memberId": "m4", "date": "2026-03-05", "activityId": "3d", "projectId": "tNT6ivzP", "duration": 2, "slotIndex": 0, "startOffset": 0 },
  { "id": "fiXfD-yz", "memberId": "m1", "date": "2026-03-04", "activityId": "criacao", "projectId": "GPhSiPJl", "duration": 1, "slotIndex": 0, "startOffset": 0 },
  { "id": "YBWmFgw0", "memberId": "m1", "date": "2026-03-09", "activityId": "criacao", "projectId": "8IkoPBzY", "duration": 0.5, "slotIndex": 0, "startOffset": 0 },
  { "id": "xQl8TEeR", "memberId": "m3", "date": "2026-03-09", "activityId": "descritivo", "projectId": "tNT6ivzP", "duration": 0.5, "slotIndex": 0, "startOffset": 0.5 },
  { "id": "ppiGkiU9", "memberId": "m4", "date": "2026-03-09", "activityId": "3d", "projectId": "tNT6ivzP", "duration": 3, "slotIndex": 0, "startOffset": 0 },
  { "id": "iTH8QOQg", "memberId": "m5", "date": "2026-03-10", "activityId": "3d", "projectId": "2iJoYkNk", "duration": 1, "slotIndex": 0, "startOffset": 0 },
  { "id": "ufGz1Jua", "memberId": "m7", "date": "2026-03-09", "activityId": "3d", "projectId": "tNT6ivzP", "duration": 0.5, "slotIndex": 0, "startOffset": 0.5 },
  { "id": "RNrQHKAz", "memberId": "sr-entradas", "date": "2026-03-09", "activityId": "apresentacao-cliente", "projectId": "VLEC3mz6", "duration": 1, "slotIndex": 0, "startOffset": 0 },
  { "id": "ODjQ9vmT", "memberId": "sr-entradas", "date": "2026-03-13", "activityId": "entrega-pub", "projectId": "tNT6ivzP", "duration": 1, "slotIndex": 0, "startOffset": 0 },
  { "id": "JkxX5Vvt", "memberId": "sr-entradas", "date": "2026-03-11", "activityId": "entrega-pub", "projectId": "2iJoYkNk", "duration": 1, "slotIndex": 0, "startOffset": 0 },
  { "id": "SerI7_mE", "memberId": "sr-entradas", "date": "2026-03-11", "activityId": "entrega-pub", "projectId": "GPhSiPJl", "duration": 1, "slotIndex": 0, "startOffset": 0 },
  { "id": "RzyZmdbj", "memberId": "m7", "date": "2026-03-12", "activityId": "dayoff", "duration": 2, "slotIndex": 0, "startOffset": 0 },
  { "id": "Tb32NKSf", "memberId": "m2", "date": "2026-03-09", "activityId": "descritivo", "projectId": "2iJoYkNk", "duration": 0.5, "slotIndex": 0, "startOffset": 0 },
  { "id": "_vMVTLo4", "memberId": "m2", "date": "2026-03-09", "activityId": "planta", "projectId": "2iJoYkNk", "duration": 0.5, "slotIndex": 1, "startOffset": 0 },
  { "id": "m51sNOey", "memberId": "m5", "date": "2026-03-09", "activityId": "3d", "projectId": "GPhSiPJl", "duration": 1, "slotIndex": 0, "startOffset": 0 },
  { "id": "JLkZp6oJ", "memberId": "m6", "date": "2026-03-09", "activityId": "3d", "projectId": "VLEC3mz6", "duration": 1, "slotIndex": 0, "startOffset": 0 },
  { "id": "xuBrjhqB", "memberId": "m6", "date": "2026-03-09", "activityId": "3d", "projectId": "tNT6ivzP", "duration": 1, "slotIndex": 0, "startOffset": 0 },
  { "id": "mf6a8rgM", "memberId": "m6", "date": "2026-03-13", "activityId": "3d", "projectId": "8IkoPBzY", "duration": 1, "slotIndex": 0, "startOffset": 0 },
  { "id": "TqqHDm8K", "memberId": "m3", "date": "2026-03-09", "activityId": "planta", "projectId": "tNT6ivzP", "duration": 0.5, "slotIndex": 0, "startOffset": 0 },
  { "id": "ca_Qwa_f", "memberId": "m4", "date": "2026-03-12", "activityId": "3d", "projectId": "Kyx_zt5V", "duration": 1.5, "slotIndex": 0, "startOffset": 0.5 },
  { "id": "e-S7P0B-", "memberId": "m1", "date": "2026-03-11", "activityId": "criacao", "projectId": "Kyx_zt5V", "duration": 2, "slotIndex": 0, "startOffset": 0 },
  { "id": "r4oHhbmG", "memberId": "m2", "date": "2026-03-10", "activityId": "planta", "projectId": "2iJoYkNk", "duration": 0.5, "slotIndex": 1, "startOffset": 0 },
  { "id": "vJONjj8v", "memberId": "m2", "date": "2026-03-10", "activityId": "descritivo", "projectId": "2iJoYkNk", "duration": 0.5, "slotIndex": 0, "startOffset": 0 },
  { "id": "430vzegP", "memberId": "m2", "date": "2026-03-11", "activityId": "descritivo", "projectId": "2iJoYkNk", "duration": 0.5, "slotIndex": 0, "startOffset": 0 },
  { "id": "DXpUIOJb", "memberId": "m2", "date": "2026-03-13", "activityId": "planta", "projectId": "8IkoPBzY", "duration": 0.5, "slotIndex": 0, "startOffset": 0 },
  { "id": "tFYqv-4O", "memberId": "m3", "date": "2026-03-12", "activityId": "planta", "projectId": "Kyx_zt5V", "duration": 2, "slotIndex": 0, "startOffset": 0 },
  { "id": "FnJZwzs3", "memberId": "m5", "date": "2026-03-11", "activityId": "3d", "projectId": "Kyx_zt5V", "duration": 0.5, "slotIndex": 1, "startOffset": 0 },
  { "id": "s8LXCtOL", "memberId": "m5", "date": "2026-03-11", "activityId": "3d", "projectId": "2iJoYkNk", "duration": 1.5, "slotIndex": 0, "startOffset": 0.5 },
  { "id": "wY_91efT", "memberId": "sr-entradas", "date": "2026-03-12", "activityId": "entrega-pub", "projectId": "2iJoYkNk", "duration": 1, "slotIndex": 0, "startOffset": 0 },
  { "id": "M69y1h4s", "memberId": "m7", "date": "2026-03-10", "activityId": "3d", "projectId": "tNT6ivzP", "duration": 0.5, "slotIndex": 0, "startOffset": 0.5 },
  { "id": "wiZMiI0a", "memberId": "m7", "date": "2026-03-11", "activityId": "3d", "projectId": "tNT6ivzP", "duration": 0.5, "slotIndex": 0, "startOffset": 0.5 },
  { "id": "Hdu2YiWc", "memberId": "m6", "date": "2026-03-10", "activityId": "3d", "projectId": "tNT6ivzP", "duration": 0.5, "slotIndex": 1, "startOffset": 0 },
  { "id": "AxZ-jmn0", "memberId": "m1", "date": "2026-03-02", "activityId": "criacao", "projectId": "2iJoYkNk", "duration": 1, "slotIndex": 0, "startOffset": 0 },
  { "id": "orQRbOqt", "memberId": "m1", "date": "2026-03-03", "activityId": "criacao", "projectId": "tNT6ivzP", "duration": 1, "slotIndex": 0, "startOffset": 0 },
  { "id": "XQSr9yFp", "memberId": "m1", "date": "2026-03-05", "activityId": "canva", "projectId": "GPhSiPJl", "duration": 1, "slotIndex": 0, "startOffset": 0 },
  { "id": "XsOZwCG9", "memberId": "m1", "date": "2026-03-06", "activityId": "criacao", "projectId": "8IkoPBzY", "duration": 1, "slotIndex": 0, "startOffset": 0 },
  { "id": "p6ln7rMy", "memberId": "m2", "date": "2026-03-02", "activityId": "planta", "projectId": "VLEC3mz6", "duration": 3, "slotIndex": 0, "startOffset": 0 },
  { "id": "c4p19cin", "memberId": "m2", "date": "2026-03-02", "activityId": "descritivo", "projectId": "VLEC3mz6", "duration": 3, "slotIndex": 1, "startOffset": 0 },
  { "id": "jmWvfz7J", "memberId": "m5", "date": "2026-03-02", "activityId": "3d", "projectId": "2iJoYkNk", "duration": 3, "slotIndex": 0, "startOffset": 0 },
  { "id": "jyKvjo1U", "memberId": "m5", "date": "2026-03-05", "activityId": "3d", "projectId": "GPhSiPJl", "duration": 2, "slotIndex": 0, "startOffset": 0 },
  { "id": "24QTvXwq", "memberId": "m6", "date": "2026-03-06", "activityId": "3d", "projectId": "VLEC3mz6", "duration": 1, "slotIndex": 0, "startOffset": 0 },
  { "id": "24zEGez_", "memberId": "m6", "date": "2026-03-05", "activityId": "planta", "projectId": "2S4yXlfs", "duration": 1, "slotIndex": 0, "startOffset": 0 },
  { "id": "g35Hgawm", "memberId": "m6", "date": "2026-03-03", "activityId": "planta", "projectId": "2S4yXlfs", "duration": 1, "slotIndex": 1, "startOffset": 0 },
  { "id": "qx0nazNV", "memberId": "m6", "date": "2026-03-02", "activityId": "3d", "projectId": "VLEC3mz6", "duration": 3, "slotIndex": 0, "startOffset": 0 },
  { "id": "tUapqFQ7", "memberId": "m7", "date": "2026-03-04", "activityId": "3d", "projectId": "tNT6ivzP", "duration": 0.5, "slotIndex": 0, "startOffset": 0.5 },
  { "id": "9yO5zG2g", "memberId": "m7", "date": "2026-03-05", "activityId": "3d", "projectId": "2iJoYkNk", "duration": 0.5, "slotIndex": 0, "startOffset": 0.5 },
  { "id": "1O_0aQET", "memberId": "m7", "date": "2026-03-06", "activityId": "3d", "projectId": "2iJoYkNk", "duration": 0.5, "slotIndex": 0, "startOffset": 0.5 },
  { "id": "pkKqbAUq", "memberId": "m3", "date": "2026-03-02", "activityId": "planta", "projectId": "2iJoYkNk", "duration": 1, "slotIndex": 0, "startOffset": 0 },
  { "id": "stQ_wp6p", "memberId": "m3", "date": "2026-03-03", "activityId": "planta", "projectId": "tNT6ivzP", "duration": 1, "slotIndex": 0, "startOffset": 0 },
  { "id": "--o6m0fW", "memberId": "m3", "date": "2026-03-04", "activityId": "planta", "projectId": "2iJoYkNk", "duration": 1, "slotIndex": 0, "startOffset": 0 },
  { "id": "mcDcycU0", "memberId": "m3", "date": "2026-03-05", "activityId": "planta", "projectId": "tNT6ivzP", "duration": 1.5, "slotIndex": 0, "startOffset": 0 },
  { "id": "Yh8Kdrfs", "memberId": "m3", "date": "2026-03-06", "activityId": "planta", "projectId": "GPhSiPJl", "duration": 0.5, "slotIndex": 1, "startOffset": 0.5 },
  { "id": "o8PSoyWC", "memberId": "m5", "date": "2026-02-25", "activityId": "3d", "projectId": "GPhSiPJl", "duration": 3, "slotIndex": 0, "startOffset": 0 },
  { "id": "n0wMWhpe", "memberId": "m1", "date": "2026-02-23", "activityId": "criacao", "projectId": "GPhSiPJl", "duration": 2, "slotIndex": 0, "startOffset": 0 },
  { "id": "Yi7jBcla", "memberId": "m3", "date": "2026-03-10", "activityId": "planta", "projectId": "tNT6ivzP", "duration": 0.5, "slotIndex": 0, "startOffset": 0 },
  { "id": "jlktkAPr", "memberId": "m3", "date": "2026-03-10", "activityId": "descritivo", "projectId": "tNT6ivzP", "duration": 0.5, "slotIndex": 0, "startOffset": 0.5 },
  { "id": "CX8uGO7K", "memberId": "m3", "date": "2026-03-11", "activityId": "planta", "projectId": "tNT6ivzP", "duration": 0.5, "slotIndex": 0, "startOffset": 0 },
  { "id": "ZdCohzvK", "memberId": "m3", "date": "2026-03-11", "activityId": "descritivo", "projectId": "tNT6ivzP", "duration": 0.5, "slotIndex": 0, "startOffset": 0.5 },
  { "id": "Z1XjR3a0", "memberId": "m4", "date": "2026-03-12", "activityId": "3d", "projectId": "tNT6ivzP", "duration": 0.5, "slotIndex": 1, "startOffset": 0 },
  { "id": "tnP39HmQ", "memberId": "m5", "date": "2026-03-13", "activityId": "dayoff", "duration": 1, "slotIndex": 0, "startOffset": 0 },
  { "id": "QhlB3aGC", "memberId": "m5", "date": "2026-03-17", "activityId": "3d", "projectId": "8IkoPBzY", "duration": 1, "slotIndex": 0, "startOffset": 0 },
  { "id": "0lKOfyoM", "memberId": "m2", "date": "2026-03-12", "activityId": "descritivo", "projectId": "2iJoYkNk", "duration": 0.5, "slotIndex": 0, "startOffset": 0 },
  { "id": "g_2S1nmo", "memberId": "m5", "date": "2026-03-20", "activityId": "3d", "projectId": "8IkoPBzY", "duration": 1, "slotIndex": 0, "startOffset": 0 },
  { "id": "1gjjf9pD", "memberId": "m3", "date": "2026-03-19", "activityId": "planta", "projectId": "8IkoPBzY", "duration": 0.5, "slotIndex": 0, "startOffset": 0 },
  { "id": "Y0INnigA", "memberId": "m3", "date": "2026-03-19", "activityId": "descritivo", "projectId": "8IkoPBzY", "duration": 0.5, "slotIndex": 0, "startOffset": 0.5 },
  { "id": "n5UFRE7-", "memberId": "6qcWGbbl", "date": "2026-03-20", "activityId": "orcamento", "projectId": "8IkoPBzY", "duration": 1, "slotIndex": 0, "startOffset": 0 },
  { "id": "ceFWdWzU", "memberId": "m1", "date": "2026-03-10", "activityId": "criacao", "projectId": "8IkoPBzY", "duration": 0.5, "slotIndex": 0, "startOffset": 0 },
  { "id": "hpa0xACT", "memberId": "m6", "date": "2026-03-11", "activityId": "3d", "projectId": "2S4yXlfs", "duration": 0.5, "slotIndex": 0, "startOffset": 0 },
  { "id": "gz6HWbuS", "memberId": "m6", "date": "2026-03-11", "activityId": "planta", "projectId": "2S4yXlfs", "duration": 0.5, "slotIndex": 0, "startOffset": 0.5 },
  { "id": "HCMcGFLc", "memberId": "m6", "date": "2026-03-12", "activityId": "3d", "projectId": "2S4yXlfs", "duration": 0.5, "slotIndex": 0, "startOffset": 0 },
  { "id": "XnSf3Zvh", "memberId": "m6", "date": "2026-03-12", "activityId": "planta", "projectId": "2S4yXlfs", "duration": 0.5, "slotIndex": 0, "startOffset": 0.5 },
  { "id": "IWEJsgSp", "memberId": "m6", "date": "2026-03-10", "activityId": "criacao", "projectId": "2S4yXlfs", "duration": 0.5, "slotIndex": 0, "startOffset": 0.5 },
  { "id": "T4pHfOEK", "memberId": "m6", "date": "2026-03-16", "activityId": "planta", "projectId": "2S4yXlfs", "duration": 0.5, "slotIndex": 0, "startOffset": 0 },
  { "id": "d-sjYb3m", "memberId": "m6", "date": "2026-03-16", "activityId": "3d", "projectId": "2S4yXlfs", "duration": 0.5, "slotIndex": 0, "startOffset": 0.5 },
  { "id": "EavBS6Ex", "memberId": "m6", "date": "2026-03-17", "activityId": "3d", "projectId": "2S4yXlfs", "duration": 1, "slotIndex": 0, "startOffset": 0 },
  { "id": "DaLZdSEn", "memberId": "m3", "date": "2026-03-16", "activityId": "planta", "projectId": "Kyx_zt5V", "duration": 0.5, "slotIndex": 0, "startOffset": 0 },
  { "id": "kD17gzpf", "memberId": "6qcWGbbl", "date": "2026-03-19", "activityId": "orcamento", "projectId": "Kyx_zt5V", "duration": 1, "slotIndex": 0, "startOffset": 0 },
  { "id": "ASFf30I5", "memberId": "m3", "date": "2026-03-18", "activityId": "descritivo", "projectId": "Kyx_zt5V", "duration": 1, "slotIndex": 0, "startOffset": 0 },
  { "id": "UAE7oJ74", "memberId": "m4", "date": "2026-03-16", "activityId": "3d", "projectId": "Kyx_zt5V", "duration": 1, "slotIndex": 0, "startOffset": 0 },
  { "id": "vnVagIN6", "memberId": "m4", "date": "2026-03-17", "activityId": "3d", "projectId": "Kyx_zt5V", "duration": 1, "slotIndex": 0, "startOffset": 0 },
  { "id": "F0i_zzYI", "memberId": "m5", "date": "2026-03-16", "activityId": "3d", "projectId": "GPhSiPJl", "duration": 1, "slotIndex": 0, "startOffset": 0 },
  { "id": "g0vIWDjd", "memberId": "m1", "date": "2026-03-13", "activityId": "criacao", "projectId": "8IkoPBzY", "duration": 0.5, "slotIndex": 0, "startOffset": 0 },
  { "id": "fzpnq8sk", "memberId": "TdyNfZ0C", "date": "2026-03-16", "activityId": "orcamento", "projectId": "2iJoYkNk", "duration": 1, "slotIndex": 0, "startOffset": 0 }
];

// ─── State ───────────────────────────────────────────────────────
export interface ScheduleState {
  entries: ScheduleEntry[];
  specialRows: SpecialRow[];
  /**
   * weeklyRosters: maps Monday ISO date → ordered array of member IDs active that week.
   * If a week is not in this map, it inherits from the nearest previous edited week.
   */
  weeklyRosters: Record<string, string[]>;
}

interface ScheduleContextType {
  state: ScheduleState;
  addEntry: (memberId: string, date: string, activityId: string, projectId?: string, customLabel?: string) => void;
  updateEntry: (id: string, updates: Partial<ScheduleEntry>) => void;
  removeEntry: (id: string) => void;
  removeEntriesByCell: (memberId: string, date: string) => void;
  getEntriesForCell: (memberId: string, date: string) => ScheduleEntry[];
  addSpecialRow: (name: string, type: SpecialRow["type"]) => void;
  removeSpecialRow: (id: string) => void;
  updateSpecialRow: (id: string, name: string) => void;
  setState: (state: ScheduleState) => void;
  /** Returns the effective member IDs for a given Monday key, inheriting from the nearest previous edited week */
  getWeekRoster: (weekKey: string, allMemberIds: string[]) => string[];
  /** Sets the explicit roster for a week */
  setWeekRoster: (weekKey: string, memberIds: string[]) => void;
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
        return {
          ...parsed,
          entries: migrated,
          weeklyRosters: parsed.weeklyRosters ?? {},
        };
      }
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return { entries: DEFAULT_ENTRIES, specialRows: DEFAULT_SPECIAL_ROWS, weeklyRosters: {} };
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
    (memberId: string, date: string, activityId: string, projectId?: string, customLabel?: string) => {
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
          entries: [...s.entries, { id: nanoid(8), memberId, date, activityId, projectId, customLabel, duration: 1, slotIndex, startOffset: 0 }],
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

  /**
   * Returns effective member IDs for a given Monday key.
   * - If this week has its own roster → return it.
   * - Else find the most recent edited week BEFORE this week → return its roster.
   * - If none exists → return allMemberIds (full master list).
   */
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
