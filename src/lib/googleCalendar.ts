export async function pushEventToGoogleCalendar(
  entry: { startDate: string; duration?: number; slotIndex?: number; googleEventIds?: string[] },
  projectName: string,
  memberEmail: string,
  token: string
): Promise<string[]> {
  const eventIds: string[] = [];
  const CENTRAL_EMAIL = "projeto@thepublic.house";

  const numDays = Math.max(1, Math.floor(entry.duration || 1));
  const isMultiDay = numDays > 1;

  for (let i = 0; i < numDays; i++) {
    const currentDate = new Date(entry.startDate);
    currentDate.setDate(currentDate.getDate() + i);
    const dateStr = currentDate.toISOString().split("T")[0];

    const periods = [];
    if (isMultiDay) {
      // Múltiplos dias: Preencher de 10-13h e 14-19h
      periods.push({ start: "10:00:00", end: "13:00:00" });
      periods.push({ start: "14:00:00", end: "19:00:00" });
    } else {
      // Apenas um dia: Mapeamos de acordo com a posição (slotIndex)
      if (entry.slotIndex === 0) {
        periods.push({ start: "10:00:00", end: "13:00:00" });
      } else {
        periods.push({ start: "14:00:00", end: "19:00:00" });
      }
    }

    for (const p of periods) {
      const gEvent = {
        summary: projectName,
        start: {
          dateTime: `${dateStr}T${p.start}-03:00`,
          timeZone: "America/Sao_Paulo"
        },
        end: {
          dateTime: `${dateStr}T${p.end}-03:00`,
          timeZone: "America/Sao_Paulo"
        },
        attendees: [
          { email: CENTRAL_EMAIL },
          ...(memberEmail ? [{ email: memberEmail }] : [])
        ],
        reminders: { useDefault: false, overrides: [] },
      };

      const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=none", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(gEvent)
      });
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
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${id}?sendUpdates=none`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
    } catch(e) {
      console.error("Erro excluindo evento:", e);
    }
  }
}
