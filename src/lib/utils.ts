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
