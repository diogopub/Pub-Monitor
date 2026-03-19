// ─── Google Calendar sync ─────────────────────────────────────────────────────
//
// Mapeamento de duração → períodos na Google Agenda:
//   duration = 0.5 → 1 período (meio dia)
//   duration = 1.0 → 2 períodos (dia cheio)
//   Fórmula: numPeriods = Math.ceil(duration * 2)

const TZ_OFFSET = "-03:00"; // Brasilia Time

function formatLocalISOData(date: Date): string {
  // Retorna YYYY-MM-DD sem converter para UTC
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function nextWeekday(dateStr: string): string {
  // dateStr is YYYY-MM-DD. We assume T12:00:00 to avoid any rollover issues.
  const d = new Date(dateStr + "T12:00:00");
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() === 0 || d.getDay() === 6); // pula sáb + dom
  return formatLocalISOData(d);
}

export async function pushEventToGoogleCalendar(
  entry: { startDate: string; duration?: number; startOffset?: number },
  projectName: string,
  memberEmail: string,
  token: string
): Promise<string[]> {
  const eventIds: string[] = [];
  const CENTRAL_EMAIL = "projeto@thepublic.house";
  const TZ = "America/Sao_Paulo";

  const duration = entry.duration ?? 0.5;
  const startOffset = entry.startOffset ?? 0;
  
  // Quantidade de períodos a criar (máx. 10 = segunda a sexta, manhã + tarde)
  const numPeriods = Math.min(10, Math.max(1, Math.ceil(duration * 2)));

  const MORNING   = { start: "10:00:00", end: "13:00:00" };
  const AFTERNOON = { start: "14:00:00", end: "19:00:00" };

  // Estado inicial: startOffset 0 → manhã, 0.5 → tarde
  let isAfternoon = startOffset >= 0.5;
  let currentDateStr = entry.startDate;

  for (let p = 0; p < numPeriods; p++) {
    const period = isAfternoon ? AFTERNOON : MORNING;

    // RFC3339 exige o offset -03:00 se não for 'Z'
    const startDT = `${currentDateStr}T${period.start}${TZ_OFFSET}`;
    const endDT   = `${currentDateStr}T${period.end}${TZ_OFFSET}`;

    const gEvent = {
      summary: projectName,
      start: { dateTime: startDT, timeZone: TZ },
      end:   { dateTime: endDT,   timeZone: TZ },
      attendees: [
        { email: CENTRAL_EMAIL },
        ...(memberEmail ? [{ email: memberEmail }] : []),
      ],
      reminders: { useDefault: false, overrides: [] },
    };

    try {
      const res = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=none",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(gEvent),
        }
      );

      if (res.ok) {
        const data = await res.json();
        eventIds.push(data.id);
      } else {
        const errJson = await res.json().catch(() => ({}));
        console.error("Erro Google API (POST):", res.status, errJson);
      }
    } catch (e) {
      console.error("Network error during Calendar sync:", e);
    }

    // Avança para o próximo período logicamente
    if (isAfternoon) {
      currentDateStr = nextWeekday(currentDateStr);
      isAfternoon = false;
    } else {
      isAfternoon = true;
    }
  }

  return eventIds;
}

export async function deleteEventsFromGoogleCalendar(eventIds: string[], token: string) {
  for (const id of eventIds) {
    if (!id) continue;
    try {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${id}?sendUpdates=none`,
        {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${token}` },
        }
      );
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        console.error("Erro Google API (DELETE):", res.status, errJson);
      }
    } catch (e) {
      console.error("Erro excluindo evento:", e);
    }
  }
}
