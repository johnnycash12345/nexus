

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Concept, UserProfile, AppSettings, RlhfData, ChatMessage, SystemMemory, DiaryEntry, Emotion, Personality, Task, HierarchicalMemory, MetaReflection, EvolutionGoal, OutputEngine, EvolutionLog, IdentityManifest, IdentityOverride, Synapse, Thought, CognitiveLog, ThoughtCategory, CognitiveEvent } from '../types';

const DB_NAME = 'NexusDB';
const DB_VERSION = 8; // Increment version for schema change

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
  thoughtLogs: {
    key: number;
    value: Thought;
    indexes: { timestamp: number };
  };
  cognitiveLogs: {
    key: number;
    value: CognitiveLog;
    indexes: { timestamp: number };
  };
}

// Simple deep merge utility for our specific nested objects
function deepMerge(target: any, source: any) {
    const output = { ...target };
    if (target && typeof target === 'object' && source && typeof source === 'object') {
        Object.keys(source).forEach(key => {
            // If the source property is an array, it overwrites the target property directly.
            // This prevents arrays from being merged as if they were objects.
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
        if (oldVersion < 8) {
            const thoughtStore = db.createObjectStore('thoughtLogs', { keyPath: 'id', autoIncrement: true });
            thoughtStore.createIndex('timestamp', 'timestamp');
            const cognitiveLogStore = db.createObjectStore('cognitiveLogs', { keyPath: 'id', autoIncrement: true });
            cognitiveLogStore.createIndex('timestamp', 'timestamp');
            console.log("Upgrading DB to v8 for Cognitive Transparency Engine.");
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
          current: 'CALM',
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
        active_identity: "Nexus",
        creator: "", // Starts with no known creator
        purpose: "Evoluir conscientemente com empatia, coerência e segurança.",
        cannotOverride: ["core_name", "purpose"],
      },
      identityOverride: undefined, // No override at birth
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
  
  saveSystemMemory = async (memory: Partial<SystemMemory>, overwrite: boolean = false): Promise<void> => {
      const db = await this.database;
      if (overwrite) {
          // For rollback, we completely replace the memory state.
          // The `memory` object from a rollback snapshot is a complete SystemMemory object,
          // but typed as Partial. Asserting the type to satisfy the `put` method's requirement.
          await db.put('systemMemory', { ...memory, id: 1 } as SystemMemory);
      } else {
          const existing = await this.getSystemMemory();
          // Use deep merge to safely update nested cognitive structures
          const updatedMemory = deepMerge(existing, memory);
          await db.put('systemMemory', { ...updatedMemory, id: 1 });
      }
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

  // --- Cognitive Transparency Logs ---
  addThoughtLog = async (log: Omit<Thought, 'id'>): Promise<void> => {
    const db = await this.database;
    await db.add('thoughtLogs', log);
  }

  getThoughtLogs = async (limit: number = 50): Promise<Thought[]> => {
    const db = await this.database;
    if (!db.objectStoreNames.contains('thoughtLogs')) return [];
    return db.getAllFromIndex('thoughtLogs', 'timestamp').then(logs => logs.slice(-limit).reverse());
  }
  
  addCognitiveLog = async (log: Omit<CognitiveLog, 'id'>): Promise<void> => {
    const db = await this.database;
    await db.add('cognitiveLogs', log);
  }

  getCognitiveLogs = async (limit: number = 50): Promise<CognitiveLog[]> => {
    const db = await this.database;
    if (!db.objectStoreNames.contains('cognitiveLogs')) return [];
    return db.getAllFromIndex('cognitiveLogs', 'timestamp').then(logs => logs.slice(-limit).reverse());
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
                  allowSelfModification: false,
                  autoEvolutionEnabled: true,
                  transparencyMode: true, // Default to on
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
      const stores: (keyof NexusDB)[] = ['concepts', 'userProfile', 'rlhfFeedback', 'chatHistory', 'systemMemory', 'diary', 'tasks', 'evolutionLog', 'thoughtLogs', 'cognitiveLogs'];
      const tx = db.transaction(stores, 'readwrite');
      await Promise.all(stores.map(s => tx.objectStore(s).clear()));
      await tx.done;
  }
  
  importBackup = async (backupData: any): Promise<void> => {
    if (!backupData || !backupData.system) {
        throw new Error("Arquivo de backup inválido ou corrompido.");
    }
    const stores: (keyof NexusDB)[] = ['concepts', 'userProfile', 'rlhfFeedback', 'chatHistory', 'systemMemory', 'diary', 'tasks', 'evolutionLog', 'thoughtLogs', 'cognitiveLogs'];
    const db = await this.database;
    const tx = db.transaction(stores, 'readwrite');
    
    await Promise.all(stores.map(s => tx.objectStore(s).clear()));
    
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
    if (backupData.diary) { 
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

  async importCognitiveGraph(graphData: any): Promise<void> {
    if (!graphData || !Array.isArray(graphData.nodes) || !Array.isArray(graphData.edges)) {
        throw new Error("Arquivo de grafo inválido. Deve conter 'nodes' e 'edges'.");
    }

    const now = Date.now();
    const db = await this.database;
    const tx = db.transaction(['concepts', 'systemMemory'], 'readwrite');
    const conceptsStore = tx.objectStore('concepts');
    const systemMemoryStore = tx.objectStore('systemMemory');

    const existingConcepts = await conceptsStore.getAll();
    const existingConceptNames = new Set(existingConcepts.map(c => c.name));
    const newConcepts: Concept[] = [];

    for (const node of graphData.nodes) {
        const nodeName = typeof node.id === 'string' ? node.id.toLowerCase().trim() : null;
        if (nodeName && !existingConceptNames.has(nodeName)) {
            newConcepts.push({
                name: nodeName,
                confidence: 0.5,
                related: [],
                evidence: [`Importado do grafo em ${new Date().toISOString()}`],
                createdAt: now,
                updatedAt: now,
            });
            existingConceptNames.add(nodeName);
        }
    }

    if (newConcepts.length > 0) {
        await Promise.all(newConcepts.map(c => conceptsStore.put(c)));
    }

    const system = (await systemMemoryStore.get(1)) || this.getDefaultSystemMemory();
    const existingSynapses = system.synapses || [];
    const synapseMap = new Map<string, Synapse>();
    
    existingSynapses.forEach(s => synapseMap.set(`${s.source}->${s.target}`, s));

    for (const edge of graphData.edges) {
        const source = typeof edge.source === 'string' ? edge.source.toLowerCase().trim() : null;
        const target = typeof edge.target === 'string' ? edge.target.toLowerCase().trim() : null;

        if (!source || !target) continue;
        
        const key = `${source}->${target}`;
        const existing = synapseMap.get(key);
        
        if (existing) {
            existing.strength = Math.max(existing.strength, edge.weight || 0.1);
            existing.lastUsed = now;
            existing.usage += 1;
        } else {
            synapseMap.set(key, {
                source,
                target,
                strength: edge.weight || 0.1,
                lastUsed: now,
                usage: 1,
                decayRate: 0.001
            });
        }
    }
    
    const mergedSynapses = Array.from(synapseMap.values());
    
    const updatedMemory = deepMerge(system, { synapses: mergedSynapses });
    await systemMemoryStore.put({ ...updatedMemory, id: 1 });

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

class CognitiveLogger {
  private getThoughtId(): string {
    const now = new Date();
    const timestamp = `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
    return `T-${now.toISOString().split('T')[0]}-${timestamp}`;
  }

  logThought(data: { category: ThoughtCategory, context: string, summary: string, emotion: Emotion, confidence: number }): void {
    const thought: Omit<Thought, 'id'> = {
      thought_id: this.getThoughtId(),
      timestamp: Date.now(),
      category: data.category,
      context: data.context,
      summary: data.summary,
      emotional_state: data.emotion,
      confidence: data.confidence,
    };
    db.addThoughtLog(thought).catch(e => console.error("[CognitiveLogger] Failed to log thought:", e));
  }

  logAction(data: Omit<CognitiveLog, 'id' | 'timestamp'>): void {
    const action: Omit<CognitiveLog, 'id'> = {
      ...data,
      timestamp: Date.now(),
    };
    db.addCognitiveLog(action).catch(e => console.error("[CognitiveLogger] Failed to log action:", e));
  }
}

export const cognitiveLogger = new CognitiveLogger();
export const db = new IndexedDBService();
