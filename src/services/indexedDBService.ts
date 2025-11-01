import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Concept, UserProfile, AppSettings, RlhfData, ChatMessage, SystemMemory, DiaryEntry, Task, EvolutionLog, Thought, CognitiveLog, Project, DecisionLogEntry, WorldReflection, Synapse } from '../types';

const DB_NAME = 'NexusDB';
const DB_VERSION = 12; // Increment version for schema change

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
  decisionLogs: {
    key: number;
    value: DecisionLogEntry;
    indexes: { byUserId: string };
  };
  worldReflections: {
    key: number;
    value: WorldReflection;
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
        // FIX: Add worldReflections store for DB v12.
        if (oldVersion < 12) {
            console.log("Upgrading DB to v12 for World Reflections...");
            if (!db.objectStoreNames.contains('worldReflections')) {
                const worldReflectionStore = db.createObjectStore('worldReflections', { keyPath: 'id', autoIncrement: true });
                worldReflectionStore.createIndex('byUserId', 'userId');
            }
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
      identityManifest: { core_name: "Nexus", active_identity: "Nexus", creator: "", purpose: "Evoluir conscientemente com empatia, coerência e segurança.", cannotOverride: ["core_name", "purpose"], system_role: 'A inteligência principal que opera e evolui dentro do sistema Nexus.' },
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
      const updatedReflections = [...memory.reflections, reflection].slice(-50);
      
      if(memory.memory?.reflective) {
          memory.memory.reflective.push(reflection);
          memory.memory.reflective = memory.memory.reflective.slice(-10);
      }
      await this.saveSystemMemory(userId, { reflections: updatedReflections, memory: memory.memory });
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
            enableReflection: true,
            enableAutonomousLearning: true,
            enableBackgroundMaintenance: true,
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
            reflectionFrequencyMinutes: 10,
            learningModel: 'gemini-2.5-flash',
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
  
  saveConceptsAndSynapses = async (userId: string, newConcepts: Concept[], newSynapses: { source: string, target: string, strength: number }[]): Promise<void> => {
    const db = await this.database;
    const tx = db.transaction(['concepts', 'systemMemory'], 'readwrite');
    const conceptStore = tx.objectStore('concepts');
    const memoryStore = tx.objectStore('systemMemory');

    const conceptPromises = newConcepts.map(c => conceptStore.put(c));

    const memoryPromise = async () => {
      if (newSynapses.length > 0) {
        const memory = await memoryStore.get(userId) || this.getDefaultSystemMemory(userId);
        const synapseMap = new Map<string, Synapse>();
        (memory.synapses || []).forEach(s => synapseMap.set(`${s.source}->${s.target}`, s));

        const now = Date.now();
        for (const ns of newSynapses) {
            const key = `${ns.source}->${ns.target}`;
            const existing = synapseMap.get(key);
            if (existing) {
                existing.strength = Math.min(1.0, (existing.strength + ns.strength) / 2); // Average strength for reinforcement
                existing.lastUsed = now;
                existing.usage++;
            } else {
                synapseMap.set(key, { ...ns, lastUsed: now, usage: 1, decayRate: 0.001, createdAt: now });
            }
        }
        memory.synapses = Array.from(synapseMap.values());
        await memoryStore.put(memory);
      }
    };

    await Promise.all([...conceptPromises, memoryPromise()]);
    await tx.done;
  }
  
  getAllTasks = async (userId: string): Promise<Task[]> => {
      const db = await this.database;
      return db.getAllFromIndex('tasks', 'byUserId', userId);
  }

  addTask = async (userId: string, task: Omit<Task, 'id' | 'userId' | 'createdAt' | 'completed'>): Promise<Task> => {
      const db = await this.database;
      const newTask: Omit<Task, 'id'> = {
          ...task,
          userId,
          createdAt: Date.now(),
          completed: false
      };
      const id = await db.add('tasks', newTask as Task);
      return { ...newTask, id: id as number };
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
        const stores: (keyof NexusDB)[] = ['concepts', 'settings', 'rlhfFeedback', 'chatHistory', 'systemMemory', 'diary', 'tasks', 'evolutionLog', 'thoughtLogs', 'cognitiveLogs', 'projects', 'decisionLogs', 'worldReflections'];
        
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
                // Ensure all imported items are correctly associated with the current user
                const itemToPut = { ...item, userId };
                // Handle stores with composite keys
                if (storeName === 'concepts') itemToPut.name = item.name.toLowerCase().trim();
                if (storeName === 'diary') itemToPut.dayKey = item.dayKey;
                await store.put(itemToPut);
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

  addDecisionLog = async (entry: Omit<DecisionLogEntry, 'id'>): Promise<void> => {
    const db = await this.database;
    await db.add('decisionLogs', entry as DecisionLogEntry);
  }

  getDecisionLogs = async (userId: string, limit: number = 50): Promise<DecisionLogEntry[]> => {
    const db = await this.database;
    return db.getAllFromIndex('decisionLogs', 'byUserId', userId).then(logs => logs.slice(-limit).reverse());
  }
  
  // --- World Reflections ---
  addWorldReflection = async (userId: string, reflection: Omit<WorldReflection, 'id'|'userId'>): Promise<void> => {
    const db = await this.database;
    await db.add('worldReflections', { ...reflection, userId });
  }

  getWorldReflections = async (userId: string, limit: number = 10): Promise<WorldReflection[]> => {
    const db = await this.database;
    const allReflections = await db.getAllFromIndex('worldReflections', 'byUserId', userId);
    return allReflections.slice(-limit).reverse(); // Return most recent first
  }
}

export const db = new IndexedDBService();

export const cognitiveLogger = {
    logAction: (userId: string, data: Omit<CognitiveLog, 'id' | 'userId'>) => db.addCognitiveLog(userId, data),
    logThought: (userId: string, thought: Omit<Thought, 'id' | 'userId' | 'thought_id'>) => {
        const thought_id = `thought_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        db.addThoughtLog(userId, { ...thought, thought_id });
    },
    info: (userId: string, message: string) => console.log(`[CognitiveLogger:${userId}] ${message}`),
    warn: (userId: string, message: string, data?: any) => console.warn(`[CognitiveLogger:${userId}] ${message}`, data),
    error: (userId: string, message: string, error?: any) => console.error(`[CognitiveLogger:${userId}] ${message}`, error),
};
