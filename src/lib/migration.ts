/**
 * Migration utility: move data from old single-document format
 * to new subcollection-per-item format.
 * 
 * Old structure:
 *   data/cards    → { cards: [...] }
 *   data/schedule → { entries: [...], specialRows: [...], weeklyRosters: {...} }
 * 
 * New structure:
 *   project_cards/{cardId}    → ProjectCardData
 *   schedule_entries/{entryId} → ScheduleEntry
 *   data/schedule_meta         → { specialRows, weeklyRosters }
 */

import { db } from "@/lib/firebase";
import {
  doc, getDoc, collection, getDocs, writeBatch, setDoc, deleteDoc,
} from "firebase/firestore";
import { sanitizeForFirestore } from "@/lib/utils";

export type MigrationStatus = "idle" | "running" | "done" | "error" | "already-migrated";

export interface MigrationResult {
  status: MigrationStatus;
  message: string;
  stats?: {
    cardsMigrated: number;
    entriesMigrated: number;
  };
}

/**
 * Checks if data still exists in old format.
 */
export async function detectOldFormat(): Promise<{ hasOldCards: boolean; hasOldSchedule: boolean }> {
  const [cardsSnap, scheduleSnap] = await Promise.all([
    getDoc(doc(db, "data", "cards")),
    getDoc(doc(db, "data", "schedule")),
  ]);

  return {
    hasOldCards: cardsSnap.exists() && Array.isArray(cardsSnap.data()?.cards),
    hasOldSchedule: scheduleSnap.exists() && Array.isArray(scheduleSnap.data()?.entries),
  };
}

/**
 * Migrates cards from data/cards to project_cards/{id}
 */
async function migrateCards(): Promise<number> {
  const oldDoc = await getDoc(doc(db, "data", "cards"));
  if (!oldDoc.exists()) return 0;

  const oldData = oldDoc.data();
  const cards = oldData?.cards;
  if (!Array.isArray(cards) || cards.length === 0) return 0;

  // Check if new collection already has data
  const existing = await getDocs(collection(db, "project_cards"));
  if (!existing.empty) {
    console.log(`project_cards already has ${existing.size} docs, skipping card migration.`);
    return 0;
  }

  // Write each card as a document in batches of 500
  let count = 0;
  const BATCH_SIZE = 490;
  for (let i = 0; i < cards.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = cards.slice(i, i + BATCH_SIZE);
    for (const card of chunk) {
      if (card.id) {
        batch.set(doc(db, "project_cards", card.id), sanitizeForFirestore(card));
        count++;
      }
    }
    await batch.commit();
  }

  return count;
}

/**
 * Migrates schedule entries from data/schedule to schedule_entries/{id}
 * and meta to data/schedule_meta
 */
async function migrateSchedule(): Promise<number> {
  const oldDoc = await getDoc(doc(db, "data", "schedule"));
  if (!oldDoc.exists()) return 0;

  const oldData = oldDoc.data();
  const entries = oldData?.entries;
  const specialRows = oldData?.specialRows;
  const weeklyRosters = oldData?.weeklyRosters;

  // Write meta
  await setDoc(doc(db, "data", "schedule_meta"), sanitizeForFirestore({
    specialRows: specialRows || [],
    weeklyRosters: weeklyRosters || {},
  }));

  if (!Array.isArray(entries) || entries.length === 0) return 0;

  // Check if new collection already has data
  const existing = await getDocs(collection(db, "schedule_entries"));
  if (!existing.empty) {
    console.log(`schedule_entries already has ${existing.size} docs, skipping entry migration.`);
    return 0;
  }

  let count = 0;
  const BATCH_SIZE = 490;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = entries.slice(i, i + BATCH_SIZE);
    for (const entry of chunk) {
      if (entry.id) {
        batch.set(doc(db, "schedule_entries", entry.id), sanitizeForFirestore(entry));
        count++;
      }
    }
    await batch.commit();
  }

  return count;
}

/**
 * Runs the full migration.
 * Safe to run multiple times (idempotent - checks before writing).
 */
export async function runMigration(): Promise<MigrationResult> {
  try {
    const { hasOldCards, hasOldSchedule } = await detectOldFormat();

    if (!hasOldCards && !hasOldSchedule) {
      return {
        status: "already-migrated",
        message: "Nenhum dado no formato antigo encontrado. A migração pode já ter sido feita.",
        stats: { cardsMigrated: 0, entriesMigrated: 0 },
      };
    }

    const [cardsMigrated, entriesMigrated] = await Promise.all([
      hasOldCards ? migrateCards() : 0,
      hasOldSchedule ? migrateSchedule() : 0,
    ]);

    return {
      status: "done",
      message: `Migração concluída com sucesso!`,
      stats: { cardsMigrated, entriesMigrated },
    };
  } catch (err: any) {
    console.error("Migration error:", err);
    return {
      status: "error",
      message: `Erro durante migração: ${err?.message || err}`,
    };
  }
}
