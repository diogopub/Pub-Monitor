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
  addDoc 
} from "firebase/firestore";
import { useAuth } from "./AuthContext";
import { usePermissions } from "./PermissionsContext";
import { useNetwork } from "./NetworkContext";
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
  color: "white" | "green" | "yellow" | "red";
  label?: string;
  labels: string[];
  completedLabels?: boolean[];
  completedBy?: (string | null)[]; // name of the user who checked each label
}

export type ProjectStatus = "em-desenvolvimento" | "onboarding" | "standby" | "aguardando-retorno" | "wip" | "inativo" | "declinado" | "proposta-recusada";

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
  presentationDate?: string;
  estimatedDailies?: number;
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
  addCard: (data: Omit<ProjectCardData, "documents" | "feed"> & { id?: string }) => void;
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
  togglePinStatus: (cardId: string, pinId: string, labelIndex: number, userName: string) => void;
  setState: (state: ProjectCardsState) => Promise<void>;
}

const STORAGE_KEY = "pub-project-cards-v2";
const CARDS_COLLECTION = "project_cards";
// Email notifications default list (overridden by settings)
const DEFAULT_NOTIFICATION_EMAILS = [
  "diogo@thepublic.house",
  "cris@thepublic.house",
  "talita@thepublic.house",
  "vinicius@thepublic.house"
];

