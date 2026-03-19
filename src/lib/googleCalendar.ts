// ─── Google Calendar sync ───────────────────────────────────────────
// Regras de horário:
//   slot 0  = manhã  → 10:00–13:00
//   slot ≥1 = tarde  → 14:00–19:00
//   multi-day: cada dia tem manhã + tarde (exceto 1º dia se começa na tarde)

function addWeekdays(dateStr: string, days: number): string {
  // Avança `days` dias úteis a partir de dateStr (YYYY-MM-DD)
  const d = new Date(dateStr + "T12:00:00");
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d.toISOString().split("T")[0];
}

function toDateTime(dateStr: string, time: string): string {
  // Retorna string ISO sem offset explícito — a timezone é declarada separadamente
  return `${dateStr}T${time}`;
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
  const isMorning = slotIndex === 0;

  // Quantos dias a barra ocupa (duração 1.5 = 2 dias, 1 = 1 dia, 0.5 = 1 dia)
  const numDays = Math.ceil(duration);
  const isMultiDay = numDays > 1;

  // Períodos por dia
  const MORNING = { start: "10:00:00", end: "13:00:00" };
  const AFTERNOON = { start: "14:00:00", end: "19:00:00" };

  for (let i = 0; i < numDays; i++) {
    // Data do dia atual avançando dias úteis
    const dateStr = i === 0 ? entry.startDate : addWeekdays(entry.startDate, i);

    let periods: { start: string; end: string }[];

    if (!isMultiDay) {
      // Dia único: respeita o slot
      periods = [isMorning ? MORNING : AFTERNOON];
    } else if (i === 0) {
      // Primeiro dia de multi-day: começa no período do slot
      periods = isMorning
        ? [MORNING, AFTERNOON]   // começa de manhã → cobre manhã e tarde
        : [AFTERNOON];           // começa na tarde → cobre só a tarde
    } else {
      // Dias intermediários e último: manhã + tarde completos
      periods = [MORNING, AFTERNOON];
    }

    for (const p of periods) {
      const gEvent = {
        summary: projectName,
        start: { dateTime: toDateTime(dateStr, p.start), timeZone: TZ },
        end:   { dateTime: toDateTime(dateStr, p.end),   timeZone: TZ },
        attendees: [
          { email: CENTRAL_EMAIL },
          ...(memberEmail ? [{ email: memberEmail }] : [])
        ],
        reminders: { useDefault: false, overrides: [] },
      };

      const res = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=none",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(gEvent)
        }
      );

      if (res.ok) {
        const data = await res.json();
        eventIds.push(data.id);
      } else {
        const err = await res.text();
        console.error("Erro criando evento no Google Calendar:", err);
      }
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
          headers: { "Authorization": `Bearer ${token}` }
        }
      );
    } catch (e) {
      console.error("Erro excluindo evento:", e);
    }
  }
}
