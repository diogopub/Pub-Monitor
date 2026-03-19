/**
 * Google Calendar API Service
 * Handles event creation, update and deletion
 */

export interface GoogleCalendarEvent {
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  colorId?: string;
}

const GOOGLE_CAL_API = "https://www.googleapis.com/calendar/v3";

/**
 * Maps PUB colors to Google Calendar colorIds (1-11)
 */
function mapColorToGoogle(hex?: string): string {
  if (!hex) return "1"; // default
  const h = hex.toLowerCase();
  if (h.includes("#e11d48") || h.includes("#dc2626")) return "11"; // Tomato (Red)
  if (h.includes("#16a34a") || h.includes("#34d399")) return "10"; // Basil (Green)
  if (h.includes("#2563eb") || h.includes("#60a5fa")) return "9"; // Blueberry (Blue)
  if (h.includes("#f59e0b") || h.includes("#fb923c")) return "6"; // Tangerine
  if (h.includes("#7c3aed") || h.includes("#e879f9")) return "3"; // Grape
  if (h.includes("#14b8a6") || h.includes("#0d9488")) return "7"; // Peacock
  if (h.includes("#6b7280") || h.includes("#d1d5db")) return "8"; // Graphite
  return "1";
}

export async function createGoogleEvent(
  accessToken: string,
  event: GoogleCalendarEvent
): Promise<string | null> {
  try {
    const response = await fetch(`${GOOGLE_CAL_API}/calendars/primary/events`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Google Calendar API Error (Create):", error);
      return null;
    }

    const data = await response.json();
    return data.id;
  } catch (err) {
    console.error("Failed to create Google Event:", err);
    return null;
  }
}

export async function updateGoogleEvent(
  accessToken: string,
  eventId: string,
  event: GoogleCalendarEvent
): Promise<boolean> {
  try {
    const response = await fetch(
      `${GOOGLE_CAL_API}/calendars/primary/events/${eventId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("Google Calendar API Error (Update):", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Failed to update Google Event:", err);
    return false;
  }
}

export async function deleteGoogleEvent(
  accessToken: string,
  eventId: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${GOOGLE_CAL_API}/calendars/primary/events/${eventId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok && response.status !== 404) {
      const error = await response.json();
      console.error("Google Calendar API Error (Delete):", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Failed to delete Google Event:", err);
    return false;
  }
}

/**
 * Format entry data for Google Calendar
 */
export function formatEntryForGoogle(
  date: string,
  duration: number,
  title: string,
  description: string,
  color?: string
): GoogleCalendarEvent {
  // Start at 09:00 AM
  const startDateTime = `${date}T09:00:00`;
  
  // End on the same day or multiple days later at 06:00 PM
  const endDate = new Date(date);
  endDate.setDate(endDate.getDate() + Math.ceil(duration) - 1);
  const endDateStr = endDate.toISOString().split("T")[0];
  const endDateTime = `${endDateStr}T18:00:00`;

  return {
    summary: `PUB: ${title}`,
    description,
    start: {
      dateTime: startDateTime,
      timeZone: "America/Sao_Paulo", // Default for user context
    },
    end: {
      dateTime: endDateTime,
      timeZone: "America/Sao_Paulo",
    },
    colorId: mapColorToGoogle(color),
  };
}
