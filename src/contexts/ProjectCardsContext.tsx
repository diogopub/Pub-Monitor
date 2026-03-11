import React, { createContext, useContext, useState, useCallback } from "react";
import { nanoid } from "nanoid";

// ─── Types ───────────────────────────────────────────────────────
export interface ProjectDocument {
  id: string;
  label: string;
  enabled: boolean; // toggle state
  sentAt?: string; // ISO timestamp when toggled on
}

export interface TeamMember {
  id: string;
  role: "criacao" | "arq" | "3d";
  name: string;
}

// dailyAllocations: Record<"YYYY-MM-DD", role[]>  e.g. { "2026-03-10": ["criacao","3d"] }
export type DailyAllocations = Record<string, string[]>;

export interface ProjectCardData {
  id: string;
  name: string;
  client: string;
  hub?: string;
  active?: boolean;
  entryDate: string;
  deliveryDate: string;
  team: TeamMember[];
  documents: ProjectDocument[];
  feed: FeedEntry[];
  dailyAllocations?: DailyAllocations;
}

export interface FeedEntry {
  id: string;
  message: string;
  timestamp: string; // ISO
}

export const DEFAULT_DOCUMENTS: Omit<ProjectDocument, "id">[] = [
  { label: "ESTUDO IA", enabled: false },
  { label: "PRÉVIA PLANTA", enabled: false },
  { label: "PRÉVIA 3D", enabled: false },
  { label: "FINAL PLANTA", enabled: false },
  { label: "FINAL 3D", enabled: false },
  { label: "DESCRITIVO", enabled: false },
];

// ─── State ───────────────────────────────────────────────────────
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

// ─── Persistence ─────────────────────────────────────────────────
const STORAGE_KEY = "pub-project-cards";

function createDefaultDocuments(): ProjectDocument[] {
  return DEFAULT_DOCUMENTS.map((d) => ({ ...d, id: nanoid(8) }));
}

function migrateTeam(team: any): TeamMember[] {
  if (Array.isArray(team)) return team;
  // Migrate old { criacao, arq, "3d" } format to array
  const members: TeamMember[] = [];
  if (team?.criacao) members.push({ id: nanoid(8), role: "criacao", name: team.criacao });
  if (team?.arq) members.push({ id: nanoid(8), role: "arq", name: team.arq });
  if (team?.["3d"]) members.push({ id: nanoid(8), role: "3d", name: team["3d"] });
  return members;
}

function loadState(): ProjectCardsState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.cards)) {
        return {
          ...parsed,
          cards: parsed.cards.map((c: any) => ({
            ...c,
            team: migrateTeam(c.team),
            documents: Array.isArray(c.documents) ? c.documents : createDefaultDocuments(),
            feed: Array.isArray(c.feed) ? c.feed : [],
          })),
        };
      }
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return { cards: [] };
}

