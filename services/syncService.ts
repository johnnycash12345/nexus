
// services/syncService.ts
// Serviço de sincronização do Nexus com o Google Drive.
// Corrigido e expandido para suportar backup/restauração completos da memória e diário.
import { db } from './indexedDBService';
import { DiaryEntry } from '../types';

// =============================
// CONFIGURAÇÃO GERAL
// =============================
// ATENÇÃO: Substitua pelo seu Client ID do Google Cloud Console.
const GOOGLE_CLIENT_ID = 'SEU_CLIENT_ID.apps.googleusercontent.com';
const DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
const BACKUP_FILENAME = 'nexus_memory_backup.json';


// Declare Google API types to satisfy TypeScript
declare const gapi: any;
declare const google: any;

let gapiClientPromise: Promise<void> | null = null;
let gisClientPromise: Promise<void> | null = null;
let tokenClient: any = null;
let autoSyncTimer: number | null = null;

/**
 * Initializes the Google API and Identity clients by dynamically loading their scripts.
 */
export const initGoogleClient = () => {
  if (!gapiClientPromise) {
    gapiClientPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        gapi.load('client', () => {
          gapi.client.init({
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
          }).then(resolve, reject);
        });
      };
      script.onerror = (err) => reject(new Error('Failed to load GAPI script.'));
      document.body.appendChild(script);
    });
  }

  if (!gisClientPromise) {
    gisClientPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        try {
            tokenClient = google.accounts.oauth2.initTokenClient({
              client_id: GOOGLE_CLIENT_ID,
              scope: DRIVE_SCOPES,
              callback: '',
            });
            resolve();
        } catch (error) {
            reject(new Error("Failed to initialize Google Identity Services. Check your Client ID."))
        }
      };
      script.onerror = (err) => reject(new Error('Failed to load GIS script.'));
      document.body.appendChild(script);
    });
  }
};

const ensureClientsReady = async () => {
  if (!gapiClientPromise || !gisClientPromise) {
    throw new Error("Google clients have not been initialized. Call initGoogleClient() on app startup.");
  }
  await Promise.all([gapiClientPromise, gisClientPromise]);
};

// =============================
// LOGIN E ESTADO DE AUTENTICAÇÃO
// =============================

export const isSignedIn = (): boolean => {
    try {
        return gapi?.client?.getToken() !== null;
    } catch (e) {
        return false;
    }
};

export const signIn = (): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
        await ensureClientsReady();
        if (!tokenClient) return reject(new Error("Google Token Client is not available."));
        
        tokenClient.callback = (resp: any) => {
          if (resp.error !== undefined) reject(resp);
          else resolve();
        };
        
        if (gapi.client.getToken() === null) {
          tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
          tokenClient.requestAccessToken({ prompt: '' });
        }
    } catch (error) {
        reject(error);
    }
  });
};

export const signOut = async () => {
  await ensureClientsReady();
  const token = gapi.client.getToken();
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token, () => {
      gapi.client.setToken('');
    });
  }
};


// =============================
// FUNÇÕES DE BACKUP E RESTAURAÇÃO
// =============================

const findBackupFileId = async (): Promise<string | null> => {
    const response = await gapi.client.drive.files.list({
      q: `name='${BACKUP_FILENAME}' and 'appDataFolder' in parents and trashed=false`,
      spaces: 'appDataFolder',
      fields: 'files(id, name)',
    });
    return response.result.files?.[0]?.id || null;
}

export const backupToGoogleDrive = async (): Promise<string> => {
  await ensureClientsReady();
  if (!isSignedIn()) throw new Error("User is not signed in.");

  const [profile, diary, system, concepts] = await Promise.all([
    db.getUserProfile(),
    db.getDiary(),
    db.getSystemMemory(),
    db.getAllConcepts()
  ]);

  const backupData = {
    profile, diary, system, concepts,
    exportedAt: new Date().toISOString(),
  };

  const fileContent = JSON.stringify(backupData, null, 2);
  const file = new Blob([fileContent], { type: 'application/json' });
  const metadata = { name: BACKUP_FILENAME, mimeType: 'application/json' };
  
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);
  
  const fileId = await findBackupFileId();
  const request = gapi.client.request({
    path: `/upload/drive/v3/files${fileId ? `/${fileId}` : ''}`,
    method: fileId ? 'PATCH' : 'POST',
    params: { uploadType: 'multipart' },
    body: form,
  });

  const response = await request;
  return response.result.id;
};

export const restoreFromGoogleDrive = async (): Promise<void> => {
    await ensureClientsReady();
    if (!isSignedIn()) throw new Error("User is not signed in.");

    const fileId = await findBackupFileId();
    if (!fileId) throw new Error("Nenhum backup encontrado no Google Drive.");

    const response = await gapi.client.drive.files.get({
        fileId: fileId,
        alt: 'media'
    });

    const payload = JSON.parse(response.body);

    // This is a destructive action, clearing local memory first.
    await db.resetNexusMemory();
    
    if (payload.profile) await db.saveUserProfile(payload.profile);
    if (payload.system) await db.saveSystemMemory(payload.system);
    if (payload.diary) {
      for (const entry of Object.values(payload.diary) as DiaryEntry[]) {
        await db.saveDiaryEntry(entry);
      }
    }
    if (payload.concepts?.length) {
      for (const concept of payload.concepts) {
        await db.learnConcept(concept.name, concept, `Restaurado do backup de ${payload.exportedAt}`);
      }
    }
};


// =============================
// SINCRONIZAÇÃO AUTOMÁTICA
// =============================
export async function startAutoSync(intervalMs = 1000 * 60 * 60 * 3) { // a cada 3h
  if (autoSyncTimer) window.clearInterval(autoSyncTimer);
  
  const sync = async () => {
      try {
          // ensureClientsReady might not be done on first run
          await Promise.all([gapiClientPromise, gisClientPromise]);
          if (isSignedIn()) {
              console.log('Sincronização automática em andamento...');
              await backupToGoogleDrive();
              console.log('Sincronização automática concluída.');
          }
      } catch (err) {
          console.warn('Falha ao sincronizar automaticamente:', err);
      }
  };
  
  sync(); // Run once on start
  autoSyncTimer = window.setInterval(sync, intervalMs);
}

export function stopAutoSync() {
  if (autoSyncTimer) window.clearInterval(autoSyncTimer);
  autoSyncTimer = null;
}
