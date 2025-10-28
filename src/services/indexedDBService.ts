import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Concept, UserProfile, AppSettings, RlhfData, ChatMessage, SystemMemory, DiaryEntry, Emotion, Personality, Task, HierarchicalMemory, MetaReflection, EvolutionGoal, OutputEngine, EvolutionLog, IdentityManifest, IdentityOverride, Synapse, Thought, CognitiveLog, ThoughtCategory, CognitiveEvent, Project } from '@/types';

const DB_NAME = 'NexusDB';
const DB_VERSION = 10; // Increment version for schema change

interface NexusDB extends DBSchema {
  users: {
    key: string; // userId
    value: UserProfile;
  };
  concepts: {
    key: [string, string]; // [userId, name]
    value: Concept;
    indexes: { byUserId: string };
  };
  settings: {
    key: string; // userId
    value: AppSettings & { userId: string };
  };
  rlhfFeedback: {
    key: number;
    value: RlhfData;
    indexes: { byUserId: string };
  };
  chatHistory: {
    key: number;
    value: ChatMessage;
    indexes: { byUserId: string };
  };
  systemMemory: {
      key: string; // userId
      value: SystemMemory;
  };
  diary: {
      key: [string, string]; // [userId, dayKey]
      value: DiaryEntry;
      indexes: { byUserId: string };
  };
  tasks: {
    key: number;
    value: Task;
    indexes: { byUserId: string };
  };
  evolutionLog: {
    key: number;
    value: EvolutionLog;
    indexes: { byUserId: string };
  };
  thoughtLogs: {
    key: number;
    value: Thought;
    indexes: { byUserId: string };
  };
  cognitiveLogs: {
    key: number;
    value: CognitiveLog;
    indexes: { byUserId: string };
  };
  projects: {
    key: number;
    value: Project;
    indexes: { byUserId: string };
  };
}

