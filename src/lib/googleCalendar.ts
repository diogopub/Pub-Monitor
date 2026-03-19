// ─── Google Calendar sync ─────────────────────────────────────────────────────
//
// Mapeamento de duração → períodos na Google Agenda:
//   duration = 1.0 → 1 período  (slot 0: 10h-13h | slot ≥1: 14h-19h)
//   duration = 1.5 → 2 períodos (adiciona o próximo período do dia)
//   duration = 2.0 → 3 períodos (+ manhã do próximo dia útil)
//   duration = 2.5 → 4 períodos ...  até o máximo de 10 (seg-sex, manhã+tarde)
//
//   Fórmula: numPeriods = Math.max(1, Math.ceil(duration * 2 - 1))

function nextWeekday(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() === 0 || d.getDay() === 6); // pula sáb + dom
  return d.toISOString().split("T")[0];
}

export async function pushEventToGoogleCalendar(
  entry: { startDate: string; duration?: number; slotIndex?: number },
  projectName: string,
  memberEmail: string,
  token: string
): Promise<string[]> {
  const eventIds: string[] = [];
  const CENTRAL_EMAIL = "projeto@thepublic.house";
  const TZ = "America/Sao_Paulo";

  const duration = entry.duration ?? 1;
  const slotIndex = entry.slotIndex ?? 0;

  // Quantidade de períodos a criar (máx. 10 = segunda a sexta, manhã + tarde)
  const numPeriods = Math.min(10, Math.max(1, Math.ceil(duration * 2 - 1)));

  const MORNING   = { start: "10:00:00", end: "13:00:00" };
  const AFTERNOON = { start: "14:00:00", end: "19:00:00" };

  // Estado inicial: slot 0 → começa de manhã, slot ≥ 1 → começa de tarde
  let isAfternoon = slotIndex >= 1;
  let currentDateStr = entry.startDate;

  for (let p = 0; p < numPeriods; p++) {
    const period = isAfternoon ? AFTERNOON : MORNING;

    const gEvent = {
      summary: projectName,
      start: { dateTime: `${currentDateStr}T${period.start}`, timeZone: TZ },
      end:   { dateTime: `${currentDateStr}T${period.end}`,   timeZone: TZ },
      attendees: [
        { email: CENTRAL_EMAIL },
        ...(memberEmail ? [{ email: memberEmail }] : []),
      ],
      reminders: { useDefault: false, overrides: [] },
    };

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
      const err = await res.text();
      console.error("Erro criando evento no Google Calendar:", err);
    }

    // Avança para o próximo período
    if (isAfternoon) {
      // Depois da tarde → manhã do próximo dia útil
      currentDateStr = nextWeekday(currentDateStr);
      isAfternoon = false;
    } else {
      // Depois da manhã → tarde do mesmo dia
      isAfternoon = true;
    }
  }

  return eventIds;
}

export async function deleteEventsFromGoogleCalendar(eventIds: string[], token: string) {
  for (const id of eventIds) {
    if (!id) continue;
    try {
      await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${id}?sendUpdates=none`,
        {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${token}` },
        }
      );
    } catch (e) {
      console.error("Erro excluindo evento:", e);
    }
  }
}
