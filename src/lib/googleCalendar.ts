// ─── Google Calendar sync ─────────────────────────────────────────────────────

const TZ_OFFSET = "-03:00"; // Brasilia Time

function formatLocalISOData(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function nextWeekday(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  return formatLocalISOData(d);
}

export async function pushEventToGoogleCalendar(
  entry: { startDate: string; duration?: number; startOffset?: number },
  projectName: string,
  memberEmail: string,
  token: string
): Promise<{ ids: string[]; error?: string }> {
  const eventIds: string[] = [];
  const TARGET_CALENDAR = memberEmail || "projeto@thepublic.house";
  const TZ = "America/Sao_Paulo";

  // Cada unidade 1.0 representa 8 slots (1 dia útil de 10h as 18h).
  // startOffset 0 = 10h, 0.5 = 14h, etc.
  let remainingSlots = Math.round((entry.duration ?? 0.5) * 8);
  let currentStartSlot = Math.round((entry.startOffset ?? 0) * 8);
  let currentDateStr = entry.startDate;

  try {
    // Loop para dividir em vários dias se necessário
    while (remainingSlots > 0) {
      // Máximo de slots disponíveis no dia atual (8 slots/dia)
      const slotsAvailableToday = 8 - currentStartSlot;
      const slotsToday = Math.min(remainingSlots, slotsAvailableToday);

      if (slotsToday > 0) {
        const startHour = 10 + currentStartSlot;
        const endHour = startHour + slotsToday;

        const startDT = `${currentDateStr}T${String(startHour).padStart(2, '0')}:00:00${TZ_OFFSET}`;
        const endDT   = `${currentDateStr}T${String(endHour).padStart(2, '0')}:00:00${TZ_OFFSET}`;

        const gEvent = {
          summary: projectName,
          start: { dateTime: startDT, timeZone: TZ },
          end:   { dateTime: endDT,   timeZone: TZ },
          description: "Sincronizado via Monitor PUB",
          reminders: { useDefault: false, overrides: [] },
        };

        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(TARGET_CALENDAR)}/events?sendUpdates=none`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(gEvent),
          }
        );

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const msg = body.error?.message || res.statusText;
          console.error("Erro Google API (POST):", res.status, body);
          if (res.status === 401 || res.status === 403) {
            throw new Error(`AuthError: ${res.status}`);
          }
          return { ids: eventIds, error: `${res.status}: ${msg}` };
        }

        const data = await res.json();
        eventIds.push(data.id);
      }

      remainingSlots -= slotsToday;
      currentStartSlot = 0; // Próximo dia começa do slot 0 (10h)
      currentDateStr = nextWeekday(currentDateStr);
      
      // Safety break para evitar loop infinito em caso de erro de lógica
      if (remainingSlots > 50) break; 
    }
    return { ids: eventIds };
  } catch (e: any) {
    if (e.message && e.message.includes("AuthError")) throw e;
    console.error("Erro de rede GCal:", e);
    return { ids: eventIds, error: e.message };
  }
}

export async function deleteEventsFromGoogleCalendar(eventIds: string[], memberEmail: string, token: string) {
  const TARGET_CALENDAR = memberEmail || "projeto@thepublic.house";
  for (const id of eventIds) {
    if (!id) continue;
    try {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(TARGET_CALENDAR)}/events/${id}?sendUpdates=none`,
        {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${token}` },
        }
      );
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error(`AuthError: ${res.status}`);
        }
        // 404 (Not Found) or 410 (Gone) are fine, the event is already gone
        if (res.status !== 404 && res.status !== 410) {
          console.error("Erro deletando evento:", res.status);
        }
      }
    } catch (e: any) {
      console.error("Network error deleting event:", e);
      if (e.message && e.message.includes("AuthError")) {
        throw e; // Repassa erro crítico de permissão
      }
    }
  }
}