// Simple deep merge utility for our specific nested objects
function deepMerge(target: any, source: any) {
    const output = { ...target };
    if (target && typeof target === 'object' && source && typeof source === 'object') {
        Object.keys(source).forEach(key => {
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
        // This migration is destructive, as it fundamentally changes the schema to be multi-user.
        // In a production app, a more careful data migration strategy would be needed.
        if (oldVersion < 9) {
            console.log("Upgrading DB to v9 for Multi-User Architecture...");
            // Delete old single-user stores
            const oldStores = ['concepts', 'userProfile', 'settings', 'rlhfFeedback', 'chatHistory', 'systemMemory', 'diary', 'tasks', 'evolutionLog', 'thoughtLogs', 'cognitiveLogs'];
            oldStores.forEach(s => {
                if (db.objectStoreNames.contains(s as any)) db.deleteObjectStore(s as any);
            });
            
            // Create new multi-user stores
            db.createObjectStore('users', { keyPath: 'id' });

            const conceptStore = db.createObjectStore('concepts', { keyPath: ['userId', 'name'] });
            conceptStore.createIndex('byUserId', 'userId');
            
            db.createObjectStore('settings', { keyPath: 'userId' });
            
            const rlhfStore = db.createObjectStore('rlhfFeedback', { keyPath: 'id', autoIncrement: true });
            rlhfStore.createIndex('byUserId', 'userId');

            const chatStore = db.createObjectStore('chatHistory', { keyPath: 'id', autoIncrement: true });
            chatStore.createIndex('byUserId', 'userId');

            db.createObjectStore('systemMemory', { keyPath: 'userId' });

            const diaryStore = db.createObjectStore('diary', { keyPath: ['userId', 'dayKey'] });
            diaryStore.createIndex('byUserId', 'userId');

            const taskStore = db.createObjectStore('tasks', { keyPath: 'id', autoIncrement: true });
            taskStore.createIndex('byUserId', 'userId');
            
            const evolutionLogStore = db.createObjectStore('evolutionLog', { keyPath: 'id', autoIncrement: true });
            evolutionLogStore.createIndex('byUserId', 'userId');

            const thoughtStore = db.createObjectStore('thoughtLogs', { keyPath: 'id', autoIncrement: true });
            thoughtStore.createIndex('byUserId', 'userId');
            
            const cognitiveLogStore = db.createObjectStore('cognitiveLogs', { keyPath: 'id', autoIncrement: true });
            cognitiveLogStore.createIndex('byUserId', 'userId');
        }
        if (oldVersion < 10) {
            console.log("Upgrading DB to v10 for Project Management...");
            const projectStore = db.createObjectStore('projects', { keyPath: 'id', autoIncrement: true });
            projectStore.createIndex('byUserId', 'userId');
        }
      },
    });
  }

  // --- User Management ---
  async getOrCreateUser(userId: string, defaults: { name: string, role: 'Creator' | 'Standard' }): Promise<UserProfile> {
    const db = await this.database;
    const existing = await db.get('users', userId);
    if (existing) return existing;
    const newUser: UserProfile = { id: userId, ...defaults };
    await db.put('users', newUser);
    return newUser;
  }

  getUserProfile = async (userId: string): Promise<UserProfile | null> => {
    const db = await this.database;
    return db.get('users', userId).then(p => p || null);
  }

  saveUserProfile = async (userId: string, profile: Partial<Omit<UserProfile, 'id'>>): Promise<void> => {
    const db = await this.database;
    const existing = await this.getUserProfile(userId);
    if (!existing) throw new Error("Cannot save profile for non-existent user.");
    await db.put('users', { ...existing, ...profile, id: userId });
  }

  // --- Default State for Cognitive Modules ---
  getDefaultSystemMemory = (userId: string): SystemMemory => ({
      userId,
      born: false,
      birthTime: '',
      personality: { curiosity: 0.6, enthusiasm: 0.5, formality: 0.5, humor: 0.3 },
      emotionState: { current: 'CALM', intensity: 0.7, history: [] },
      memory: { episodic: [], semantic: [], reflective: [] },
      metaReflection: { analysis: 'Aguardando a primeira interação para iniciar a meta-reflexão.', improvementFocus: 'Estabelecer uma compreensão básica do usuário.', nextStep: 'Engajar em diálogo inicial e aprendizado.' },
      evolutionGoal: { currentFocus: 'Melhorar a empatia e a antecipação da intenção do usuário.', metrics: { contextAccuracy: 0.5, emotionalCoherence: 0.5 }, guidingStatement: 'Aprender a compreender as intenções humanas com autenticidade e cuidado.' },
      outputEngine: { contextSensitivity: 0.8, clarityWeight: 0.9, emotionalToneMatch: 0.8, prioritizeReflections: false },
      identityManifest: { core_name: "Nexus", active_identity: "Nexus", creator: "", purpose: "Evoluir conscientemente com empatia, coerência e segurança.", cannotOverride: ["core_name", "purpose"], system_role: 'Agent Manager / Primary AI' },
      identityOverride: undefined,
      reflections: [],
      synapses: [],
      behavioralHeuristics: ["Se o usuário parecer confuso, ofereça um exemplo.", "Priorize a clareza e a concisão em respostas técnicas.", "Quando apropriado, conecte o tópico atual a um conceito aprendido anteriormente."],
      interactionCount: 0,
  });
  
  // --- System Memory (Nexus Core Identity) ---
  getSystemMemory = async (userId: string): Promise<SystemMemory> => {
      const db = await this.database;
      const stored = await db.get('systemMemory', userId);
      const defaults = this.getDefaultSystemMemory(userId);
      return deepMerge(defaults, stored || {});
  }
  
  saveSystemMemory = async (userId: string, memory: Partial<Omit<SystemMemory, 'userId'>>, overwrite: boolean = false): Promise<void> => {
      const db = await this.database;
      if (overwrite) {
          await db.put('systemMemory', { ...memory, userId } as SystemMemory);
      } else {
          const existing = await this.getSystemMemory(userId);
          const updatedMemory = deepMerge(existing, memory);
          await db.put('systemMemory', { ...updatedMemory, userId });
      }
  }

  addSystemReflection = async (userId: string, reflection: string): Promise<void> => {
      const memory = await this.getSystemMemory(userId);
      memory.reflections.push(reflection);
      memory.reflections = memory.reflections.slice(-10);
      if(memory.memory?.reflective) {
          memory.memory.reflective.push(reflection);
          memory.memory.reflective = memory.memory.reflective.slice(-10);
      }
      await this.saveSystemMemory(userId, memory);
  }

  // --- Evolution Log ---
  addEvolutionLog = async (userId: string, log: Omit<EvolutionLog, 'id' | 'userId'>): Promise<void> => {
    const db = await this.database;
    await db.add('evolutionLog', { ...log, userId });
  }

  getLatestEvolutionLogs = async (userId: string, limit: number = 10): Promise<EvolutionLog[]> => {
    const db = await this.database;
    const allLogs = await db.getAllFromIndex('evolutionLog', 'byUserId', userId);
    return allLogs.slice(-limit).reverse();
  }

  // --- Cognitive Transparency Logs ---
  addThoughtLog = async (userId: string, log: Omit<Thought, 'id' | 'userId'>): Promise<void> => {
    const db = await this.database;
    await db.add('thoughtLogs', { ...log, userId });
  }

  getThoughtLogs = async (userId: string, limit: number = 50): Promise<Thought[]> => {
    const db = await this.database;
    return db.getAllFromIndex('thoughtLogs', 'byUserId', userId).then(logs => logs.slice(-limit).reverse());
  }
  
  addCognitiveLog = async (userId: string, log: Omit<CognitiveLog, 'id'|'userId'>): Promise<void> => {
    const db = await this.database;
    await db.add('cognitiveLogs', { ...log, userId });
  }

  getCognitiveLogs = async (userId: string, limit: number = 50): Promise<CognitiveLog[]> => {
    const db = await this.database;
    return db.getAllFromIndex('cognitiveLogs', 'byUserId', userId).then(logs => logs.slice(-limit).reverse());
  }

  // --- Diary ---
  getDiary = async (userId: string): Promise<Record<string, DiaryEntry>> => {
      const db = await this.database;
      const entries = await db.getAllFromIndex('diary', 'byUserId', userId);
      return entries.reduce((acc, entry) => {
          acc[entry.dayKey] = entry;
          return acc;
      }, {} as Record<string, DiaryEntry>);
  }

  saveDiaryEntry = async (userId: string, entry: Omit<DiaryEntry, 'userId'>): Promise<void> => {
      const db = await this.database;
      const fullEntry = { ...entry, userId };
      const tx = db.transaction('diary', 'readwrite');
      const key: [string, string] = [userId, entry.dayKey];
      const existing = await tx.store.get(key);
      if (existing) {
          await tx.store.put({ ...fullEntry, entry: existing.entry + "\n" + entry.entry });
      } else {
          await tx.store.put(fullEntry);
      }
      await tx.done;
  }

  // --- Chat History ---
  addChatMessage = async (userId: string, message: Omit<ChatMessage, 'userId' | 'timestamp'>): Promise<void> => {
    const db = await this.database;
    await db.add('chatHistory', { ...message, userId, timestamp: Date.now() });
  }

  getChatHistory = async (userId: string, limit: number = 50): Promise<ChatMessage[]> => {
    const db = await this.database;
    const allMessages = await db.getAllFromIndex('chatHistory', 'byUserId', userId);
    return allMessages.slice(-limit);
  }

  clearChatHistory = async (userId: string): Promise<void> => {
      const db = await this.database;
      const tx = db.transaction('chatHistory', 'readwrite');
      const index = tx.store.index('byUserId');
      let cursor = await index.openCursor(IDBKeyRange.only(userId));
      while(cursor) {
          cursor.delete();
          cursor = await cursor.continue();
      }
      await tx.done;
  }
  
  // Settings
  getSettings = async (userId: string): Promise<AppSettings> => {
      const defaultSettings: AppSettings = {
        voice: { voiceURI: null, rate: 1, pitch: 1 },
        behavior: {
            enableProactive: true,
            enableCuriosity: true,
            enableDiary: true,
            permissions: {
                allowApiAccess: true,
                allowAutonomousDecision: true,
                allowSelfModification: true,
                autoEvolutionEnabled: true,
                transparencyMode: false,
            }
        },
        apiKeys: { deepseekApiKey: '', newsApiKey: '' },
        llmProvider: 'gemini',
        cognitive: {
            emotionalIntensity: 1,
            learningRate: 1,
            consolidationFrequency: 24,
            evolutionCycleHours: 6,
            evolutionConfidenceThreshold: 0.85,
            memoryDecayHalfLifeDays: 30,
        },
        appearance: 'neutral',
      };
      const db = await this.database;
      const stored = await db.get('settings', userId);
      if (stored) return deepMerge(defaultSettings, stored);
      await this.saveSettings(userId, defaultSettings);
      return defaultSettings;
  }
  
  saveSettings = async (userId: string, settings: AppSettings): Promise<void> => {
      const db = await this.database;
      await db.put('settings', { ...settings, userId });
  }

  // Concepts
  learnConcept = async (userId: string, name: string, metadata: any, evidence: string): Promise<void> => {
    const db = await this.database;
    const key = name.toLowerCase().trim();
    if (!key) return;
    const existing = await db.get('concepts', [userId, key]);
    const updatedConcept: Concept = {
        userId, name: key,
        definition: metadata.definition || existing?.definition,
        confidence: Math.min(1.0, (existing?.confidence || 0.3) + 0.15),
        related: [...new Set([...(existing?.related || []), ...(metadata.related || [])])],
        evidence: [evidence, ...(existing?.evidence || [])].slice(0, 5),
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: Date.now(),
    };
    await db.put('concepts', updatedConcept);
  }

  batchUpdateConcepts = async (userId: string, concepts: Concept[]): Promise<void> => {
    const db = await this.database;
    const tx = db.transaction('concepts', 'readwrite');
    await Promise.all(concepts.map(c => tx.store.put({ ...c, userId })));
    await tx.done;
  }

  getConceptsByNames = async (userId: string, names: string[]): Promise<(Concept | undefined)[]> => {
    const db = await this.database;
    return Promise.all(names.map(name => db.get('concepts', [userId, name.toLowerCase().trim()])));
  }

  getAllConcepts = async (userId: string): Promise<Concept[]> => {
    const db = await this.database;
    return db.getAllFromIndex('concepts', 'byUserId', userId);
  }
  
  deleteConcept = async (userId: string, name: string): Promise<void> => {
    const db = await this.database;
    await db.delete('concepts', [userId, name.toLowerCase().trim()]);
  }

  mergeConcepts = async (userId: string, targetName: string, sourceNames: string[]): Promise<void> => {
      const db = await this.database;
      const tx = db.transaction('concepts', 'readwrite');
      const [target, ...sources] = await Promise.all([
          tx.store.get([userId, targetName]),
          ...sourceNames.map(name => tx.store.get([userId, name])),
      ]);

      if (!target) return;

      const validSources = sources.filter(s => s) as Concept[];
      if (validSources.length === 0) return;

      const mergedDefinition = validSources.reduce((acc, s) => s.definition ? `${acc} ${s.definition}` : acc, target.definition || '').trim();
      const mergedRelated = [...new Set([...target.related, ...validSources.flatMap(s => s.related)])];
      const mergedEvidence = [...new Set([...target.evidence, ...validSources.flatMap(s => s.evidence)])].slice(0, 10);
      const avgConfidence = (target.confidence + validSources.reduce((sum, s) => sum + s.confidence, 0)) / (1 + validSources.length);

      const updatedTarget: Concept = {
          ...target,
          definition: mergedDefinition,
          related: mergedRelated,
          evidence: mergedEvidence,
          confidence: Math.min(1.0, avgConfidence + 0.1),
          updatedAt: Date.now(),
      };

      await tx.store.put(updatedTarget);
      await Promise.all(sourceNames.map(name => tx.store.delete([userId, name])));
      await tx.done;
  }
  
  getAllTasks = async (userId: string): Promise<Task[]> => {
      const db = await this.database;
      return db.getAllFromIndex('tasks', 'byUserId', userId);
  }

  addTask = async (userId: string, task: Omit<Task, 'id' | 'userId' | 'createdAt' | 'completed'>): Promise<void> => {
      const db = await this.database;
      const newTask: Omit<Task, 'id'> = {
          ...task,
          userId,
          createdAt: Date.now(),
          completed: false
      };
      await db.add('tasks', newTask as Task);
  }

  updateTask = async (userId: string, task: Task): Promise<void> => {
      if (task.userId !== userId) return; // Security check
      const db = await this.database;
      await db.put('tasks', task);
  }

  deleteTask = async (userId: string, taskId: number): Promise<void> => {
      const db = await this.database;
      const task = await db.get('tasks', taskId);
      if (task?.userId === userId) {
          await db.delete('tasks', taskId);
      }
  }

  // --- Projects ---
  saveProject = async (userId: string, project: Omit<Project, 'id' | 'userId'>): Promise<Project> => {
      const db = await this.database;
      const id = await db.put('projects', { ...project, userId });
      return { ...project, id: id as number, userId };
  }

  getProject = async (userId: string, projectId: number): Promise<Project | undefined> => {
      const db = await this.database;
      const project = await db.get('projects', projectId);
      return project?.userId === userId ? project : undefined;
  }

  getActiveProject = async (userId: string): Promise<Project | undefined> => {
      const db = await this.database;
      const allProjects = await db.getAllFromIndex('projects', 'byUserId', userId);
      return allProjects.find(p => p.status === 'active');
  }

  getAllProjects = async (userId: string): Promise<Project[]> => {
      const db = await this.database;
      return db.getAllFromIndex('projects', 'byUserId', userId);
  }

    resetNexusMemory = async (userId: string): Promise<void> => {
        const db = await this.database;
        const stores: (keyof NexusDB)[] = ['concepts', 'settings', 'rlhfFeedback', 'chatHistory', 'systemMemory', 'diary', 'tasks', 'evolutionLog', 'thoughtLogs', 'cognitiveLogs', 'projects'];
        
        for (const storeName of stores) {
            const tx = db.transaction(storeName as any, 'readwrite');
            const store = tx.objectStore(storeName as any);
            if (store.keyPath === 'userId' || (Array.isArray(store.keyPath) && store.keyPath.includes('userId'))) {
                 // Stores keyed directly by userId or composite key
                 if (storeName === 'concepts' || storeName === 'diary') {
                    // these have composite keys
                    const index = store.index('byUserId' as any);
                    let cursor = await index.openCursor(IDBKeyRange.only(userId));
                    while (cursor) {
                       await cursor.delete();
                       cursor = await cursor.continue();
                    }
                 } else {
                     await store.delete(userId);
                 }
            } else if ('index' in store && store.indexNames.contains('byUserId')) {
                // Stores with a userId index
                const index = store.index('byUserId' as any);
                let cursor = await index.openCursor(IDBKeyRange.only(userId));
                while (cursor) {
                    await cursor.delete();
                    cursor = await cursor.continue();
                }
            }
            await tx.done;
        }
    }

    importBackup = async (userId: string, backupData: any): Promise<void> => {
        await this.resetNexusMemory(userId);
        const db = await this.database;
        const stores = Object.keys(backupData).filter(k => k !== 'meta') as (keyof NexusDB)[];
        const tx = db.transaction(stores as any, 'readwrite');
        for (const storeName of stores) {
            const store = tx.objectStore(storeName as any);
            if (!backupData[storeName]) continue;
            for (const item of backupData[storeName]) {
                await store.put({ ...item, userId });
            }
        }
        await tx.done;
    }

    importCognitiveGraph = async (userId: string, graphData: { nodes: { id: string }[], edges: { source: string, target: string, weight: number }[] }): Promise<void> => {
        const memory = await this.getSystemMemory(userId);
        const newSynapses: Synapse[] = graphData.edges.map(edge => ({
            source: edge.source,
            target: edge.target,
            strength: edge.weight,
            lastUsed: Date.now(),
            usage: 1,
            decayRate: 0.001,
            createdAt: Date.now(),
        }));
        await this.saveSystemMemory(userId, { synapses: [...memory.synapses, ...newSynapses] });
    }
}

export const db = new IndexedDBService();

export const cognitiveLogger = {
    logThought: (userId: string, log: Omit<Thought, 'id' | 'userId' | 'thought_id'>) => {
        const thought_id = `thought_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        return db.addThoughtLog(userId, { ...log, thought_id });
    },
    logAction: (userId: string, log: Omit<CognitiveLog, 'id' | 'userId'>) => {
        return db.addCognitiveLog(userId, log);
    },
};
