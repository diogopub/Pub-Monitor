import { useEffect, useCallback } from "react";
import { useNetwork } from "@/contexts/NetworkContext";
import { useSchedule } from "@/contexts/ScheduleContext";
import { useProjectCards } from "@/contexts/ProjectCardsContext";
import { toast } from "sonner";

export function useAutoBackup() {
  const { state: networkState } = useNetwork();
  const { state: scheduleState } = useSchedule();
  const { state: cardsState } = useProjectCards();
  const { googleAppsScriptUrl, autoBackupEnabled } = networkState.settings;

  const performBackup = useCallback(async (slot: string) => {
    if (!googleAppsScriptUrl) return;

    const fullData = {
      network: networkState,
      schedule: scheduleState,
      cards: cardsState,
    };

    try {
      const response = await fetch(googleAppsScriptUrl, {
        method: "POST",
        mode: "no-cors", // Apps Script web apps often require no-cors for simple POST
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fullData),
      });

      // Note: with no-cors, we can't actually see the response status
      // but the request is sent.
      const today = new Date().toLocaleDateString();
      localStorage.setItem(`last_backup_${slot}`, today);
      console.log(`[AutoBackup] Backup sent for slot ${slot}`);
      toast.info(`Backup automático (${slot}) enviado para o Google Drive`);
    } catch (error) {
      console.error("[AutoBackup] Error:", error);
    }
  }, [networkState, scheduleState, cardsState, googleAppsScriptUrl]);

  useEffect(() => {
    if (!autoBackupEnabled || !googleAppsScriptUrl) return;

    const checkTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const today = new Date().toLocaleDateString();

      // Slots: 12:00 and 20:00
      // We check if it's the right hour/minute and if we haven't backed up today for this slot
      const slots = [
        { hour: 12, min: 0, label: "12h" },
        { hour: 20, min: 0, label: "20h" }
      ];

      slots.forEach(slot => {
        if (hours === slot.hour && minutes === slot.min) {
          const lastBackup = localStorage.getItem(`last_backup_${slot.label}`);
          if (lastBackup !== today) {
            performBackup(slot.label);
          }
        }
      });
    };

    const interval = setInterval(checkTime, 60000); // Check every minute
    checkTime(); // Run once on mount

    return () => clearInterval(interval);
  }, [autoBackupEnabled, googleAppsScriptUrl, performBackup]);
}