// ─── Helpers ─────────────────────────────────────────────────────

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
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
    if (!saved) return { cards: [] };
    const parsed = JSON.parse(saved);
    const cards = (parsed.cards || []).map((c: any) => ({
      ...c,
      team: migrateTeam(c.team),
    }));
    return { cards };
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
  const { state: networkState } = useNetwork();
  const canWrite = currentUserRole === "admin" || currentUserRole === "editor";

  // 📧 Email Notifications
  const sendEmailNotification = useCallback(async (type: "new" | "concluded", projectName: string) => {
    if (!canWrite) return;
    
    const subject = type === "new" ? "[NOVO PROJETO]" : "[PROJETO CONCLUÍDO]";
    const body = type === "new" 
      ? `O projeto "${projectName}" foi criado no Monitor.`
      : `O projeto "${projectName}" foi concluído no Monitor.`;

    const customEmails = networkState?.settings?.notificationEmails;
    const emailList = customEmails && customEmails.length > 0 
      ? customEmails 
      : DEFAULT_NOTIFICATION_EMAILS;

    try {
      await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: "service_cz37i6q",
          template_id: "template_zbcnypp",
          user_id: "F8QPrzXbV-5orJhbI",
          template_params: {
            to_email: emailList.join(","),
            subject,
            html: `<p>${body}</p>`,
          },
        }),
      });
      console.log(`[Email] Notificação enviada: ${subject}`);
    } catch (err) {
      console.error("Erro ao enviar notificação por e-mail:", err);
    }
  }, [canWrite, networkState?.settings?.notificationEmails]);

  // ☁️ SYNC FROM CLOUD
  useEffect(() => {
    const isEmbed = window.location.pathname.startsWith("/embed/");
    if (!user && !isEmbed) return;

    const cardsCol = collection(db, CARDS_COLLECTION);
    return onSnapshot(cardsCol, (snapshot) => {
      const cards: ProjectCardData[] = [];
      snapshot.forEach(d => {
        const c = d.data() as any;
        cards.push({
          ...c,
          id: (typeof c.id === 'string' && c.id.trim()) ? c.id : d.id,
          team: migrateTeam(c.team),
          documents: Array.isArray(c.documents) ? c.documents : [],
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
  const addCard = useCallback((data: Omit<ProjectCardData, "documents" | "feed"> & { id?: string }) => {
    const newCard: ProjectCardData = { 
      ...data, 
      id: data.id || nanoid(8), 
      documents: [], 
      feed: [],
      timelinePins: data.timelinePins || []
    };
    setStateInternal(prev => {
      const next = { ...prev, cards: [...prev.cards, newCard] };
      saveLocalState(next);
      return next;
    });

    if (canWrite) {
      setDoc(doc(db, CARDS_COLLECTION, newCard.id), sanitizeForFirestore(newCard))
        .then(() => {
          sendEmailNotification("new", newCard.name);
        })
        .catch(console.error);
    }
  }, [canWrite, sendEmailNotification]);

  const updateCard = useCallback((id: string, updates: Partial<ProjectCardData>) => {
    setStateInternal(prev => {
      const next = { ...prev, cards: prev.cards.map(c => c.id === id ? { ...c, ...updates } : c) };
      saveLocalState(next);
      return next;
    });

    if (canWrite) {
      // Se estamos concluindo o projeto (active passando de true/undefined para false)
      if (updates.active === false) {
        const card = state.cards.find(c => c.id === id);
        if (card && card.active !== false) {
          sendEmailNotification("concluded", card.name);
        }
      }

      updateDoc(doc(db, CARDS_COLLECTION, id), sanitizeForFirestore(updates)).catch(console.error);
    }
  }, [canWrite, state.cards, sendEmailNotification]);

  const removeCard = useCallback((id: string) => {
    setStateInternal(prev => {
      const next = { ...prev, cards: prev.cards.filter(c => c.id !== id) };
      saveLocalState(next);
      return next;
    });

    if (canWrite) {
      deleteDoc(doc(db, CARDS_COLLECTION, id)).catch(console.error);
    }
  }, [canWrite]);

  const toggleDocument = useCallback((cardId: string, docId: string) => {
    let updatedDocs: ProjectDocument[] | null = null;

    setStateInternal(prev => {
      const card = prev.cards.find(c => c.id === cardId);
      if (!card) return prev;

      const d = card.documents.find(doc => doc.id === docId);
      if (!d) return prev;

      const newEnabled = !d.enabled;
      const now = new Date();

      updatedDocs = card.documents.map(doc => doc.id === docId ? { 
        ...doc, 
        enabled: newEnabled, 
        sentAt: newEnabled ? now.toISOString() : undefined 
      } : doc);

      const nextCards = prev.cards.map(c => c.id === cardId ? { ...c, documents: updatedDocs! } : c);
      const next = { ...prev, cards: nextCards };
      saveLocalState(next);
      return next;
    });

    if (canWrite && updatedDocs) {
      updateDoc(doc(db, CARDS_COLLECTION, cardId), { 
        documents: sanitizeForFirestore(updatedDocs)
      }).catch(console.error);
    }
  }, [canWrite]);

  const addDocument = useCallback((cardId: string, label: string) => {
    let newDocs: ProjectDocument[] | null = null;

    setStateInternal(prev => {
      const card = prev.cards.find(c => c.id === cardId);
      if (!card) return prev;

      newDocs = [...card.documents, { id: nanoid(8), label, enabled: false }];
      const nextCards = prev.cards.map(c => c.id === cardId ? { ...c, documents: newDocs! } : c);
      const next = { ...prev, cards: nextCards };
      saveLocalState(next);
      return next;
    });

    if (canWrite && newDocs) {
      updateDoc(doc(db, CARDS_COLLECTION, cardId), { documents: sanitizeForFirestore(newDocs) }).catch(console.error);
    }
  }, [canWrite]);

  const removeDocument = useCallback((cardId: string, docId: string) => {
    let newDocs: ProjectDocument[] | null = null;

    setStateInternal(prev => {
      const card = prev.cards.find(c => c.id === cardId);
      if (!card) return prev;

      newDocs = card.documents.filter(d => d.id !== docId);
      const nextCards = prev.cards.map(c => c.id === cardId ? { ...c, documents: newDocs! } : c);
      const next = { ...prev, cards: nextCards };
      saveLocalState(next);
      return next;
    });

    if (canWrite && newDocs) {
      updateDoc(doc(db, CARDS_COLLECTION, cardId), { documents: sanitizeForFirestore(newDocs) }).catch(console.error);
    }
  }, [canWrite]);

  const reorderDocument = useCallback((cardId: string, docId: string, direction: "up" | "down") => {
    let newDocs: ProjectDocument[] | null = null;

    setStateInternal(prev => {
      const card = prev.cards.find(c => c.id === cardId);
      if (!card) return prev;

      const docs = [...card.documents];
      const idx = docs.findIndex(d => d.id === docId);
      if (idx < 0) return prev;

      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= docs.length) return prev;

      [docs[idx], docs[swapIdx]] = [docs[swapIdx], docs[idx]];
      newDocs = docs;

      const nextCards = prev.cards.map(c => c.id === cardId ? { ...c, documents: newDocs! } : c);
      const next = { ...prev, cards: nextCards };
      saveLocalState(next);
      return next;
    });

    if (canWrite && newDocs) {
      updateDoc(doc(db, CARDS_COLLECTION, cardId), { documents: sanitizeForFirestore(newDocs) }).catch(console.error);
    }
  }, [canWrite]);

  const addTeamMember = useCallback((cardId: string, role: TeamMember["role"], name: string) => {
    let nextTeam: TeamMember[] | null = null;

    setStateInternal(prev => {
      const card = prev.cards.find(c => c.id === cardId);
      if (!card) return prev;

      nextTeam = [...card.team, { id: nanoid(8), role, name }];
      const nextCards = prev.cards.map(c => c.id === cardId ? { ...c, team: nextTeam! } : c);
      const next = { ...prev, cards: nextCards };
      saveLocalState(next);
      return next;
    });

    if (canWrite && nextTeam) {
      updateDoc(doc(db, CARDS_COLLECTION, cardId), { team: sanitizeForFirestore(nextTeam) }).catch(console.error);
    }
  }, [canWrite]);

  const updateTeamMember = useCallback((cardId: string, memberId: string, name: string) => {
    let nextTeam: TeamMember[] | null = null;

    setStateInternal(prev => {
      const card = prev.cards.find(c => c.id === cardId);
      if (!card) return prev;

      nextTeam = card.team.map(t => t.id === memberId ? { ...t, name } : t);
      const nextCards = prev.cards.map(c => c.id === cardId ? { ...c, team: nextTeam! } : c);
      const next = { ...prev, cards: nextCards };
      saveLocalState(next);
      return next;
    });

    if (canWrite && nextTeam) {
      updateDoc(doc(db, CARDS_COLLECTION, cardId), { team: sanitizeForFirestore(nextTeam) }).catch(console.error);
    }
  }, [canWrite]);

  const removeTeamMember = useCallback((cardId: string, memberId: string) => {
    let nextTeam: TeamMember[] | null = null;

    setStateInternal(prev => {
      const card = prev.cards.find(c => c.id === cardId);
      if (!card) return prev;

      nextTeam = card.team.filter(t => t.id !== memberId);
      const nextCards = prev.cards.map(c => c.id === cardId ? { ...c, team: nextTeam! } : c);
      const next = { ...prev, cards: nextCards };
      saveLocalState(next);
      return next;
    });

    if (canWrite && nextTeam) {
      updateDoc(doc(db, CARDS_COLLECTION, cardId), { team: sanitizeForFirestore(nextTeam) }).catch(console.error);
    }
  }, [canWrite]);

  const addFeedEntry = useCallback((cardId: string, message: string) => {
    let nextFeed: FeedEntry[] | null = null;

    setStateInternal(prev => {
      const card = prev.cards.find(c => c.id === cardId);
      if (!card) return prev;

      nextFeed = [{ id: nanoid(8), message, timestamp: new Date().toISOString() }, ...card.feed];
      const nextCards = prev.cards.map(c => c.id === cardId ? { ...c, feed: nextFeed! } : c);
      const next = { ...prev, cards: nextCards };
      saveLocalState(next);
      return next;
    });

    if (canWrite && nextFeed) {
      updateDoc(doc(db, CARDS_COLLECTION, cardId), { feed: sanitizeForFirestore(nextFeed) }).catch(console.error);
    }
  }, [canWrite]);

  const removeFeedEntry = useCallback((cardId: string, feedId: string) => {
    let nextFeed: FeedEntry[] | null = null;

    setStateInternal(prev => {
      const card = prev.cards.find(c => c.id === cardId);
      if (!card) return prev;

      nextFeed = card.feed.filter(f => f.id !== feedId);
      const nextCards = prev.cards.map(c => c.id === cardId ? { ...c, feed: nextFeed! } : c);
      const next = { ...prev, cards: nextCards };
      saveLocalState(next);
      return next;
    });

    if (canWrite && nextFeed) {
      updateDoc(doc(db, CARDS_COLLECTION, cardId), { feed: sanitizeForFirestore(nextFeed) }).catch(console.error);
    }
  }, [canWrite]);

  const togglePinStatus = useCallback((cardId: string, pinId: string, labelIndex: number, userName: string) => {
    let updatedPins: TimelinePin[] | null = null;
    let updatedFeed: FeedEntry[] | null = null;

    setStateInternal(prev => {
      const card = prev.cards.find(c => c.id === cardId);
      if (!card || !card.timelinePins) return prev;

      const pin = card.timelinePins.find(p => p.id === pinId);
      if (!pin) return prev;

      const completedLabels = pin.completedLabels ? [...pin.completedLabels] : new Array(pin.labels.length).fill(false);
      const completedBy = pin.completedBy ? [...pin.completedBy] : new Array(pin.labels.length).fill(null);
      
      const newStatus = !completedLabels[labelIndex];
      completedLabels[labelIndex] = newStatus;
      completedBy[labelIndex] = newStatus ? userName : null;

      const newPin = { ...pin, completedLabels, completedBy };
      updatedPins = card.timelinePins.map(p => p.id === pinId ? newPin : p);

      if (newStatus) {
        const now = new Date();
        const timeStr = formatTime(now);
        const dateStr = now.toLocaleDateString("pt-BR");
        const displayLabel = pin.labels[labelIndex] || "ENTRADA";
        const message = `${displayLabel} do projeto ${card.name} às ${timeStr} de ${dateStr}`;
        updatedFeed = [{ id: nanoid(8), message, timestamp: now.toISOString() }, ...card.feed];
      } else {
        updatedFeed = card.feed;
      }

      const next = {
        ...prev,
        cards: prev.cards.map(c => c.id === cardId ? { ...c, timelinePins: updatedPins!, feed: updatedFeed! } : c)
      };
      saveLocalState(next);
      return next;
    });

    // Bypass canWrite specifically for this action to allow viewers to mark tasks
    if (updatedPins && updatedFeed) {
      updateDoc(doc(db, CARDS_COLLECTION, cardId), { 
        timelinePins: sanitizeForFirestore(updatedPins),
        feed: sanitizeForFirestore(updatedFeed)
      }).catch(console.error);
    }
  }, []);

  const setStateBulk = useCallback(async (newState: ProjectCardsState) => {
    const validated: ProjectCardsState = { cards: newState.cards || [] };
    
    // Otimista
    setStateInternal(validated);
    saveLocalState(validated);

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
  }, [canWrite]);

  return (
    <ProjectCardsContext.Provider value={{
      state, addCard, updateCard, removeCard, toggleDocument, addDocument, removeDocument,
      reorderDocument, addTeamMember, updateTeamMember, removeTeamMember, addFeedEntry, removeFeedEntry,
      togglePinStatus,
      setState: setStateBulk,
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

