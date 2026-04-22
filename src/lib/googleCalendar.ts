// ─── Google Calendar sync ─────────────────────────────────────────────────────

const MONITOR_EVENT_TAG = "Sincronizado via Monitor PUB";
const TZ = "America/Sao_Paulo";
const MAX_SLOTS = 40; // equivalente a ~5 dias úteis de 8 slots

function resolveCalendar(email?: string): string {
  if (!email) throw new Error("Email do calendário é obrigatório para sincronização.");
  return email;
}

function formatLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function nextWeekday(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  return formatLocalISODate(d);
}

function isIgnorableDeleteError(status?: number): boolean {
  return status === 404 || status === 410;
}

export async function pushEventToGoogleCalendar(
  entry: { startDate: string; duration?: number; startOffset?: number },
  projectName: string,
  memberEmail: string,
  token: string,
  userDescription?: string
): Promise<{ ids: string[]; error?: string }> {
  const eventIds: string[] = [];
  const targetCalendar = resolveCalendar(memberEmail);

  // Cada unidade 1.0 representa 8 slots (1 dia útil de 10h as 18h).
  // startOffset 0 = 10h, 0.5 = 14h, etc.
  let remainingSlots = Math.round((entry.duration ?? 0.5) * 8);
  let currentStartSlot = Math.round((entry.startOffset ?? 0) * 8);
  let currentDateStr = entry.startDate;

  if (remainingSlots > MAX_SLOTS) {
    return {
      ids: [],
      error: "Duração excede o limite permitido."
    };
  }

  try {
    // Loop para dividir em vários dias se necessário
    while (remainingSlots > 0) {
      // Máximo de slots disponíveis no dia atual (8 slots/dia)
      const slotsAvailableToday = 8 - currentStartSlot;
      const slotsToday = Math.min(remainingSlots, slotsAvailableToday);

      if (slotsToday > 0) {
        const startHour = 10 + currentStartSlot;
        const endHour = Math.min(startHour + slotsToday, 24);

        // Define datetime sem offset hardcoded, usando timezone explícito no body
        const startDT = `${currentDateStr}T${String(startHour).padStart(2, '0')}:00:00`;
        const endDT   = `${currentDateStr}T${String(endHour).padStart(2, '0')}:00:00`;

        const descriptionBody = userDescription
          ? `${userDescription}\n\n---\n${MONITOR_EVENT_TAG}`
          : MONITOR_EVENT_TAG;

        const gEvent = {
          summary: projectName,
          start: { dateTime: startDT, timeZone: TZ },
          end:   { dateTime: endDT,   timeZone: TZ },
          description: descriptionBody,
          reminders: { useDefault: false, overrides: [] },
        };

        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendar)}/events?sendUpdates=none`,
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
          if (res.status === 401) {
            throw new Error(`AuthError: 401`);
          }
          if (res.status === 403) {
            return { ids: eventIds, error: `403 Forbidden: Sem permissão no calendário destino.` };
          }
          return { ids: eventIds, error: `${res.status}: ${msg}` };
        }

        const data = await res.json();
        if (data.id) {
            eventIds.push(data.id);
        }
      }

      remainingSlots -= slotsToday;
      currentStartSlot = 0; // Próximo dia começa do slot 0 (10h)
      if (remainingSlots > 0) {
        currentDateStr = nextWeekday(currentDateStr);
      }
    }
    return { ids: eventIds };
  } catch (error) {
    if (error instanceof Error) {
        if (error.message.includes("AuthError")) throw error;
        return { ids: eventIds, error: error.message };
    }
    return { ids: eventIds, error: "Unknown error" };
  }
}

async function deleteSingleEvent(id: string, calendarId: string, token: string): Promise<void> {
    if (!id) return;
    try {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(id)}?sendUpdates=none`,
        {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${token}` },
        }
      );
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error(`AuthError: 401`);
        }
        if (res.status === 403) {
          throw new Error(`403 Forbidden: Sem permissão no calendário destino.`);
        }
        if (!isIgnorableDeleteError(res.status)) {
           throw new Error(`Delete failed with status ${res.status}`);
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("AuthError")) throw error; // Repassa erro crítico
      }
      throw error;
    }
}

export async function deleteEventsFromGoogleCalendar(eventIds: string[], memberEmail: string, token: string) {
  const targetCalendar = resolveCalendar(memberEmail);
  const results = await Promise.allSettled(
      eventIds.filter(Boolean).map(id => deleteSingleEvent(id, targetCalendar, token))
  );
  
  // Se houver algum erro de AuthError, devemos explodir
  for (const result of results) {
     if (result.status === 'rejected') {
        if (result.reason instanceof Error && result.reason.message.includes("AuthError")) {
          throw result.reason;
        } else {
          console.warn("[GCal Sync] Event Deletion Failed (Ignored/Swallowed):", result.reason);
        }
     }
  }
}

/**
 * Busca e deleta TODOS os eventos marcados como "Sincronizado via Monitor PUB" 
 * dentro de um intervalo de tempo para um calendário específico.
 * Usado na reconciliação total (Force Sync).
 */
export async function purgeMonitorEventsInRange(
  memberEmail: string,
  timeMin: string, // ISO string
  timeMax: string, // ISO string
  token: string
): Promise<{ deleted: number; failed: number }> {
  const targetCalendar = resolveCalendar(memberEmail);
  let pageToken: string | undefined = undefined;
  const idsToDelete: string[] = [];

  try {
    do {
      let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendar)}/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&maxResults=2500`;
      if (pageToken) {
          url += `&pageToken=${encodeURIComponent(pageToken)}`;
      }

      const res = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
      
      if (!res.ok) {
        if (res.status === 401) throw new Error(`AuthError: 401`);
        if (res.status === 403) throw new Error(`403 Forbidden: Sem permissão no calendário destino.`);
        break; // Ignora pacotes de erro silenciosamente se não for Auth (fallback)
      }

      const data = await res.json();
      if (!data.items) break;

      const monitorEvents = data.items.filter((ev: any) =>
        ev.description?.includes(MONITOR_EVENT_TAG)
      );

      monitorEvents.forEach((ev: any) => {
         if (ev.id) idsToDelete.push(ev.id);
      });

      pageToken = data.nextPageToken;
    } while (pageToken);

    if (idsToDelete.length === 0) return { deleted: 0, failed: 0 };
    
    const results = await Promise.allSettled(
        idsToDelete.map(id => deleteSingleEvent(id, targetCalendar, token))
    );

    let deleted = 0;
    let failed = 0;

    for (const result of results) {
       if (result.status === "fulfilled") {
          deleted++;
       } else {
          failed++;
          if (result.reason instanceof Error && result.reason.message.includes("AuthError")) {
             throw result.reason;
          }
       }
    }

    return { deleted, failed };
  } catch (error) {
    if (error instanceof Error && error.message.includes("AuthError")) throw error;
    return { deleted: 0, failed: 0 };
  }
}

/**
 * Atualiza a descrição de evento(s) existentes no Google Calendar via PATCH.
 * Usado quando o usuário edita a descrição de uma atividade na agenda.
 */
export async function updateEventDescriptionOnGCal(
  eventIds: string[],
  memberEmail: string,
  token: string,
  userDescription: string
): Promise<{ error?: string }> {
  const targetCalendar = resolveCalendar(memberEmail);
  const descriptionBody = userDescription
    ? `${userDescription}\n\n---\n${MONITOR_EVENT_TAG}`
    : MONITOR_EVENT_TAG;

  try {
    for (const eventId of eventIds.filter(Boolean)) {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendar)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
        {
          method: "PATCH",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ description: descriptionBody }),
        }
      );

      if (!res.ok) {
        if (res.status === 401) throw new Error("AuthError: 401");
        if (res.status === 404 || res.status === 410) continue; // evento já deletado, ignora
        const body = await res.json().catch(() => ({}));
        const msg = body.error?.message || res.statusText;
        return { error: `${res.status}: ${msg}` };
      }
    }
    return {};
  } catch (error) {
    if (error instanceof Error && error.message.includes("AuthError")) throw error;
    return { error: error instanceof Error ? error.message : "Unknown error" };
  }
}
