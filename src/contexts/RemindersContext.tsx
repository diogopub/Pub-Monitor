import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { nanoid } from "nanoid";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  setDoc,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { sanitizeForFirestore } from "@/lib/utils";

export interface Reminder {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  width: number;
  height: number;
  createdAt: number;
}

interface RemindersContextType {
  reminders: Reminder[];
  addReminder: (x: number, y: number) => void;
  updateReminder: (id: string, updates: Partial<Reminder>) => void;
  deleteReminder: (id: string) => void;
}

const RemindersContext = createContext<RemindersContextType | undefined>(undefined);

export const POST_IT_COLORS = [
  { name: "Yellow", bg: "#fef08a", border: "#facc15" },
  { name: "Pink", bg: "#fbcfe8", border: "#f472b6" },
  { name: "Blue", bg: "#bae6fd", border: "#38bdf8" },
  { name: "Green", bg: "#bbf7d0", border: "#4ade80" },
  { name: "Purple", bg: "#e9d5ff", border: "#c084fc" },
];

export function RemindersProvider({ children }: { children: React.ReactNode }) {
  const [reminders, setReminders] = useState<Reminder[]>([]);

  // Sync with Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "reminders"), (snap) => {
      const data = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Reminder[];
      setReminders(data.sort((a, b) => a.createdAt - b.createdAt));
    });
    return () => unsub();
  }, []);

  const addReminder = useCallback(async (x: number, y: number) => {
    const id = nanoid();
    const newReminder: Reminder = {
      id,
      text: "",
      x,
      y,
      color: POST_IT_COLORS[0].bg,
      width: 180,
      height: 180,
      createdAt: Date.now(),
    };
    await setDoc(doc(db, "reminders", id), sanitizeForFirestore(newReminder));
  }, []);

  const updateReminder = useCallback(async (id: string, updates: Partial<Reminder>) => {
    const reminder = reminders.find((r) => r.id === id);
    if (!reminder) return;
    const updated = { ...reminder, ...updates };
    await setDoc(doc(db, "reminders", id), sanitizeForFirestore(updated));
  }, [reminders]);

  const deleteReminder = useCallback(async (id: string) => {
    await deleteDoc(doc(db, "reminders", id));
  }, []);

  return (
    <RemindersContext.Provider value={{ reminders, addReminder, updateReminder, deleteReminder }}>
      {children}
    </RemindersContext.Provider>
  );
}

export function useReminders() {
  const context = useContext(RemindersContext);
  if (!context) throw new Error("useReminders must be used within RemindersProvider");
  return context;
}
