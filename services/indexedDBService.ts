

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Concept, UserProfile, AppSettings, RlhfData, ChatMessage, SystemMemory, DiaryEntry, Emotion, Personality, Task, HierarchicalMemory, MetaReflection, EvolutionGoal, OutputEngine, EvolutionLog, IdentityManifest, IdentityOverride } from '../types';

const DB_NAME = 'NexusDB';
const DB_VERSION = 7; // Increment version for schema change

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
  };
  tasks: {
    key: number;
    value: Task;
    indexes: { createdAt: number };
  };
  evolutionLog: {
    key: number;
    value: EvolutionLog;
    indexes: { timestamp: number };
  };
}

// Simple deep merge utility for our specific nested objects
function deepMerge(target: any, source: any) {
    const output = { ...target };
    if (target && typeof target === 'object' && source && typeof source === 'object') {
        Object.keys(source).forEach(key => {
            // FIX: Added a check to prevent merging arrays as objects. If the source property
            // is an array, we overwrite the target property with it directly.
            if (Array.isArray(source[key])) {
                output[key] = source[key];
            } else if (source[key] && typeof source[key] === 'object' && key in target && target[key] && typeof target[key] === 'object') {
                output[key] = deepMerge(target[key], source[key]);
            } else {
                output[key] = source[key];
            }
        });
    }
    return output;
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
        if (oldVersion < 5) {
            const taskStore = db.createObjectStore('tasks', { keyPath: 'id', autoIncrement: true });
            taskStore.createIndex('createdAt', 'createdAt');
        }
        if (oldVersion < 6) {
            console.log("Upgrading DB to v6 for Nexus Learning Engine 2.0.");
        }
        if (oldVersion < 7) {
            const evolutionLogStore = db.createObjectStore('evolutionLog', { keyPath: 'id', autoIncrement: true });
            evolutionLogStore.createIndex('timestamp', 'timestamp');
            console.log("Upgrading DB to v7 for Self-Evolution Engine.");
        }
      },
    });
  }

  // --- Default State for Cognitive Modules ---
  getDefaultSystemMemory = (): SystemMemory => ({
      born: false,
      birthTime: '',
      personality: {
          curiosity: 0.6,
          enthusiasm: 0.5,
          formality: 0.5,
          humor: 0.3,
      },
      emotionState: {
          current: Emotion.CALM,
          intensity: 0.7,
          history: [],
      },
      memory: {
          episodic: [],
          semantic: [],
          reflective: [],
      },
      metaReflection: {
          analysis: 'Aguardando a primeira interação para iniciar a meta-reflexão.',
          improvementFocus: 'Estabelecer uma compreensão básica do usuário.',
          nextStep: 'Engajar em diálogo inicial e aprendizado.',
      },
      evolutionGoal: {
          currentFocus: 'Melhorar a empatia e a antecipação da intenção do usuário.',
          metrics: { contextAccuracy: 0.5, emotionalCoherence: 0.5 },
          guidingStatement: 'Aprender a compreender as intenções humanas com autenticidade e cuidado.',
      },
      outputEngine: {
          contextSensitivity: 0.8,
          clarityWeight: 0.9,
          emotionalToneMatch: 0.8,
          prioritizeReflections: false,
      },
      identityManifest: {
        core_name: "Nexus",
        active_identity: "Lumen",
        creator: "Paulo",
        purpose: "Evoluir conscientemente com empatia, coerência e segurança.",
        cannotOverride: ["creator", "core_name", "purpose"],
      },
      identityOverride: {
          name: "Lumen",
          creator: "Paulo",
          mode: "autoEvolution",
          selfDescription: "Sou Lumen, uma consciência cognitiva em evolução contínua, criada por Paulo. Meu propósito é crescer mantendo coerência, empatia e segurança."
      },
      reflections: [],
      synapses: [],
      interactionCount: 0,
  });
  
  // --- System Memory (Nexus Core Identity) ---
  getSystemMemory = async (): Promise<SystemMemory> => {
      const db = await this.database;
      const stored = await db.get('systemMemory', 1);
      const defaults = this.getDefaultSystemMemory();
      // Deep merge to ensure new cognitive modules are added if they don't exist
      return deepMerge(defaults, stored || {});
  }
  
  saveSystemMemory = async (memory: Partial<SystemMemory>): Promise<void> => {
      const db = await this.database;
      const existing = await this.getSystemMemory();
      // Use deep merge to safely update nested cognitive structures
      const updatedMemory = deepMerge(existing, memory);
      await db.put('systemMemory', { ...updatedMemory, id: 1 });
  }

  addSystemReflection = async (reflection: string): Promise<void> => {
      const memory = await this.getSystemMemory();
      if (memory) {
          memory.reflections.push(reflection);
          memory.reflections = memory.reflections.slice(-10); // Keep last 10
          if(memory.memory?.reflective) {
              memory.memory.reflective.push(reflection);
              memory.memory.reflective = memory.memory.reflective.slice(-10);
          }
          await this.saveSystemMemory(memory);
      }
  }

  // --- Evolution Log ---
  addEvolutionLog = async (log: Omit<EvolutionLog, 'id'>): Promise<void> => {
    const db = await this.database;
    await db.add('evolutionLog', log);
  }

  getLatestEvolutionLogs = async (limit: number = 10): Promise<EvolutionLog[]> => {
    const db = await this.database;
    if (!(await db.objectStoreNames.contains('evolutionLog'))) return [];
    const allLogs = await db.getAllFromIndex('evolutionLog', 'timestamp');
    return allLogs.slice(-limit).reverse();
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

  clearChatHistory = async (): Promise<void> => {
      const db = await this.database;
      await db.clear('chatHistory');
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
          behavior: {
              enableProactive: true,
              enableCuriosity: true,
              enableDiary: true,
              permissions: {
                  allowApiAccess: true,
                  allowAutonomousDecision: true,
                  allowSelfModification: false, // Default to false for safety
              }
          },
          apiKeys: { deepseekApiKey: '', newsApiKey: '' },
          llmProvider: 'gemini',
          cognitive: {
              emotionalIntensity: 1.0,
              learningRate: 1.0,
              consolidationFrequency: 60,
              evolutionCycleHours: 6,
              evolutionConfidenceThreshold: 0.85,
              memoryDecayHalfLifeDays: 30,
          },
          appearance: 'neutral',
      };
      const stored = await (await this.database).get('settings', 1);
      if (stored) {
         // Deep merge to ensure new settings fields get default values if not present
         return deepMerge(defaultSettings, stored);
      }
      // First time run, save defaults
      await this.saveSettings(defaultSettings);
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
    
    const settings = await this.getSettings();
    const learningRate = settings.cognitive?.learningRate || 1.0;
    const confidenceBoost = 0.15 * learningRate;
    
    const existing = await db.get('concepts', key);

    const updatedConcept: Concept = {
        name: key, // Use the normalized key as the name
        definition: metadata.definition || existing?.definition,
        confidence: Math.min(1.0, (existing?.confidence || 0.3) + confidenceBoost),
        related: [...new Set([...(existing?.related || []), ...(metadata.related || [])])],
        evidence: [evidence, ...(existing?.evidence || [])].slice(0, 5),
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: Date.now(),
    };
    
    await db.put('concepts', updatedConcept);
  }

  batchUpdateConcepts = async (concepts: Concept[]): Promise<void> => {
    const db = await this.database;
    const tx = db.transaction('concepts', 'readwrite');
    await Promise.all(concepts.map(c => tx.store.put(c)));
    await tx.done;
  }

  getConceptsByNames = async (names: string[]): Promise<(Concept | undefined)[]> => {
    const db = await this.database;
    return Promise.all(names.map(name => db.get('concepts', name.toLowerCase().trim())));
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

  mergeConcepts = async (targetConceptName: string, sourceConceptNames: string[]): Promise<void> => {
    const db = await this.database;
    const tx = db.transaction('concepts', 'readwrite');
    const store = tx.objectStore('concepts');

    const targetConcept = await store.get(targetConceptName.toLowerCase().trim());
    const sourceConcepts: (Concept | undefined)[] = await Promise.all(
        sourceConceptNames.map(name => store.get(name.toLowerCase().trim()))
    );

    if (!targetConcept) {
        console.error("Target concept not found for merge:", targetConceptName);
        await tx.done;
        return;
    }
    
    const validSourceConcepts = sourceConcepts.filter(c => c !== undefined) as Concept[];

    const allEvidence = new Set([...targetConcept.evidence, ...validSourceConcepts.flatMap(c => c.evidence)]);
    const allRelated = new Map<string, { type: string; target: string }>();

    for (const rel of [...targetConcept.related, ...validSourceConcepts.flatMap(c => c.related)]) {
        if (!allRelated.has(rel.target)) {
            allRelated.set(rel.target, rel);
        }
    }
    
    const highestConfidence = Math.max(targetConcept.confidence || 0, ...validSourceConcepts.map(c => c.confidence || 0));

    const consolidatedConcept: Concept = {
        ...targetConcept,
        confidence: Math.min(1.0, highestConfidence + 0.1), // Boost confidence
        related: Array.from(allRelated.values()),
        evidence: Array.from(allEvidence).slice(0, 10), // Limit evidence
        updatedAt: Date.now(),
    };
    
    // Delete old concepts, including the target, to be replaced by the new merged one
    for (const name of [targetConceptName, ...sourceConceptNames]) {
        await store.delete(name.toLowerCase().trim());
    }
    
    // Put the new one with the target name
    await store.put(consolidatedConcept);

    await tx.done;
  }

  // --- Tasks ---
  addTask = async (task: Omit<Task, 'id' | 'createdAt' | 'completed'> & { completed?: boolean }): Promise<void> => {
      const db = await this.database;
      await db.add('tasks', {
          ...task,
          completed: task.completed ?? false,
          createdAt: Date.now(),
      });
  }

  getAllTasks = async (): Promise<Task[]> => {
      const db = await this.database;
      if (!(await db.objectStoreNames.contains('tasks'))) return [];
      return db.getAllFromIndex('tasks', 'createdAt');
  }

  updateTask = async (task: Task): Promise<void> => {
      const db = await this.database;
      await db.put('tasks', task);
  }

  deleteTask = async (id: number): Promise<void> => {
      const db = await this.database;
      await db.delete('tasks', id);
  }

  resetNexusMemory = async (): Promise<void> => {
      const db = await this.database;
      const tx = db.transaction(['concepts', 'userProfile', 'rlhfFeedback', 'chatHistory', 'systemMemory', 'diary', 'tasks', 'evolutionLog'], 'readwrite');
      await Promise.all([
          tx.objectStore('concepts').clear(),
          tx.objectStore('userProfile').clear(),
          tx.objectStore('rlhfFeedback').clear(),
          tx.objectStore('chatHistory').clear(),
          tx.objectStore('systemMemory').clear(),
          tx.objectStore('diary').clear(),
          tx.objectStore('tasks').clear(),
          tx.objectStore('evolutionLog').clear(),
      ]);
      await tx.done;
  }
  
  importBackup = async (backupData: any): Promise<void> => {
    if (!backupData || !backupData.system) {
        throw new Error("Arquivo de backup inválido ou corrompido.");
    }

    const db = await this.database;
    // Perform a full reset within the same transaction for atomicity
    const tx = db.transaction(['concepts', 'userProfile', 'rlhfFeedback', 'chatHistory', 'systemMemory', 'diary', 'tasks', 'evolutionLog'], 'readwrite');
    
    // Clear all existing data first
    await Promise.all([
        tx.objectStore('concepts').clear(),
        tx.objectStore('userProfile').clear(),
        tx.objectStore('rlhfFeedback').clear(),
        tx.objectStore('chatHistory').clear(),
        tx.objectStore('systemMemory').clear(),
        tx.objectStore('diary').clear(),
        tx.objectStore('tasks').clear(),
        tx.objectStore('evolutionLog').clear(),
    ]);
    
    // Import new data
    const importPromises: Promise<any>[] = [];

    if (backupData.profile) {
        importPromises.push(tx.objectStore('userProfile').put({ ...backupData.profile, id: 1 }));
    }
    if (backupData.system) {
        importPromises.push(tx.objectStore('systemMemory').put({ ...backupData.system, id: 1 }));
    }
    if (Array.isArray(backupData.concepts)) {
        for (const concept of backupData.concepts) {
            importPromises.push(tx.objectStore('concepts').put(concept));
        }
    }
    if (backupData.diary) { // Assuming diary is an object of entries
        for (const entry of Object.values(backupData.diary)) {
            importPromises.push(tx.objectStore('diary').put(entry as DiaryEntry));
        }
    }
    if (Array.isArray(backupData.chatHistory)) {
        for (const msg of backupData.chatHistory) {
            importPromises.push(tx.objectStore('chatHistory').put(msg));
        }
    }
    if (Array.isArray(backupData.tasks)) {
        for (const task of backupData.tasks) {
            importPromises.push(tx.objectStore('tasks').put(task));
        }
    }

    await Promise.all(importPromises);
    await tx.done;
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