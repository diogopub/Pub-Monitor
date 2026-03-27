import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Recursively removes 'undefined' values from an object,
 * as Firestore does not support 'undefined'.
 */
export function sanitizeForFirestore(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore);
  }

  const sanitized: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (value !== undefined) {
        sanitized[key] = sanitizeForFirestore(value);
      }
    }
  }
  return sanitized;
}

export function toUtcNoon(dateStr: string): Date {
  return new Date(dateStr + "T12:00:00Z");
}

type EntryLike = { date: string; duration?: number; slotIndex?: number; memberId: string };

export function computeAutoSlot(
  entries: EntryLike[],
  memberId: string,
  dateStr: string
): number {
  const memberEntries = entries.filter(e => e.memberId === memberId);
  const takenSlots = new Set<number>();
  const targetDate = toUtcNoon(dateStr);
  
  memberEntries.forEach(e => {
    const dStart = toUtcNoon(e.date);
    const dEnd = toUtcNoon(e.date);
    dEnd.setDate(dEnd.getDate() + Math.ceil(e.duration || 1) - 1);
    
    if (targetDate >= dStart && targetDate <= dEnd) {
      takenSlots.add(e.slotIndex || 0);
    }
  });
  
  let autoSlot = 0;
  while (takenSlots.has(autoSlot) && autoSlot < 10) autoSlot++;
  return autoSlot;
}

// ─── 8-Slot Schedule Grid (10:00–18:00) ──────────────────────────

export const SCHEDULE_SLOTS = 8;

/**
 * Converts a ScheduleEntry's legacy float-based fields or new startSlot field
 * to canonical integer slot values.
 *
 * Legacy: startOffset ∈ {0, 0.5}, duration ∈ (0, 1]
 * New:    startSlot ∈ [0,7], duration = integer slot count ≥ 1
 */
export function entryToSlots(entry: {
  duration?: number;
  startOffset?: number;
  startSlot?: number;
}): { startSlot: number; durationSlots: number } {
  if (entry.startSlot !== undefined) {
    // New system: duration is already in integer slots
    return {
      startSlot: entry.startSlot,
      durationSlots: Math.max(1, Math.round(entry.duration ?? 1)),
    };
  }
  // Legacy system: convert float fractions to integer slots
  const startSlot = Math.round((entry.startOffset ?? 0) * SCHEDULE_SLOTS);
  const durationSlots = Math.max(1, Math.round((entry.duration ?? 1) * SCHEDULE_SLOTS));
  return { startSlot, durationSlots };
}

/**
 * Calculates new duration when dragging the RIGHT resize handle.
 * Mouse position is relative to the LEFT edge of the cell (not the bar).
 *
 * @param mousePxRelativeToCell  clientX minus cell.left
 * @param startSlot              current startSlot (never changes in right resize)
 * @param slotWidth              px width of one slot = cell.width / SCHEDULE_SLOTS
 */
export function calcRightResize(params: {
  mousePxRelativeToCell: number;
  startSlot: number;
  slotWidth: number;
}): { duration: number } {
  const { mousePxRelativeToCell, startSlot, slotWidth } = params;
  const rawEndSlot = mousePxRelativeToCell / slotWidth;
  const newEndSlot = Math.round(rawEndSlot);
  const duration = newEndSlot - startSlot;
  return { duration: Math.max(1, Math.min(duration, SCHEDULE_SLOTS - startSlot)) };
}

/**
 * Calculates new startSlot + duration when dragging the LEFT resize handle.
 * Mouse position is relative to the LEFT edge of the cell.
 *
 * @param mousePxRelativeToCell  clientX minus cell.left
 * @param originalEndSlot        startSlot + durationSlots at drag start (never changes)
 * @param slotWidth              px width of one slot = cell.width / SCHEDULE_SLOTS
 */
export function calcLeftResize(params: {
  mousePxRelativeToCell: number;
  originalEndSlot: number;
  slotWidth: number;
}): { startSlot: number; duration: number } {
  const { mousePxRelativeToCell, originalEndSlot, slotWidth } = params;
  const rawSlot = mousePxRelativeToCell / slotWidth;
  // Snap to nearest slot, clamp so start never reaches end
  const newStartSlot = Math.max(0, Math.min(Math.round(rawSlot), originalEndSlot - 1));
  return { startSlot: newStartSlot, duration: originalEndSlot - newStartSlot };
}

export function getEaster(year: number): Date {
  const f = Math.floor;
  const G = year % 19;
  const C = f(year / 100);
  const H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30;
  const I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11));
  const J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7;
  const L = I - J;
  const month = 3 + f((L + 40) / 44);
  const day = L + 28 - 31 * f(month / 4);
  return new Date(year, month - 1, day);
}

export function isHolidayBR(d: Date): boolean {
  const year = d.getFullYear();
  const day = d.getDate();
  const month = d.getMonth() + 1; // 1-12

  // Feriados fixos
  if (month === 1 && day === 1) return true;   // Ano novo
  if (month === 4 && day === 21) return true;  // Tiradentes
  if (month === 5 && day === 1) return true;   // Trabalhador
  if (month === 9 && day === 7) return true;   // Independência
  if (month === 10 && day === 12) return true; // Nossa Sra. Aparecida
  if (month === 11 && day === 2) return true;  // Finados
  if (month === 11 && day === 15) return true; // Proclamação da República
  if (month === 11 && day === 20) return true; // Consciência Negra
  if (month === 12 && day === 25) return true; // Natal

  // Feriados móveis (baseados na Páscoa)
  const easter = getEaster(year);
  const dStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const formatDateHelper = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  // Paixão de Cristo (Sexta-feira Santa)
  const passionOfChrist = new Date(easter);
  passionOfChrist.setDate(easter.getDate() - 2);
  if (dStr === formatDateHelper(passionOfChrist)) return true;

  // Carnaval (Terça-feira)
  const carnaval = new Date(easter);
  carnaval.setDate(easter.getDate() - 47);
  if (dStr === formatDateHelper(carnaval)) return true;

  // Corpus Christi
  const corpusChristi = new Date(easter);
  corpusChristi.setDate(easter.getDate() + 60);
  if (dStr === formatDateHelper(corpusChristi)) return true;

  return false;
}
