import { db } from './indexedDBService';

// This is a placeholder service. User needs to set up Google Cloud Platform
// and provide their own Client ID.
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
const DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.file';

// Declare Google API types to satisfy TypeScript
declare const gapi: any;
declare const google: any;

let gapiClientPromise: Promise<void> | null = null;
let gisClientPromise: Promise<void> | null = null;
let tokenClient: any = null;

/**
 * Initializes the Google API and Identity clients by dynamically loading their scripts.
 * This function is idempotent and can be called safely multiple times.
 */
export const initGoogleClient = () => {
  // Initialize GAPI client for Drive API
  if (!gapiClientPromise) {
    gapiClientPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        gapi.load('client', () => {
          gapi.client.init({
            // An API key is not required for OAuth2-based Drive access
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
          }).then(resolve, reject);
        });
      };
      script.onerror = (err) => reject(new Error('Failed to load GAPI script.'));
      document.body.appendChild(script);
    });
  }

  // Initialize GIS client for authentication
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
              callback: '', // Callback is handled by the promise in signIn
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


/**
 * A helper function to ensure both clients are loaded and initialized before use.
 */
const ensureClientsReady = async () => {
  if (!gapiClientPromise || !gisClientPromise) {
    throw new Error("Google clients have not been initialized. Call initGoogleClient() on app startup.");
  }
  await Promise.all([gapiClientPromise, gisClientPromise]);
};


/**
 * Checks if the user is currently signed in.
 * Note: This is a synchronous check and might be inaccurate if the client isn't loaded yet.
 * The async functions provide the real authenticated checks.
 */
export const isSignedIn = (): boolean => {
    try {
        return gapi?.client?.getToken() !== null;
    } catch (e) {
        return false;
    }
};

/**
 * Prompts the user to sign in with their Google account.
 */
export const signIn = (): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
        await ensureClientsReady();

        if (!tokenClient) {
          return reject(new Error("Google Token Client is not available."));
        }
        
        tokenClient.callback = (resp: any) => {
          if (resp.error !== undefined) {
            reject(resp);
          }
          resolve();
        };
        
        // Request a new token.
        if (gapi.client.getToken() === null) {
          tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
          // Refresh the token if it's expired
          tokenClient.requestAccessToken({ prompt: '' });
        }
    } catch (error) {
        reject(error);
    }
  });
};

/**
 * Signs the user out.
 */
export const signOut = async () => {
  await ensureClientsReady();
  const token = gapi.client.getToken();
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token, () => {
      gapi.client.setToken('');
    });
  }
};

/**
 * Collects all data from IndexedDB, stringifies it, and uploads it to Google Drive.
 */
export const syncDataToDrive = async (): Promise<string | null> => {
  await ensureClientsReady();
  
  if (!isSignedIn()) {
    throw new Error("User is not signed in.");
  }

  const concepts = await db.getAllConcepts();
  const profile = await db.getUserProfile();
  
  const backupData = {
    profile,
    concepts,
    exportedAt: new Date().toISOString(),
  };

  const fileName = `nexus_backup_${new Date().toISOString().split('T')[0]}.json`;
  const fileContent = JSON.stringify(backupData, null, 2);
  
  try {
    // Check if the file already exists in the appDataFolder
    const searchResponse = await gapi.client.drive.files.list({
      q: `name='${fileName}' and 'appDataFolder' in parents`,
      spaces: 'appDataFolder',
      fields: 'files(id, name)',
    });
    
    const file = new Blob([fileContent], { type: 'application/json' });
    const metadata = {
        name: fileName,
        mimeType: 'application/json',
        parents: ['appDataFolder']
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);
    
    let request;
    const existingFile = searchResponse.result.files?.[0];

    if (existingFile && existingFile.id) {
      // Update existing file
      request = gapi.client.request({
        path: `/upload/drive/v3/files/${existingFile.id}`,
        method: 'PATCH',
        params: { uploadType: 'multipart' },
        body: form,
      });
    } else {
      // Create new file
      request = gapi.client.request({
        path: '/upload/drive/v3/files',
        method: 'POST',
        params: { uploadType: 'multipart' },
        body: form,
      });
    }

    const response = await request;
    return response.result.id;
  } catch (error) {
    console.error("Error syncing to Google Drive:", error);
    return null;
  }
};