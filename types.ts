

export enum AssistantStatus {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  THINKING = 'THINKING',
  SPEAKING = 'SPEAKING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  CURIOUS = 'CURIOUS',
  SLEEPY = 'SLEEPY',
  SURPRISED = 'SURPRISED',
  REWRITING_CODE = 'REWRITING_CODE',
  SELF_ANALYSIS = 'SELF_ANALYSIS',
  SEARCHING_WEB = 'SEARCHING_WEB',
  ROLLBACK = 'ROLLBACK',
}

export enum Emotion {
  CURIOUS = 'CURIOUS',
  JOYFUL = 'JOYFUL',
  UNCERTAIN = 'UNCERTAIN',
  CALM = 'CALM',
  FOCUSED = 'FOCUSED',
  AFRAID = 'AFRAID',
}

export interface EmotionState {
  current: Emotion;
  intensity: number; // 0 to 1
  history: Emotion[];
}

export interface NewsArticle {
  title: string;
  description: string;
  url: string;
  sourceName: string;
}

// --- Nexus Learning Engine 2.0 Types ---

export interface LearningContext {
  inputIntent: string; // e.g., 'question', 'statement', 'command'
  emotionalTone: string; // e.g., 'curious', 'happy', 'urgent'
  contextTags: string[]; // e.g., ['autonomy', 'consciousness']
  responseEffectiveness: number; // 0 to 1, model's self-evaluation
  reinforcementSignal: 'positive' | 'neutral' | 'negative';
}

export interface ChatMessage {
  id?: number; // Optional ID from IndexedDB
  role: 'user' | 'model';
  text: string;
  type?: 'message' | 'status' | 'proactive_question' | 'diary_entry' | 'curiosity_prompt' | 'concept_consolidation_prompt' | 'news_summary';
  timestamp?: number; // Optional ID from IndexedDB
  imageUrl?: string; // Base64 encoded image URL for vision
  consolidationOptions?: {
    targetConceptName: string;
    sourceConceptNames: string[];
  };
  sources?: { uri: string; title: string }[];
  articles?: NewsArticle[];
  learningContext?: LearningContext; // New deep learning context
}

export interface Personality {
  curiosity: number; // 0 to 1
  enthusiasm: number; // 0 to 1
  formality: number; // 0 to 1
  humor: number; // 0 to 1
}

// Evolved Synapse with dynamic properties
export interface Synapse {
  source: string;
  target: string;
  strength: number; // 0 to 1
  lastUsed: number;
  usage: number; // New: interaction counter
  decayRate: number; // New: rate of forgetting
}

export interface Concept {
  id?: number;
  name: string;
  definition?: string;
  confidence?: number; // 0 to 1
  related: {
    type: string; // e.g., 'is-a', 'used-for'
    target: string;
  }[];
  evidence: string[];
  createdAt: number;
  updatedAt: number;
}

export interface UserProfile {
  id?: number;
  name: string;
}

export interface RlhfData {
    id?: number;
    action: string;
    args: any;
    success: boolean;
    timestamp: number;
}

export interface HierarchicalMemory {
    episodic: string[];     // Summaries of recent events/conversations
    semantic: string[];     // Key learned concepts
    reflective: string[];   // Key insights and lessons learned
}

export interface MetaReflection {
    analysis: string;
    improvementFocus: string;
    nextStep: string;
}

// FIX: Exported LlmCognitiveResponse from here to be a shared type, resolving import errors.
export type LlmCognitiveResponse = {
  text: string;
  sources?: { uri: string; title: string }[];
  learningContext: LearningContext;
  metaReflection: MetaReflection;
};

export interface EvolutionGoal {
    currentFocus: string;
    metrics: {
        contextAccuracy: number;
        emotionalCoherence: number;
    };
    guidingStatement: string;
}

export interface OutputEngine {
    contextSensitivity: number; // 0-1
    clarityWeight: number;      // 0-1
    emotionalToneMatch: number; // 0-1
    prioritizeReflections: boolean;
}

export interface VisualState {
    highlightNodes: string[];
    pulseIntensity: number;
    emotionalSpectrum: Record<string, number>;
}


// The master record for the AI's core state
export interface SystemMemory {
    id?: number;
    born: boolean;
    birthTime: string;
    personality: Personality;
    interactionCount?: number;
    emotionState?: EmotionState;
    // New Learning Engine 2.0 modules
    memory?: HierarchicalMemory;
    synapses?: Synapse[];
    metaReflection?: MetaReflection;
    evolutionGoal?: EvolutionGoal;
    outputEngine?: OutputEngine;
    // Timestamps for cognitive cycles
    lastReflectionAt?: number;
    lastIntrospectionAt?: number;
    lastReasoningAt?: number;
    lastEvolutionAt?: number;
    // This is now part of memory.reflective, but keep for legacy/simplicity
    reflections: string[]; 
    // For self-evolution rollbacks
    evolutionSnapshot?: Partial<SystemMemory>;
}

export interface EvolutionLog {
    id?: number;
    cycleId: string;
    changes: { target: string; value: any; }[];
    confidence: number;
    rollbackUsed: boolean;
    timestamp: number;
}

export interface DiaryEntry {
    id?: number;
    dayKey: string; // "YYYY-MM-DD"
    entry: string;
    createdAt: number;
    learningContext?: LearningContext;
}

export interface Task {
  id?: number;
  text: string;
  completed: boolean;
  createdAt: number;
}

export interface AppSettings {
    id?: number;
    voice: VoiceSettings;
    behavior: BehaviorSettings;
    apiKeys?: ApiKeySettings;
    llmProvider?: 'gemini' | 'deepseek';
    cognitive?: CognitiveSettings;
    appearance?: 'neutral' | 'feminine' | 'masculine';
}

export interface VoiceSettings {
    voiceURI: string | null;
    rate: number;
    pitch: number;
}

export interface Permissions {
  allowApiAccess: boolean;
  allowAutonomousDecision: boolean;
  allowSelfModification: boolean;
  allowEmotionEvolve?: boolean;
  allowDriveSync?: boolean;
}

export interface BehaviorSettings {
    enableProactive?: boolean;
    enableCuriosity?: boolean;
    enableDiary?: boolean;
    permissions?: Permissions;
}

export interface CognitiveSettings {
    emotionalIntensity: number; // 0.5 to 1.5
    learningRate: number;       // 0.5 to 2.0
    consolidationFrequency: number; // in minutes
}

export interface ApiKeySettings {
    deepseekApiKey?: string;
    newsApiKey?: string;
}