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

    // Use a unique key for today's backup for this slot
    const today = new Date().toLocaleDateString();
    const backupKey = `last_backup_${slot}`;
    const lastBackupDate = localStorage.getItem(backupKey);

    // Guard: already backed up today for this slot
    if (lastBackupDate === today) return;

    // Prevent duplicate triggers in the same minute by marking immediately
    localStorage.setItem(backupKey, today);

    console.log(`[AutoBackup] Starting backup for slot ${slot}...`);

    const fullData = {
      network: networkState,
      schedule: scheduleState,
      cards: cardsState,
      timestamp: new Date().toISOString(),
      slot: slot
    };

    try {
      await fetch(googleAppsScriptUrl, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fullData),
      });

      console.log(`[AutoBackup] Backup sent for slot ${slot}`);
      toast.info(`Backup automático (${slot}) enviado para o Google Drive`);
    } catch (error) {
      console.error("[AutoBackup] Error during backup:", error);
      // Optional: clear on error if we want to retry within the same minute? 
      // Better to stay safe and wait for next trigger or manual.
    }
  }, [googleAppsScriptUrl, networkState, scheduleState, cardsState]);

  // Separate timer from state to prevent interval spamming on re-renders
  useEffect(() => {
    if (!autoBackupEnabled || !googleAppsScriptUrl) return;

    const interval = setInterval(() => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();

      const slots = [
        { hour: 12, min: 0, label: "12h" },
        { hour: 18, min: 0, label: "18h" }
      ];

      slots.forEach(slot => {
        if (hours === slot.hour && minutes === slot.min) {
          performBackup(slot.label);
        }
      });
    }, 60000); // Check once per minute

    return () => clearInterval(interval);
  }, [autoBackupEnabled, googleAppsScriptUrl, performBackup]); // performBackup still here but now interval is much slower
}
