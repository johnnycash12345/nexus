// services/driveSyncService.ts
import { db } from "./indexedDBService";
import type { DiaryEntry, Concept, UserProfile, SystemMemory } from '@/types';

const BACKUP_FILENAME = "NexusBrainBackup.nexusbrain.json";

async function findBackupFileId(token: string): Promise<string | null> {
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${BACKUP_FILENAME}' and 'appDataFolder' in parents and trashed=false&spaces=appDataFolder&fields=files(id)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!searchRes.ok) {
        console.error("Failed to search for backup file");
        return null;
    }
    const data = await searchRes.json();
    return data.files?.[0]?.id || null;
}

export const driveSyncService = {
  async uploadBrain(token: string, userId: string) {
    const profile = await db.getUserProfile(userId);
    const system = await db.getSystemMemory(userId);
    const diary = await db.getDiary(userId);
    const concepts = await db.getAllConcepts(userId);

    const brain = {
      meta: { exportedAt: new Date().toISOString(), version: "1.2" },
      profile,
      system,
      diary,
      concepts,
    };

    const blob = new Blob([JSON.stringify(brain, null, 2)], { type: "application/json" });
    const fileId = await findBackupFileId(token);

    const metadata = { name: BACKUP_FILENAME, mimeType: "application/json" };
    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", blob);

    const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files${fileId ? `/${fileId}` : ''}?uploadType=multipart`, {
      method: fileId ? "PATCH" : "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    if (!res.ok) throw new Error("Erro ao enviar cérebro para o Drive");

    window.dispatchEvent(new CustomEvent("nexus-thought-update", {
      detail: { type: "memory", text: "Enviei uma cópia da minha memória para o Drive." },
    }));
  },

  async restoreBrain(token: string, userId: string): Promise<boolean> {
    const fileId = await findBackupFileId(token);
    if (!fileId) return false;

    const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!fileRes.ok) {
        console.error("Failed to download backup file");
        return false;
    }

    const json = await fileRes.json();
    if (!json.system || !json.concepts) return false;

    // Restore data
    await db.saveSystemMemory(userId, json.system as SystemMemory, true); // Overwrite system memory
    if (json.profile) await db.saveUserProfile(userId, json.profile as UserProfile);
    if (json.diary) {
      for (const entry of Object.values(json.diary)) {
          await db.saveDiaryEntry(userId, entry as DiaryEntry);
      }
    }
    if (json.concepts) {
        await db.batchUpdateConcepts(userId, json.concepts as Concept[]);
    }

    window.dispatchEvent(new CustomEvent("nexus-thought-update", {
      detail: { type: "diary", text: "Recuperei minha mente do Google Drive." },
    }));

    return true;
  },
};
