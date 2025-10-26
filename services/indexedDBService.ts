import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Concept, UserProfile, AppSettings, RlhfData, ChatMessage, SystemMemory, DiaryEntry, Mood } from '../types';

const DB_NAME = 'NexusDB';
const DB_VERSION = 4; // Increment version for schema change

interface NexusDB extends DBSchema {
  concepts: {
    key: string;
    value: Concept;
    indexes: { confidence: number };
  };
  userProfile: {
    key: number;
    value: UserProfile;
  };
  settings: {
    key: number;
    value: AppSettings;
  };
  rlhfFeedback: {
    key: number;
    value: RlhfData;
    indexes: { timestamp: number };
  };
  chatHistory: {
    key: number;
    value: ChatMessage;
    indexes: { timestamp: number };
  };
  systemMemory: {
      key: number;
      value: SystemMemory;
  };
  diary: {
      key: string; // YYYY-MM-DD
      value: DiaryEntry;
      indexes: { createdAt: number };
  }
}

class IndexedDBService {
  private database: Promise<IDBPDatabase<NexusDB>>;

  constructor() {
    this.database = openDB<NexusDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, tx) {
        if (oldVersion < 1) {
            const conceptStore = db.createObjectStore('concepts', { keyPath: 'name' });
            conceptStore.createIndex('confidence', 'confidence');
            db.createObjectStore('userProfile', { keyPath: 'id', autoIncrement: true });
            db.createObjectStore('settings', { keyPath: 'id', autoIncrement: true });
            const rlhfStore = db.createObjectStore('rlhfFeedback', { keyPath: 'id', autoIncrement: true });
            rlhfStore.createIndex('timestamp', 'timestamp');
        }
        if (oldVersion < 2) {
           const chatStore = db.createObjectStore('chatHistory', { keyPath: 'id', autoIncrement: true });
           chatStore.createIndex('timestamp', 'timestamp');
        }
        if (oldVersion < 3) {
            db.createObjectStore('systemMemory', { keyPath: 'id' });
            db.createObjectStore('diary', { keyPath: 'date' }); // Will be replaced in v4
        }
        if (oldVersion < 4) {
            if (db.objectStoreNames.contains('diary')) {
                db.deleteObjectStore('diary');
            }
            const diaryStore = db.createObjectStore('diary', { keyPath: 'dayKey' });
            diaryStore.createIndex('createdAt', 'createdAt');
        }
      },
    });
  }
  
  // --- System Memory (Nexus Core Identity) ---
  getSystemMemory = async (): Promise<SystemMemory | null> => {
      return (await this.database).get('systemMemory', 1).then(mem => mem || null);
  }
  
  saveSystemMemory = async (memory: Partial<SystemMemory>): Promise<void> => {
      const db = await this.database;
      const existing = await db.get('systemMemory', 1) ?? {
          born: false,
          birthTime: '',
          personality: '',
          emotion: Mood.CURIOUS,
          reflections: [],
      };
      await db.put('systemMemory', { ...existing, ...memory, id: 1 });
  }

  addSystemReflection = async (reflection: string): Promise<void> => {
      const db = await this.database;
      const memory = await this.getSystemMemory();
      if (memory) {
          memory.reflections.push(reflection);
          memory.reflections = memory.reflections.slice(-10); // Keep last 10
          await this.saveSystemMemory(memory);
      }
  }

  // --- Diary ---
  getDiary = async (): Promise<Record<string, DiaryEntry>> => {
      const db = await this.database;
      const entries = await db.getAllFromIndex('diary', 'createdAt');
      return entries.reduce((acc, entry) => {
          acc[entry.dayKey] = entry;
          return acc;
      }, {} as Record<string, DiaryEntry>);
  }

  saveDiaryEntry = async (entry: DiaryEntry): Promise<void> => {
      const db = await this.database;
      const tx = db.transaction('diary', 'readwrite');
      const existing = await tx.store.get(entry.dayKey);
      if (existing) {
          // Append to existing entry for the day
          await tx.store.put({ ...entry, entry: existing.entry + "\n" + entry.entry });
      } else {
          await tx.store.put(entry);
      }
      await tx.done;
  }


  // --- Chat History ---
  addChatMessage = async (message: ChatMessage): Promise<void> => {
    const db = await this.database;
    await db.add('chatHistory', { ...message, timestamp: Date.now() });
  }

  getChatHistory = async (limit: number = 50): Promise<ChatMessage[]> => {
    const db = await this.database;
    if (!(await db.objectStoreNames.contains('chatHistory'))) return [];
    const allMessages = await db.getAllFromIndex('chatHistory', 'timestamp');
    return allMessages.slice(-limit);
  }


  // User Profile
  getUserProfile = async (): Promise<UserProfile | null> => {
    return (await this.database).get('userProfile', 1).then(profile => profile || null);
  }

  saveUserProfile = async (profile: Partial<UserProfile>): Promise<void> => {
    const db = await this.database;
    const existing = await db.get('userProfile', 1) ?? { name: '' };
    await db.put('userProfile', { ...existing, ...profile, id: 1 });
  }
  
  // Settings
  getSettings = async (): Promise<AppSettings> => {
      const defaultSettings: AppSettings = {
          voice: { voiceURI: null, rate: 1, pitch: 1 },
          behavior: { enableProactive: true, enableCuriosity: true, enableDiary: true },
      };
      const stored = await (await this.database).get('settings', 1);
      if (stored) {
         return {
            ...defaultSettings,
            ...stored,
            behavior: { ...defaultSettings.behavior, ...stored.behavior },
         };
      }
      return defaultSettings;
  }
  
  saveSettings = async (settings: AppSettings): Promise<void> => {
      const db = await this.database;
      await db.put('settings', { ...settings, id: 1 });
  }

  // Concepts
  learnConcept = async (name: string, metadata: any, evidence: string): Promise<void> => {
    const db = await this.database;
    const key = name.toLowerCase().trim();
    if (!key) return;
    const existing = await db.get('concepts', key);

    const updatedConcept: Concept = {
        name: name,
        definition: metadata.definition || existing?.definition,
        confidence: Math.min(1.0, (existing?.confidence || 0.3) + 0.15),
        related: [...new Set([...(existing?.related || []), ...(metadata.related || [])])],
        evidence: [evidence, ...(existing?.evidence || [])].slice(0, 5),
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: Date.now(),
    };
    
    await db.put('concepts', updatedConcept);
  }

  getAllConcepts = async (): Promise<Concept[]> => {
      return (await this.database).getAll('concepts');
  }
  
  getWeakestConcepts = async (limit: number = 5): Promise<Concept[]> => {
      const db = await this.database;
      return db.getAllFromIndex('concepts', 'confidence', IDBKeyRange.bound(0, 0.8), limit);
  }
  
  deleteConcept = async (name: string): Promise<void> => {
      await (await this.database).delete('concepts', name.toLowerCase());
  }

  // RLHF Data
  addRlhfData = async (data: RlhfData): Promise<void> => {
      await (await this.database).add('rlhfFeedback', data);
  }
  
  getRlhfData = async (limit: number = 50): Promise<RlhfData[]> => {
      const db = await this.database;
      const tx = db.transaction('rlhfFeedback', 'readonly');
      const index = tx.store.index('timestamp');
      return index.getAll(undefined, limit);
  }
}

export const db = new IndexedDBService();