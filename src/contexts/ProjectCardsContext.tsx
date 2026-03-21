import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { nanoid } from "nanoid";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useAuth } from "./AuthContext";
import { usePermissions } from "./PermissionsContext";
import { sanitizeForFirestore } from "@/lib/utils";

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

// dailyAllocations: Record<"YYYY-MM-DD", role[]>
export type DailyAllocations = Record<string, string[]>;

export interface TimelinePin {
  id: string;
  date: string; // ISO
  color: "white" | "yellow" | "red";
  label?: string; // legacy
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

const DEFAULT_CARDS: ProjectCardData[] = [
  {
    "name": "GULOZITOS",
    "client": "DIRETO",
    "entryDate": "2026-03-05",
    "deliveryDate": "2026-03-20",
    "team": [
      { "id": "Htqt-1_P", "role": "criacao", "name": "Rod" },
      { "id": "017X5IEw", "role": "arq", "name": "Paula" },
      { "id": "Ub4f7aiY", "role": "3d", "name": "Marcel" }
    ],
    "id": "8IkoPBzY",
    "documents": [
      { "label": "ESTUDO IA", "enabled": false, "id": "P38rdlYY" },
      { "label": "PRÉVIA PLANTA", "enabled": false, "id": "T2-eBz7f" },
      { "label": "PRÉVIA 3D", "enabled": false, "id": "m2Rvl0Hj" },
      { "label": "FINAL PLANTA", "enabled": false, "id": "9vc4Pa4-" },
      { "label": "FINAL 3D", "enabled": false, "id": "BCn-hw3O" },
      { "label": "DESCRITIVO", "enabled": false, "id": "RbbXrXTb" }
    ],
    "feed": [],
    "dailyAllocations": {
      "2026-03-06": ["criacao"],
      "2026-03-09": ["criacao", "arq"],
      "2026-03-12": ["criacao"],
      "2026-03-16": ["criacao"],
      "2026-03-17": ["arq", "3d"]
    },
    "timelinePins": [
      { "id": "KPMwDQ2X", "date": "2026-03-06", "color": "white", "labels": ["ENTENDIMENTO BRIEFING"] },
      { "id": "ZOthvrkz", "date": "2026-03-09", "color": "white", "labels": ["ENTENDIMENTO BRIEFING", "KICKOFF CRIATIVO", "PRÉVIA PLANTA"] },
      { "id": "huIYl9i-", "date": "2026-03-12", "color": "white", "labels": ["PRÉVIA IA"] },
      { "id": "605AZvfK", "date": "2026-03-16", "color": "white", "labels": ["PRÉVIA IA"] },
      { "id": "mL9drVPX", "date": "2026-03-18", "color": "white", "labels": ["PRÉVIA 3D", "PRÉVIA PLANTA", "DESCRITIVO"] },
      { "id": "BKP5zAvD", "date": "2026-03-20", "color": "white", "labels": ["FINAL 3D", "FINAL PLANTA", "ORÇAMENTO"] }
    ]
  },
  {
    "name": "SESC SENAC",
    "client": "Direto",
    "entryDate": "2026-02-20",
    "deliveryDate": "2026-03-11",
    "team": [
      { "id": "6YF8qVY_", "role": "criacao", "name": "Rod" },
      { "id": "CNmEhTbj", "role": "arq", "name": "Paola" },
      { "id": "gQ-pOfZ8", "role": "3d", "name": "Julio" }
    ],
    "id": "GPhSiPJl",
    "documents": [
      { "label": "ESTUDO IA", "enabled": false, "id": "GYZsxegM" },
      { "label": "PRÉVIA PLANTA", "enabled": false, "id": "8dboyQZs" },
      { "label": "PRÉVIA 3D", "enabled": false, "id": "apqZ9FD-" },
      { "label": "FINAL PLANTA", "enabled": false, "id": "rNsXiRbU" },
      { "label": "FINAL 3D", "enabled": false, "id": "dknHfBK4" },
      { "label": "DESCRITIVO", "enabled": false, "id": "XfzFtaXt" }
    ],
    "feed": [],
    "active": true,
    "dailyAllocations": {
      "2026-02-23": ["criacao"],
      "2026-02-24": ["criacao", "arq"],
      "2026-02-25": ["3d", "arq"],
      "2026-02-26": ["3d", "arq"],
      "2026-02-27": ["3d"],
      "2026-03-06": ["3d", "arq", "criacao"],
      "2026-03-05": ["3d"]
    }
  },
  {
    "name": "TIKTOK",
    "client": "Hub",
    "entryDate": "2026-02-05",
    "deliveryDate": "2026-03-09",
    "team": [
      { "id": "eLHmEx_U", "role": "arq", "name": "Paola" },
      { "id": "MSaQ7o2D", "role": "3d", "name": "Evandro" },
      { "id": "7OOzL38s", "role": "criacao", "name": "Rod" }
    ],
    "id": "VLEC3mz6",
    "documents": [
      { "label": "ESTUDO IA", "enabled": false, "id": "1IKzJZgJ" },
      { "label": "PRÉVIA PLANTA", "enabled": false, "id": "Ip7_KTPl" },
      { "label": "PRÉVIA 3D", "enabled": false, "id": "rSEi-9HI" },
      { "label": "FINAL PLANTA", "enabled": false, "id": "J2Zi0RFT" },
      { "label": "FINAL 3D", "enabled": false, "id": "7skwL4fy" },
      { "label": "DESCRITIVO", "enabled": false, "id": "L7l4K0Va" }
    ],
    "feed": [],
    "active": false
  },
  {
    "name": "TNS SUMMIT",
    "client": "Direto",
    "entryDate": "2026-01-07",
    "deliveryDate": "2026-03-12",
    "team": [
      { "id": "eN1aERrM", "role": "criacao", "name": "Evandro" },
      { "id": "m93u5R-T", "role": "arq", "name": "Evandro" },
      { "id": "Rq2M8CLT", "role": "3d", "name": "Evandro" }
    ],
    "id": "2S4yXlfs",
    "documents": [
      { "label": "ESTUDO IA", "enabled": false, "id": "M-FAl515" },
      { "label": "PRÉVIA PLANTA", "enabled": false, "id": "nmEJBkH0" },
      { "label": "PRÉVIA 3D", "enabled": false, "id": "HKwis65b" },
      { "label": "FINAL PLANTA", "enabled": false, "id": "AzRueVOm" },
      { "label": "FINAL 3D", "enabled": false, "id": "3eEdLcFY" },
      { "label": "DESCRITIVO", "enabled": false, "id": "1-DfCcHP" }
    ],
    "feed": [],
    "dailyAllocations": {
      "2026-03-03": ["arq"],
      "2026-03-05": ["arq"],
      "2026-03-09": ["3d"],
      "2026-03-10": ["3d"],
      "2026-03-11": ["3d"],
      "2026-03-12": ["arq"]
    }
  },
  {
    "name": "BEFLY BE TOGETHER",
    "client": "Haute",
    "entryDate": "2026-03-03",
    "deliveryDate": "2026-03-10",
    "team": [
      { "id": "vBbSce20", "role": "criacao", "name": "Rod" },
      { "id": "XRbaTDxg", "role": "arq", "name": "Paola" },
      { "id": "2l5hANo4", "role": "3d", "name": "Marcel" },
      { "id": "SP4vkKVe", "role": "3d", "name": "Mari" }
    ],
    "id": "tNT6ivzP",
    "documents": [
      { "label": "ESTUDO IA", "enabled": false, "id": "qDgjZ_wg" },
      { "label": "PRÉVIA PLANTA", "enabled": false, "id": "gxQaloVZ" },
      { "label": "PRÉVIA 3D", "enabled": false, "id": "TzMWXaiz" },
      { "label": "FINAL PLANTA", "enabled": false, "id": "QrrfPF5H" },
      { "label": "FINAL 3D", "enabled": false, "id": "g2s06K5e" },
      { "label": "DESCRITIVO", "enabled": false, "id": "ero63q0e" }
    ],
    "feed": [],
    "dailyAllocations": {
      "2026-03-03": ["arq", "criacao"],
      "2026-03-04": ["arq"],
      "2026-03-05": ["arq", "3d"],
      "2026-03-06": ["arq", "3d"],
      "2026-03-09": ["3d", "arq"],
      "2026-03-10": ["3d"]
    },
    "timelinePins": [
      { "id": "qn4jOphT", "date": "2026-03-03", "color": "white", "labels": ["ENTRADA"] }
    ]
  },
  {
    "name": "MBRF",
    "client": "Croquis",
    "entryDate": "2026-02-26",
    "deliveryDate": "2026-03-11",
    "team": [
      { "id": "9LZ9g32j", "role": "criacao", "name": "Rod" },
      { "id": "qq7GvaPc", "role": "arq", "name": "" },
      { "id": "DM9I_MHN", "role": "3d", "name": "Julio" }
    ],
    "id": "2iJoYkNk",
    "documents": [
      { "label": "ESTUDO IA", "enabled": false, "id": "b1ypPrwW" },
      { "label": "PRÉVIA PLANTA", "enabled": false, "id": "y3oaZ0kg" },
      { "label": "PRÉVIA 3D", "enabled": false, "id": "mapSNUrJ" },
      { "label": "FINAL PLANTA", "enabled": false, "id": "UDzpeKKx" },
      { "label": "FINAL 3D", "enabled": false, "id": "xZ1OIkWH" },
      { "label": "DESCRITIVO", "enabled": false, "id": "f1FP8zzR" }
    ],
    "feed": [],
    "dailyAllocations": {
      "2026-03-02": ["criacao", "arq", "3d"],
      "2026-03-03": ["3d"],
      "2026-03-04": ["3d", "arq"],
      "2026-03-05": ["3d", "arq"],
      "2026-03-06": ["3d"],
      "2026-03-09": ["arq"],
      "2026-03-10": ["3d", "arq"],
      "2026-03-11": ["3d"],
      "2026-03-12": ["3d", "arq"]
    }
  },
  {
    "name": "NESTLÉ",
    "client": "Croquis",
    "entryDate": "2026-03-10",
    "deliveryDate": "2026-03-20",
    "team": [
      { "id": "fLjgTQdF", "role": "criacao", "name": "Rod" },
      { "id": "7o08fYPg", "role": "arq", "name": "Paola" },
      { "id": "K505ovMs", "role": "3d", "name": "Marcel" }
    ],
    "id": "Kyx_zt5V",
    "documents": [
      { "label": "ESTUDO IA", "enabled": false, "id": "E4VYXFYt" },
      { "label": "PRÉVIA PLANTA", "enabled": false, "id": "sZ7iyX42" },
      { "label": "PRÉVIA 3D", "enabled": false, "id": "nzWxCfHM" },
      { "label": "FINAL PLANTA", "enabled": false, "id": "mvA2xHnN" },
      { "label": "FINAL 3D", "enabled": false, "id": "9xq2p1dz" },
      { "label": "DESCRITIVO", "enabled": false, "id": "Ubbt3KTN" }
    ],
    "feed": [],
    "dailyAllocations": {
      "2026-03-11": ["criacao"],
      "2026-03-12": ["criacao", "3d", "arq"],
      "2026-03-13": ["arq", "3d"],
      "2026-03-20": ["arq", "3d"],
      "2026-03-19": ["arq", "3d"],
      "2026-03-16": ["3d"],
      "2026-03-17": ["3d"],
      "2026-03-18": ["3d"]
    }
  },
  {
    "name": "HONDA INTERLAGOS",
    "client": "Itzon",
    "entryDate": "2026-02-25",
    "deliveryDate": "2026-03-05",
    "team": [
      { "id": "1T7GjKRR", "role": "criacao", "name": "Rod" },
      { "id": "-sOm6zsV", "role": "arq", "name": "Paula" },
      { "id": "7vFrnjrM", "role": "3d", "name": "Marcel" }
    ],
    "id": "zwTpeSmf",
    "documents": [
      { "label": "ESTUDO IA", "enabled": false, "id": "281XfeJP" },
      { "label": "PRÉVIA PLANTA", "enabled": false, "id": "nTjMfwYv" },
      { "label": "PRÉVIA 3D", "enabled": false, "id": "XOck3G1V" },
      { "label": "FINAL PLANTA", "enabled": false, "id": "8vhE6c9S" },
      { "label": "FINAL 3D", "enabled": false, "id": "pzJAO0V0" },
      { "label": "DESCRITIVO", "enabled": false, "id": "7tfMfbHF" }
    ],
    "feed": [],
    "active": false
  },
  {
    "name": "GEELY EX5",
    "client": "Holding",
    "entryDate": "2026-02-13",
    "deliveryDate": "2026-02-23",
    "team": [
      { "id": "Mceo_eMa", "role": "criacao", "name": "Rod" },
      { "id": "lBF53VBG", "role": "arq", "name": "Paola" },
      { "id": "UcrT2Lks", "role": "3d", "name": "Marcel" }
    ],
    "id": "TorDd7bS",
    "documents": [
      { "label": "ESTUDO IA", "enabled": false, "id": "tNho2zOY" },
      { "label": "PRÉVIA PLANTA", "enabled": false, "id": "fayUTznm" },
      { "label": "PRÉVIA 3D", "enabled": false, "id": "QZQTgD2Z" },
      { "label": "FINAL PLANTA", "enabled": false, "id": "0D0zo-vb" },
      { "label": "FINAL 3D", "enabled": false, "id": "EHLNyflR" },
      { "label": "DESCRITIVO", "enabled": false, "id": "90eCA2Qq" }
    ],
    "feed": [],
    "active": false
  },
  {
    "name": "KITKAT RIR",
    "client": "Sherpa",
    "entryDate": "2026-02-02",
    "deliveryDate": "2026-02-20",
    "team": [
      { "id": "2VjI212P", "role": "criacao", "name": "Rod" },
      { "id": "a8axIFwA", "role": "arq", "name": "Paola" },
      { "id": "ckfRlH70", "role": "3d", "name": "Julio" }
    ],
    "id": "aXJB3qkC",
    "documents": [
      { "label": "ESTUDO IA", "enabled": false, "id": "Vu0rMGiu" },
      { "label": "PRÉVIA PLANTA", "enabled": false, "id": "E-LnddKM" },
      { "label": "PRÉVIA 3D", "enabled": false, "id": "X3SwXytU" },
      { "label": "FINAL PLANTA", "enabled": false, "id": "9KgTfeDj" },
      { "label": "FINAL 3D", "enabled": false, "id": "sx7iGg4A" },
      { "label": "DESCRITIVO", "enabled": false, "id": "pKgeQ_6x" }
    ],
    "feed": [],
    "active": false
  },
  {
    "name": "BOTICÁRIO DIA MÃES",
    "client": "Befour",
    "entryDate": "2026-02-05",
    "deliveryDate": "2026-02-12",
    "team": [
      { "id": "EasP-535", "role": "criacao", "name": "Rod" },
      { "id": "XW4SfJna", "role": "3d", "name": "Julio" }
    ],
    "id": "3ge1eg7M",
    "documents": [
      { "label": "ESTUDO IA", "enabled": false, "id": "akzvfXkz" },
      { "label": "PRÉVIA PLANTA", "enabled": false, "id": "phWgrt-h" },
      { "label": "PRÉVIA 3D", "enabled": false, "id": "-m41g7c8" },
      { "label": "FINAL PLANTA", "enabled": false, "id": "bMJE-pbO" },
      { "label": "FINAL 3D", "enabled": false, "id": "9jkRlP6X" },
      { "label": "DESCRITIVO", "enabled": false, "id": "n7iSeSBe" }
    ],
    "feed": [],
    "active": false
  },
  {
    "name": "JETOUR",
    "client": "Itzon",
    "entryDate": "2026-02-09",
    "deliveryDate": "2026-02-11",
    "team": [
      { "id": "0fSGO5XR", "role": "criacao", "name": "Rod" },
      { "id": "IchQ_p2O", "role": "arq", "name": "Paola" },
      { "id": "PquizhZR", "role": "3d", "name": "Marcel" }
    ],
    "id": "5x0gQuhc",
    "documents": [
      { "label": "ESTUDO IA", "enabled": false, "id": "k_WGOaK5" },
      { "label": "PRÉVIA PLANTA", "enabled": false, "id": "5f7So7sd" },
      { "label": "PRÉVIA 3D", "enabled": false, "id": "4MU_GrJT" },
      { "label": "FINAL PLANTA", "enabled": false, "id": "JPPshZrA" },
      { "label": "FINAL 3D", "enabled": false, "id": "veevdaHN" },
      { "label": "DESCRITIVO", "enabled": false, "id": "ELb4wzRi" }
    ],
    "feed": [],
    "active": false
  },
  {
    "name": "PBSF PACAEMBU",
    "client": "Plan.e",
    "entryDate": "2026-01-26",
    "deliveryDate": "2026-02-05",
    "team": [
      { "id": "hQ6g1rOb", "role": "criacao", "name": "Rod" },
      { "id": "3OsuQjtt", "role": "3d", "name": "Marcel" }
    ],
    "id": "94ngjY7L",
    "documents": [
      { "label": "ESTUDO IA", "enabled": false, "id": "5oP52gbc" },
      { "label": "PRÉVIA PLANTA", "enabled": false, "id": "sLowbzCK" },
      { "label": "PRÉVIA 3D", "enabled": false, "id": "L071rei9" },
      { "label": "FINAL PLANTA", "enabled": false, "id": "a2u3FzzQ" },
      { "label": "FINAL 3D", "enabled": false, "id": "-KziMKjM" },
      { "label": "DESCRITIVO", "enabled": false, "id": "Ide0vqlL" }
    ],
    "feed": [],
    "active": false
  },
  {
    "name": "P&G PDV",
    "client": "Croquis",
    "entryDate": "2026-01-21",
    "deliveryDate": "2026-02-02",
    "team": [
      { "id": "dG0GO1zL", "role": "criacao", "name": "Mari" },
      { "id": "kXWtiRVT", "role": "arq", "name": "Mari" },
      { "id": "3xBjHwL7", "role": "3d", "name": "Mari" }
    ],
    "id": "PyiUJCTY",
    "documents": [
      { "label": "ESTUDO IA", "enabled": false, "id": "ElKYIqBR" },
      { "label": "PRÉVIA PLANTA", "enabled": false, "id": "dJoo85rS" },
      { "label": "PRÉVIA 3D", "enabled": false, "id": "gLtBMUxQ" },
      { "label": "FINAL PLANTA", "enabled": false, "id": "bJf8YgHN" },
      { "label": "FINAL 3D", "enabled": false, "id": "wCkevUen" },
      { "label": "DESCRITIVO", "enabled": false, "id": "nyDlypFI" }
    ],
    "feed": [],
    "active": false
  },
  {
    "name": "TIM RIR",
    "client": "Sherpa",
    "entryDate": "2026-01-15",
    "deliveryDate": "2026-01-28",
    "team": [
      { "id": "KGH4M2l9", "role": "criacao", "name": "Rod" },
      { "id": "uHRJggaV", "role": "3d", "name": "Evandro" }
    ],
    "id": "3JsUW-c9",
    "documents": [
      { "label": "ESTUDO IA", "enabled": false, "id": "FRDkIuZX" },
      { "label": "PRÉVIA PLANTA", "enabled": false, "id": "g0PQ5wrL" },
      { "label": "PRÉVIA 3D", "enabled": false, "id": "JI0ZK83k" },
      { "label": "FINAL PLANTA", "enabled": false, "id": "NguWGP-N" },
      { "label": "FINAL 3D", "enabled": false, "id": "vHXx-pg-" },
      { "label": "DESCRITIVO", "enabled": false, "id": "4zYzEV7I" }
    ],
    "feed": [],
    "active": false
  },
  {
    "name": "MERCEDES 70 ANOS",
    "client": "Lampada",
    "entryDate": "2026-01-12",
    "deliveryDate": "2026-01-26",
    "team": [
      { "id": "o4DHNs2D", "role": "criacao", "name": "Rod" },
      { "id": "kVDmGvSM", "role": "3d", "name": "Julio" }
    ],
    "id": "PVcrCz_L",
    "documents": [
      { "label": "ESTUDO IA", "enabled": false, "id": "Y7JqJMOK" },
      { "label": "PRÉVIA PLANTA", "enabled": false, "id": "bRoJ-Vny" },
      { "label": "PRÉVIA 3D", "enabled": false, "id": "QsJk2VV_"
      },
      { "label": "FINAL PLANTA", "enabled": false, "id": "44QxgKcc" },
      { "label": "FINAL 3D", "enabled": false, "id": "_Exx7dWZ" },
      { "label": "DESCRITIVO", "enabled": false, "id": "cUewZVAU" }
    ],
    "feed": [],
    "active": false
  },
  {
    "name": "ZAMP",
    "client": "TV1",
    "entryDate": "2026-01-19",
    "deliveryDate": "2026-01-26",
    "team": [
      { "id": "tU89yWuR", "role": "arq", "name": "Paola" }
    ],
    "id": "K51HlkO1",
    "documents": [
      { "label": "ESTUDO IA", "enabled": false, "id": "F9wkrbfu" },
      { "label": "PRÉVIA PLANTA", "enabled": false, "id": "3hPcJa19" },
      { "label": "PRÉVIA 3D", "enabled": false, "id": "rosJ7W0i" },
      { "label": "FINAL PLANTA", "enabled": false, "id": "veeXCLCV" },
      { "label": "FINAL 3D", "enabled": false, "id": "OuG5Hovr" },
      { "label": "DESCRITIVO", "enabled": false, "id": "jRzRXEGM" }
    ],
    "feed": [],
    "active": false
  },
  {
    "name": "MBRF",
    "client": "Croquis",
    "entryDate": "2025-12-17",
    "deliveryDate": "2026-01-21",
    "team": [
      { "id": "db0vm2J5", "role": "criacao", "name": "Rod" },
      { "id": "eFuZ0sM-", "role": "3d", "name": "Evandro" }
    ],
    "id": "6ytgKP2r",
    "documents": [
      { "label": "ESTUDO IA", "enabled": false, "id": "SwFGUNQn" },
      { "label": "PRÉVIA PLANTA", "enabled": false, "id": "5GlhrwVV" },
      { "label": "PRÉVIA 3D", "enabled": false, "id": "2Ddd-cTK" },
      { "label": "FINAL PLANTA", "enabled": false, "id": "7abNg0ff" },
      { "label": "FINAL 3D", "enabled": false, "id": "l0Fh9IUv" },
      { "label": "DESCRITIVO", "enabled": false, "id": "wowBpvL0" }
    ],
    "feed": [],
    "active": false
  },
  {
    "name": "OTO SYNGENTA",
    "client": "Motivare",
    "entryDate": "2026-01-07",
    "deliveryDate": "2026-01-15",
    "team": [
      { "id": "IhAGL_yw", "role": "criacao", "name": "Julio" },
      { "id": "oUhsv3FU", "role": "arq", "name": "Paola" },
      { "id": "y4pFLMeF", "role": "3d", "name": "Julio" }
    ],
    "id": "Gjb1Y4YF",
    "documents": [
      { "label": "ESTUDO IA", "enabled": false, "id": "wuO1v_6e" },
      { "label": "PRÉVIA PLANTA", "enabled": false, "id": "vi72zECd" },
      { "label": "PRÉVIA 3D", "enabled": false, "id": "VBcmozGx" },
      { "label": "FINAL PLANTA", "enabled": false, "id": "P1PPOK2O" },
      { "label": "FINAL 3D", "enabled": false, "id": "uYr_7Ww1" },
      { "label": "DESCRITIVO", "enabled": false, "id": "avRUugro" }
    ],
    "feed": [],
    "active": false
  },
  {
    "name": "CLARO RIO OPEN",
    "client": "TV1",
    "entryDate": "2026-01-08",
    "deliveryDate": "2026-01-14",
    "team": [],
    "id": "OYuO3QyQ",
    "documents": [
      { "label": "ESTUDO IA", "enabled": false, "id": "iA5RRf7H" },
      { "label": "PRÉVIA PLANTA", "enabled": false, "id": "3GQ9fu0s" },
      { "label": "PRÉVIA 3D", "enabled": false, "id": "OrQOhq-Z" },
      { "label": "FINAL PLANTA", "enabled": false, "id": "DLINHWjS" },
      { "label": "FINAL 3D", "enabled": false, "id": "tAh0XBVe" },
      { "label": "DESCRITIVO", "enabled": false, "id": "KP0dN_5L" }
    ],
    "feed": [],
    "active": false
  },
  {
    "name": "PIRACANJUBA",
    "client": "Holding",
    "entryDate": "2025-12-10",
    "deliveryDate": "2026-01-12",
    "team": [
      { "id": "4H_q8MLh", "role": "criacao", "name": "Rod" },
      { "id": "8hXLOv-t", "role": "arq", "name": "Paola" },
      { "id": "8GLs57_b", "role": "3d", "name": "Evandro" }
    ],
    "id": "Ft6-CNpK",
    "documents": [
      { "label": "ESTUDO IA", "enabled": false, "id": "RZvdQGNi" },
      { "label": "PRÉVIA PLANTA", "enabled": false, "id": "_l8ePwMs" },
      { "label": "PRÉVIA 3D", "enabled": false, "id": "K9ojZWt_" },
      { "label": "FINAL PLANTA", "enabled": false, "id": "qKhz_GkR" },
      { "label": "FINAL 3D", "enabled": false, "id": "D_FXADkH" },
      { "label": "DESCRITIVO", "enabled": false, "id": "BALOGoHT" }
    ],
    "feed": [],
    "active": false
  },
  {
    "name": "XP RIO OPEN",
    "client": "Haute",
    "entryDate": "2025-12-09",
    "deliveryDate": "2026-01-09",
    "team": [
      { "id": "gMJpvreb", "role": "criacao", "name": "Evandro" },
      { "id": "RQv_KZb0", "role": "arq", "name": "Evandro" },
      { "id": "6bZ13-NK", "role": "3d", "name": "Evandro" }
    ],
    "id": "zLLNiirf",
    "documents": [
      { "label": "ESTUDO IA", "enabled": false, "id": "nV8uC71d" },
      { "label": "PRÉVIA PLANTA", "enabled": false, "id": "LAZoxIi3" },
      { "label": "PRÉVIA 3D", "enabled": false, "id": "9O1RuV44" },
      { "label": "FINAL PLANTA", "enabled": false, "id": "-Fa4_l0j" },
      { "label": "FINAL 3D", "enabled": false, "id": "jFX7jRp5" },
      { "label": "DESCRITIVO", "enabled": false, "id": "za-W9ObR" }
    ],
    "feed": [],
    "active": false
  },
  {
    "name": "HAVAIANAS",
    "client": "Holding",
    "entryDate": "2025-12-17",
    "deliveryDate": "2026-01-09",
    "team": [
      { "id": "u3mLbPsa", "role": "criacao", "name": "Rod" },
      { "id": "tv5zdtEJ", "role": "arq", "name": "Paola" },
      { "id": "kwtFCE5l", "role": "3d", "name": "Marcel" }
    ],
    "id": "R0Do3qf0",
    "documents": [
      { "label": "ESTUDO IA", "enabled": false, "id": "8JibHPTI" },
      { "label": "PRÉVIA PLANTA", "enabled": false, "id": "VrE8OC-b" },
      { "label": "PRÉVIA 3D", "enabled": false, "id": "l_4A9zMa" },
      { "label": "FINAL PLANTA", "enabled": false, "id": "QcS9KKXa" },
      { "label": "FINAL 3D", "enabled": false, "id": "MhQwjWKO" },
      { "label": "DESCRITIVO", "enabled": false, "id": "eP-bbSKM" }
    ],
    "feed": [],
    "active": false
  },
  {
    "name": "CIELO LOLLA",
    "client": "Banco",
    "entryDate": "2026-01-05",
    "deliveryDate": "2026-01-07",
    "team": [
      { "id": "nCM6eEeY", "role": "criacao", "name": "Julio" },
      { "id": "MXzSv5-v", "role": "arq", "name": "Paola" },
      { "id": "B2mki6EX", "role": "3d", "name": "Julio" }
    ],
    "id": "UJIlYtn9",
    "documents": [
      { "label": "ESTUDO IA", "enabled": false, "id": "dOU0MZx4" },
      { "label": "PRÉVIA PLANTA", "enabled": false, "id": "Dtpn82w9" },
      { "label": "PRÉVIA 3D", "enabled": false, "id": "EFrh-PTi" },
      { "label": "FINAL PLANTA", "enabled": false, "id": "dD-bTGt0" },
      { "label": "FINAL 3D", "enabled": false, "id": "CQUBTcTa" },
      { "label": "DESCRITIVO", "enabled": false, "id": "GQJ2CH7V" }
    ],
    "feed": [],
    "active": false
  },
  {
    "name": "FORD INTERLAGOS",
    "client": "Itzon",
    "entryDate": "",
    "deliveryDate": "",
    "team": [],
    "id": "JdodsLuE",
    "documents": [
      { "label": "ESTUDO IA", "enabled": false, "id": "GDNseZLe" },
      { "label": "PRÉVIA PLANTA", "enabled": false, "id": "3z2gXO-K" },
      { "label": "PRÉVIA 3D", "enabled": false, "id": "7UaWVeki" },
      { "label": "FINAL PLANTA", "enabled": false, "id": "kY69CVaB" },
      { "label": "FINAL 3D", "enabled": false, "id": "zcdQlzbP" },
      { "label": "DESCRITIVO", "enabled": false, "id": "S36ueHwd" }
    ],
    "feed": []
  },
  {
    "name": "COCA COLA NATAL",
    "client": "Direto",
    "entryDate": "",
    "deliveryDate": "",
    "team": [],
    "id": "Wr72p_7y",
    "documents": [
      { "label": "ESTUDO IA", "enabled": false, "id": "ymF0_QOq" },
      { "label": "PRÉVIA PLANTA", "enabled": false, "id": "Pt8BWqYM" },
      { "label": "PRÉVIA 3D", "enabled": false, "id": "YppVDRT8" },
      { "label": "FINAL PLANTA", "enabled": false, "id": "u4zUasl9" },
      { "label": "FINAL 3D", "enabled": false, "id": "0LEtcedF" },
      { "label": "DESCRITIVO", "enabled": false, "id": "elozsVU9" }
    ],
    "feed": []
  },
  {
    "name": "TCL GAMES COM",
    "client": "Direto",
    "entryDate": "",
    "deliveryDate": "",
    "team": [],
    "id": "n6yC51hh",
    "documents": [
      { "label": "ESTUDO IA", "enabled": false, "id": "4CQYBrTo" },
      { "label": "PRÉVIA PLANTA", "enabled": false, "id": "wM6vHbac" },
      { "label": "PRÉVIA 3D", "enabled": false, "id": "CniQ6uMc" },
      { "label": "FINAL PLANTA", "enabled": false, "id": "L29GU4o5" },
      { "label": "FINAL 3D", "enabled": false, "id": "H_BpiGSz" },
      { "label": "DESCRITIVO", "enabled": false, "id": "eQvAuPR9" }
    ],
    "feed": []
  },
  {
    "name": "MERCEDES FENATRAN",
    "client": "Lampada",
    "entryDate": "",
    "deliveryDate": "",
    "team": [],
    "id": "VYp2d9kn",
    "documents": [
      { "label": "ESTUDO IA", "enabled": false, "id": "iH1I3MDg" },
      { "label": "PRÉVIA PLANTA", "enabled": false, "id": "XA-fmevZ" },
      { "label": "PRÉVIA 3D", "enabled": false, "id": "8kFdP7O-" },
      { "label": "FINAL PLANTA", "enabled": false, "id": "qC6S2tla" },
      { "label": "FINAL 3D", "enabled": false, "id": "FCK6E9bG" },
      { "label": "DESCRITIVO", "enabled": false, "id": "59HMYLeo" }
    ],
    "feed": []
  },
  {
    "name": "SANTANDER INTERLAGOS",
    "client": "Itzon",
    "entryDate": "",
    "deliveryDate": "",
    "team": [],
    "id": "Epfz7_ji",
    "documents": [
      { "label": "ESTUDO IA", "enabled": false, "id": "nvtbVjqe" },
      { "label": "PRÉVIA PLANTA", "enabled": false, "id": "GA1Q4e4l" },
      { "label": "PRÉVIA 3D", "enabled": false, "id": "C1l0qisT" },
      { "label": "FINAL PLANTA", "enabled": false, "id": "HUgfwhYh" },
      { "label": "FINAL 3D", "enabled": false, "id": "QKbt6Ffg" },
      { "label": "DESCRITIVO", "enabled": false, "id": "SRRX0ma2" }
    ],
    "feed": []
  }
];

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
            timelinePins: Array.isArray(c.timelinePins) ? c.timelinePins.map((p: any) => ({
              ...p,
              labels: Array.isArray(p.labels) ? p.labels : (p.label ? [p.label] : ["ENTRADA"]),
            })) : undefined,
          })),
        };
      }
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return { cards: DEFAULT_CARDS };
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
  const { user } = useAuth();
  const { currentUserRole } = usePermissions();
  const isSyncingFromCloud = useRef(false);

  // ☁️ SYNC FROM CLOUD
  useEffect(() => {
    if (!user) return;

    const docRef = doc(db, "data", "cards");
    const unsub = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const cloudData = snapshot.data() as ProjectCardsState;
        
        // 🧪 Clean/Migrate cloud data
        const cleanedCards = (cloudData.cards || []).map((c: any) => ({
          ...c,
          team: migrateTeam(c.team),
          documents: Array.isArray(c.documents) ? c.documents : createDefaultDocuments(),
          feed: Array.isArray(c.feed) ? c.feed : [],
          timelinePins: Array.isArray(c.timelinePins) ? c.timelinePins.map((p: any) => ({
            ...p,
            labels: Array.isArray(p.labels) ? p.labels : (p.label ? [p.label] : ["ENTRADA"]),
          })) : undefined,
        }));

        const cleanedData = { ...cloudData, cards: cleanedCards };

        isSyncingFromCloud.current = true;
        setStateInternal(cleanedData);
        saveState(cleanedData);
        setTimeout(() => { isSyncingFromCloud.current = false; }, 100);
      }
    });

    return () => unsub();
  }, [user]);

  const updateState = useCallback((updater: (prev: ProjectCardsState) => ProjectCardsState) => {
    setStateInternal((prev) => {
      const next = updater(prev);
      saveState(next);

      if (!isSyncingFromCloud.current && (currentUserRole === "admin" || currentUserRole === "editor")) {
        setDoc(doc(db, "data", "cards"), sanitizeForFirestore(next)).catch(err => {
          console.error("Erro ao salvar cards no Firestore:", err);
        });
      }

      return next;
    });
  }, [currentUserRole]);

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

  // 🛡️ Ensure PUB INTERNO exists
  useEffect(() => {
    if (state.cards.length > 0 && !state.cards.some(c => c.name === "PUB INTERNO")) {
      console.log("Auto-criando PUB INTERNO...");
      addCard({
        name: "PUB INTERNO",
        client: "INTERNO",
        entryDate: new Date().toISOString().split('T')[0],
        deliveryDate: new Date().toISOString().split('T')[0],
        team: [],
      });
    }
  }, [state.cards, addCard]);

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
          const validatedState: ProjectCardsState = {
            cards: newState.cards || [],
          };
          saveState(validatedState);
          setStateInternal(validatedState);
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
