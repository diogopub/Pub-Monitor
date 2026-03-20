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
  const CENTRAL_EMAIL = "projeto@thepublic.house";
  const TZ = "America/Sao_Paulo";

  const duration = entry.duration ?? 0.5;
  const startOffset = entry.startOffset ?? 0;
  const numPeriods = Math.min(10, Math.max(1, Math.ceil(duration * 2)));

  const MORNING   = { start: "10:00:00", end: "13:00:00" };
  const AFTERNOON = { start: "14:00:00", end: "18:00:00" };

  let isAfternoon = startOffset >= 0.5;
  let currentDateStr = entry.startDate;

  try {
    for (let p = 0; p < numPeriods; p++) {
      const period = isAfternoon ? AFTERNOON : MORNING;
      const startDT = `${currentDateStr}T${period.start}${TZ_OFFSET}`;
      const endDT   = `${currentDateStr}T${period.end}${TZ_OFFSET}`;

      const gEvent = {
        summary: projectName,
        start: { dateTime: startDT, timeZone: TZ },
        end:   { dateTime: endDT,   timeZone: TZ },
        attendees: [
          ...(memberEmail ? [{ email: memberEmail }] : []),
        ],
        description: "Sincronizado via Monitor PUB",
        reminders: { useDefault: false, overrides: [] },
      };

      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CENTRAL_EMAIL)}/events?sendUpdates=none`,
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
        return { ids: eventIds, error: `${res.status}: ${msg}` };
      }

      const data = await res.json();
      eventIds.push(data.id);

      if (isAfternoon) {
        currentDateStr = nextWeekday(currentDateStr);
        isAfternoon = false;
      } else {
        isAfternoon = true;
      }
    }
    return { ids: eventIds };
  } catch (e: any) {
    console.error("Erro de rede GCal:", e);
    return { ids: eventIds, error: e.message };
  }
}

export async function deleteEventsFromGoogleCalendar(eventIds: string[], token: string) {
  const CENTRAL_EMAIL = "projeto@thepublic.house";
  for (const id of eventIds) {
    if (!id) continue;
    try {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CENTRAL_EMAIL)}/events/${id}?sendUpdates=none`,
        {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${token}` },
        }
      );
      if (!res.ok) {
        console.error("Erro deletando evento:", res.status);
      }
    } catch (e) {
      console.error("Network error deleting event:", e);
    }
  }
}