function saveState(state: ProjectCardsState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

// ─── Context ─────────────────────────────────────────────────────
const ProjectCardsContext = createContext<ProjectCardsContextType | null>(null);

export function ProjectCardsProvider({ children }: { children: React.ReactNode }) {
  const [state, setStateInternal] = useState<ProjectCardsState>(loadState);

  const updateState = useCallback((updater: (prev: ProjectCardsState) => ProjectCardsState) => {
    setStateInternal((prev) => {
      const next = updater(prev);
      saveState(next);
      return next;
    });
  }, []);

  const addCard = useCallback(
    (data: Omit<ProjectCardData, "id" | "documents" | "feed">) => {
      updateState((s) => ({
        ...s,
        cards: [
          ...s.cards,
          {
            ...data,
            id: nanoid(8),
            documents: createDefaultDocuments(),
            feed: [],
          },
        ],
      }));
    },
    [updateState]
  );

  const updateCard = useCallback(
    (id: string, updates: Partial<Omit<ProjectCardData, "id">>) => {
      updateState((s) => ({
        ...s,
        cards: s.cards.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      }));
    },
    [updateState]
  );

  const removeCard = useCallback(
    (id: string) => {
      updateState((s) => ({
        ...s,
        cards: s.cards.filter((c) => c.id !== id),
      }));
    },
    [updateState]
  );

  const toggleDocument = useCallback(
    (cardId: string, docId: string) => {
      updateState((s) => ({
        ...s,
        cards: s.cards.map((c) => {
          if (c.id !== cardId) return c;
          const doc = c.documents.find((d) => d.id === docId);
          if (!doc) return c;
          const newEnabled = !doc.enabled;
          const now = new Date();
          const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          const dateStr = now.toLocaleDateString("pt-BR");

          let newFeed = c.feed;
          if (newEnabled) {
            newFeed = [
              {
                id: nanoid(8),
                message: `${doc.label} de ${c.name} enviado às ${timeStr} de ${dateStr}`,
                timestamp: now.toISOString(),
              },
              ...c.feed,
            ];
          }

          return {
            ...c,
            documents: c.documents.map((d) =>
              d.id === docId
                ? { ...d, enabled: newEnabled, sentAt: newEnabled ? now.toISOString() : undefined }
                : d
            ),
            feed: newFeed,
          };
        }),
      }));
    },
    [updateState]
  );

  const addDocument = useCallback(
    (cardId: string, label: string) => {
      updateState((s) => ({
        ...s,
        cards: s.cards.map((c) =>
          c.id === cardId
            ? { ...c, documents: [...c.documents, { id: nanoid(8), label, enabled: false }] }
            : c
        ),
      }));
    },
    [updateState]
  );

  const removeDocument = useCallback(
    (cardId: string, docId: string) => {
      updateState((s) => ({
        ...s,
        cards: s.cards.map((c) =>
          c.id === cardId
            ? { ...c, documents: c.documents.filter((d) => d.id !== docId) }
            : c
        ),
      }));
    },
    [updateState]
  );

  const reorderDocument = useCallback(
    (cardId: string, docId: string, direction: "up" | "down") => {
      updateState((s) => ({
        ...s,
        cards: s.cards.map((c) => {
          if (c.id !== cardId) return c;
          const docs = [...c.documents];
          const idx = docs.findIndex((d) => d.id === docId);
          if (idx < 0) return c;
          const swapIdx = direction === "up" ? idx - 1 : idx + 1;
          if (swapIdx < 0 || swapIdx >= docs.length) return c;
          [docs[idx], docs[swapIdx]] = [docs[swapIdx], docs[idx]];
          return { ...c, documents: docs };
        }),
      }));
    },
    [updateState]
  );

  const addTeamMember = useCallback(
    (cardId: string, role: "criacao" | "arq" | "3d", name: string) => {
      updateState((s) => ({
        ...s,
        cards: s.cards.map((c) =>
          c.id === cardId
            ? { ...c, team: [...c.team, { id: nanoid(8), role, name }] }
            : c
        ),
      }));
    },
    [updateState]
  );

  const updateTeamMember = useCallback(
    (cardId: string, memberId: string, name: string) => {
      updateState((s) => ({
        ...s,
        cards: s.cards.map((c) =>
          c.id === cardId
            ? { ...c, team: c.team.map((t) => (t.id === memberId ? { ...t, name } : t)) }
            : c
        ),
      }));
    },
    [updateState]
  );

  const removeTeamMember = useCallback(
    (cardId: string, memberId: string) => {
      updateState((s) => ({
        ...s,
        cards: s.cards.map((c) =>
          c.id === cardId
            ? { ...c, team: c.team.filter((t) => t.id !== memberId) }
            : c
        ),
      }));
    },
    [updateState]
  );

  const addFeedEntry = useCallback(
    (cardId: string, message: string) => {
      updateState((s) => ({
        ...s,
        cards: s.cards.map((c) =>
          c.id === cardId
            ? {
                ...c,
                feed: [
                  { id: nanoid(8), message, timestamp: new Date().toISOString() },
                  ...c.feed,
                ],
              }
            : c
        ),
      }));
    },
    [updateState]
  );

  const removeFeedEntry = useCallback(
    (cardId: string, feedId: string) => {
      updateState((s) => ({
        ...s,
        cards: s.cards.map((c) =>
          c.id === cardId
            ? { ...c, feed: c.feed.filter((f) => f.id !== feedId) }
            : c
        ),
      }));
    },
    [updateState]
  );

  return (
    <ProjectCardsContext.Provider
      value={{
        state,
        addCard,
        updateCard,
        removeCard,
        toggleDocument,
        addDocument,
        removeDocument,
        reorderDocument,
        addTeamMember,
        updateTeamMember,
        removeTeamMember,
        addFeedEntry,
        removeFeedEntry,
        setState: useCallback((newState: ProjectCardsState) => {
          saveState(newState);
          setStateInternal(newState);
        }, []),
      }}
    >
      {children}
    </ProjectCardsContext.Provider>
  );
}

export function useProjectCards() {
  const ctx = useContext(ProjectCardsContext);
  if (!ctx) throw new Error("useProjectCards must be used within ProjectCardsProvider");
  return ctx;
}
