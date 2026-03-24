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
  getDocs 
} from "firebase/firestore";
import { useAuth } from "./AuthContext";
import { usePermissions } from "./PermissionsContext";
import { sanitizeForFirestore } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────
export interface ProjectDocument {
  id: string;
  label: string;
  enabled: boolean;
  sentAt?: string;
}

export interface TeamMember {
  id: string;
  role: "criacao" | "arq" | "3d";
  name: string;
}

export type DailyAllocations = Record<string, string[]>;

export interface TimelinePin {
  id: string;
  date: string;
  color: "white" | "yellow" | "red";
  label?: string;
  labels: string[];
  completedLabels?: boolean[];
}

export type ProjectStatus = "em-desenvolvimento" | "onboarding" | "standby" | "aguardando-retorno";

export interface ProjectCardData {
  id: string;
  name: string;
  client: string;
  hub?: string;
  active?: boolean;
  projectStatus?: ProjectStatus;
  entryDate: string;
  deliveryDate: string;
  team: TeamMember[];
  documents: ProjectDocument[];
  feed: FeedEntry[];
  dailyAllocations?: DailyAllocations;
  timelinePins?: TimelinePin[];
  badges?: string[];
  showInTimeline?: boolean;
}

export interface FeedEntry {
  id: string;
  message: string;
  timestamp: string;
}

export const DEFAULT_DOCUMENTS: Omit<ProjectDocument, "id">[] = [];

export interface ProjectCardsState {
  cards: ProjectCardData[];
}

interface ProjectCardsContextType {
  state: ProjectCardsState;
  addCard: (data: Omit<ProjectCardData, "id" | "documents" | "feed">) => void;
  updateCard: (id: string, updates: Partial<Omit<ProjectCardData, "id">>) => void;
  removeCard: (id: string) => void;
  toggleDocument: (cardId: string, docId: string) => void;
  addDocument: (cardId: string, label: string) => void;
  removeDocument: (cardId: string, docId: string) => void;
  reorderDocument: (cardId: string, docId: string, direction: "up" | "down") => void;
  addTeamMember: (cardId: string, role: "criacao" | "arq" | "3d", name: string) => void;
  updateTeamMember: (cardId: string, memberId: string, name: string) => void;
  removeTeamMember: (cardId: string, memberId: string) => void;
  addFeedEntry: (cardId: string, message: string) => void;
  removeFeedEntry: (cardId: string, feedId: string) => void;
  setState: (state: ProjectCardsState) => void;
}

const STORAGE_KEY = "pub-project-cards-v2";
const CARDS_COLLECTION = "project_cards";

function createDefaultDocuments(): ProjectDocument[] {
  return DEFAULT_DOCUMENTS.map((d) => ({ ...d, id: nanoid(8) }));
}

function migrateTeam(team: any): TeamMember[] {
  if (Array.isArray(team)) return team;
  const members: TeamMember[] = [];
  if (team?.criacao) members.push({ id: nanoid(8), role: "criacao", name: team.criacao });
  if (team?.arq) members.push({ id: nanoid(8), role: "arq", name: team.arq });
  if (team?.["3d"]) members.push({ id: nanoid(8), role: "3d", name: team["3d"] });
  return members;
}

function loadLocalState(): ProjectCardsState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : { cards: [] };
  } catch { return { cards: [] }; }
}

function saveLocalState(state: ProjectCardsState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { }
}

const ProjectCardsContext = createContext<ProjectCardsContextType | null>(null);

export function ProjectCardsProvider({ children }: { children: React.ReactNode }) {
  const [state, setStateInternal] = useState<ProjectCardsState>(loadLocalState);
  const { user } = useAuth();
  const { currentUserRole } = usePermissions();
  const canWrite = currentUserRole === "admin" || currentUserRole === "editor";

  // ☁️ SYNC FROM CLOUD
  useEffect(() => {
    if (!user) return;
    const cardsCol = collection(db, CARDS_COLLECTION);
    return onSnapshot(cardsCol, (snapshot) => {
      const cards: ProjectCardData[] = [];
      snapshot.forEach(d => {
        const c = d.data() as any;
        cards.push({
          ...c,
          id: c.id || d.id,
          team: migrateTeam(c.team),
          documents: Array.isArray(c.documents) ? c.documents : createDefaultDocuments(),
          feed: Array.isArray(c.feed) ? c.feed : [],
          timelinePins: Array.isArray(c.timelinePins) ? c.timelinePins.map((p: any) => ({
            ...p,
            labels: Array.isArray(p.labels) ? p.labels : (p.label ? [p.label] : ["ENTRADA"]),
          })) : undefined,
        });
      });
      setStateInternal(prev => {
        const next = { ...prev, cards };
        saveLocalState(next);
        return next;
      });
    });
  }, [user]);

  // Operations
  const addCard = useCallback((data: Omit<ProjectCardData, "id" | "documents" | "feed">) => {
    const newCard: ProjectCardData = { ...data, id: nanoid(8), documents: createDefaultDocuments(), feed: [] };
    setStateInternal(prev => {
      const next = { ...prev, cards: [...prev.cards, newCard] };
      saveLocalState(next);
      if (canWrite) setDoc(doc(db, CARDS_COLLECTION, newCard.id), sanitizeForFirestore(newCard)).catch(console.error);
      return next;
    });
  }, [canWrite]);

  const updateCard = useCallback((id: string, updates: Partial<ProjectCardData>) => {
    setStateInternal(prev => {
      const next = { ...prev, cards: prev.cards.map(c => c.id === id ? { ...c, ...updates } : c) };
      saveLocalState(next);
      if (canWrite) updateDoc(doc(db, CARDS_COLLECTION, id), sanitizeForFirestore(updates)).catch(console.error);
      return next;
    });
  }, [canWrite]);

  const removeCard = useCallback((id: string) => {
    setStateInternal(prev => {
      const next = { ...prev, cards: prev.cards.filter(c => c.id !== id) };
      saveLocalState(next);
      if (canWrite) deleteDoc(doc(db, CARDS_COLLECTION, id)).catch(console.error);
      return next;
    });
  }, [canWrite]);

  const toggleDocument = useCallback((cardId: string, docId: string) => {
    setStateInternal(prev => {
      const nextCards = prev.cards.map(c => {
        if (c.id !== cardId) return c;
        const d = c.documents.find(d => d.id === docId);
        if (!d) return c;
        const newEnabled = !d.enabled;
        const now = new Date();
        const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        const dateStr = now.toLocaleDateString("pt-BR");
        
        const newFeed = newEnabled ? [{ id: nanoid(8), message: `${d.label} de ${c.name} enviado às ${timeStr} de ${dateStr}`, timestamp: now.toISOString() }, ...c.feed] : c.feed;
        const newDocs = c.documents.map(doc => doc.id === docId ? { ...doc, enabled: newEnabled, sentAt: newEnabled ? now.toISOString() : undefined } : doc);
        
        const updated = { ...c, documents: newDocs, feed: newFeed };
        if (canWrite) setDoc(doc(db, CARDS_COLLECTION, cardId), sanitizeForFirestore(updated)).catch(console.error);
        return updated;
      });
      const next = { ...prev, cards: nextCards };
      saveLocalState(next);
      return next;
    });
  }, [canWrite]);

  const addDocument = useCallback((cardId: string, label: string) => {
    setStateInternal(prev => {
      const nextCards = prev.cards.map(c => {
        if (c.id !== cardId) return c;
        const updated = { ...c, documents: [...c.documents, { id: nanoid(8), label, enabled: false }] };
        if (canWrite) updateDoc(doc(db, CARDS_COLLECTION, cardId), { documents: sanitizeForFirestore(updated.documents) }).catch(console.error);
        return updated;
      });
      const next = { ...prev, cards: nextCards };
      saveLocalState(next);
      return next;
    });
  }, [canWrite]);

  const removeDocument = useCallback((cardId: string, docId: string) => {
    setStateInternal(prev => {
      const nextCards = prev.cards.map(c => {
        if (c.id !== cardId) return c;
        const updated = { ...c, documents: c.documents.filter(d => d.id !== docId) };
        if (canWrite) updateDoc(doc(db, CARDS_COLLECTION, cardId), { documents: sanitizeForFirestore(updated.documents) }).catch(console.error);
        return updated;
      });
      const next = { ...prev, cards: nextCards };
      saveLocalState(next);
      return next;
    });
  }, [canWrite]);

  const reorderDocument = useCallback((cardId: string, docId: string, direction: "up" | "down") => {
    setStateInternal(prev => {
      const nextCards = prev.cards.map(c => {
        if (c.id !== cardId) return c;
        const docs = [...c.documents];
        const idx = docs.findIndex(d => d.id === docId);
        if (idx < 0) return c;
        const swapIdx = direction === "up" ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= docs.length) return c;
        [docs[idx], docs[swapIdx]] = [docs[swapIdx], docs[idx]];
        const updated = { ...c, documents: docs };
        if (canWrite) updateDoc(doc(db, CARDS_COLLECTION, cardId), { documents: sanitizeForFirestore(updated.documents) }).catch(console.error);
        return updated;
      });
      const next = { ...prev, cards: nextCards };
      saveLocalState(next);
      return next;
    });
  }, [canWrite]);

  const addTeamMember = useCallback((cardId: string, role: TeamMember["role"], name: string) => {
    setStateInternal(prev => {
      const nextCards = prev.cards.map(c => {
        if (c.id !== cardId) return c;
        const updated = { ...c, team: [...c.team, { id: nanoid(8), role, name }] };
        if (canWrite) updateDoc(doc(db, CARDS_COLLECTION, cardId), { team: sanitizeForFirestore(updated.team) }).catch(console.error);
        return updated;
      });
      const next = { ...prev, cards: nextCards };
      saveLocalState(next);
      return next;
    });
  }, [canWrite]);

  const updateTeamMember = useCallback((cardId: string, memberId: string, name: string) => {
    setStateInternal(prev => {
      const nextCards = prev.cards.map(c => {
        if (c.id !== cardId) return c;
        const updated = { ...c, team: c.team.map(t => t.id === memberId ? { ...t, name } : t) };
        if (canWrite) updateDoc(doc(db, CARDS_COLLECTION, cardId), { team: sanitizeForFirestore(updated.team) }).catch(console.error);
        return updated;
      });
      const next = { ...prev, cards: nextCards };
      saveLocalState(next);
      return next;
    });
  }, [canWrite]);

  const removeTeamMember = useCallback((cardId: string, memberId: string) => {
    setStateInternal(prev => {
      const nextCards = prev.cards.map(c => {
        if (c.id !== cardId) return c;
        const updated = { ...c, team: c.team.filter(t => t.id !== memberId) };
        if (canWrite) updateDoc(doc(db, CARDS_COLLECTION, cardId), { team: sanitizeForFirestore(updated.team) }).catch(console.error);
        return updated;
      });
      const next = { ...prev, cards: nextCards };
      saveLocalState(next);
      return next;
    });
  }, [canWrite]);

  const addFeedEntry = useCallback((cardId: string, message: string) => {
    setStateInternal(prev => {
      const nextCards = prev.cards.map(c => {
        if (c.id !== cardId) return c;
        const updated = { ...c, feed: [{ id: nanoid(8), message, timestamp: new Date().toISOString() }, ...c.feed] };
        if (canWrite) updateDoc(doc(db, CARDS_COLLECTION, cardId), { feed: sanitizeForFirestore(updated.feed) }).catch(console.error);
        return updated;
      });
      const next = { ...prev, cards: nextCards };
      saveLocalState(next);
      return next;
    });
  }, [canWrite]);

  const removeFeedEntry = useCallback((cardId: string, feedId: string) => {
    setStateInternal(prev => {
      const nextCards = prev.cards.map(c => {
        if (c.id !== cardId) return c;
        const updated = { ...c, feed: c.feed.filter(f => f.id !== feedId) };
        if (canWrite) updateDoc(doc(db, CARDS_COLLECTION, cardId), { feed: sanitizeForFirestore(updated.feed) }).catch(console.error);
        return updated;
      });
      const next = { ...prev, cards: nextCards };
      saveLocalState(next);
      return next;
    });
  }, [canWrite]);

  const setStateBulk = useCallback(async (newState: ProjectCardsState) => {
    const validated: ProjectCardsState = { cards: newState.cards || [] };
    if (canWrite) {
      try {
        const existing = await getDocs(collection(db, CARDS_COLLECTION));
        const deleteBatch = writeBatch(db);
        existing.forEach(d => deleteBatch.delete(d.ref));
        await deleteBatch.commit();
        const addBatch = writeBatch(db);
        validated.cards.forEach(c => addBatch.set(doc(db, CARDS_COLLECTION, c.id), sanitizeForFirestore(c)));
        await addBatch.commit();
      } catch (err) { console.error("Bulk setState error:", err); }
    }
    saveLocalState(validated);
    setStateInternal(validated);
  }, [canWrite]);

  return (
    <ProjectCardsContext.Provider value={{
      state, addCard, updateCard, removeCard, toggleDocument, addDocument, removeDocument,
      reorderDocument, addTeamMember, updateTeamMember, removeTeamMember, addFeedEntry, removeFeedEntry,
      setState: setStateBulk as any,
    }}>
      {children}
    </ProjectCardsContext.Provider>
  );
}

export function useProjectCards() {
  const ctx = useContext(ProjectCardsContext);
  if (!ctx) throw new Error("useProjectCards must be used within ProjectCardsProvider");
  return ctx;
}
