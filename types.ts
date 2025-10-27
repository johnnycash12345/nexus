

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

export interface ChatMessage {
  id?: number; // Optional ID from IndexedDB
  role: 'user' | 'model';
  text: string;
  type?: 'message' | 'status' | 'proactive_question' | 'diary_entry' | 'curiosity_prompt' | 'concept_consolidation_prompt' | 'news_summary';
  timestamp?: number; // Optional timestamp from IndexedDB
  imageUrl?: string; // Base64 encoded image URL for vision
  consolidationOptions?: {
    targetConceptName: string;
    sourceConceptNames: string[];
  };
  sources?: { uri: string; title: string }[];
  articles?: NewsArticle[];
}

// --- Personality Traits ---
export interface Personality {
  curiosity: number; // 0 to 1
  enthusiasm: number; // 0 to 1
  formality: number; // 0 to 1
  humor: number; // 0 to 1
}

// --- Synapses for Neural Memory ---
export interface Synapse {
  source: string;
  target: string;
  strength: number; // 0 to 1
  lastUsed: number;
}

// --- IndexedDB Schemas ---
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

export interface SystemMemory {
    id?: number;
    born: boolean;
    birthTime: string;
    personality: Personality;
    reflections: string[];
    lastReflectionAt?: number;
    synapses?: Synapse[];
    interactionCount?: number;
    emotionState?: EmotionState;
    lastIntrospectionAt?: number;
    lastReasoningAt?: number;
}

export interface DiaryEntry {
    id?: number;
    dayKey: string; // "YYYY-MM-DD"
    entry: string;
    createdAt: number;
}

export interface Task {
  id?: number;
  text: string;
  completed: boolean;
  createdAt: number;
}


// --- App Settings ---
export interface VoiceSettings {
    voiceURI: string | null;
    rate: number;
    pitch: number;
}

export interface Permissions {
  allowApiAccess: boolean;
  allowAutonomousDecision: boolean;
  allowSelfModification: boolean;
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

export interface AppSettings {
    id?: number;
    voice: VoiceSettings;
    behavior: BehaviorSettings;
    apiKeys?: ApiKeySettings;
    llmProvider?: 'gemini' | 'deepseek';
    cognitive?: CognitiveSettings;
    appearance?: 'neutral' | 'feminine' | 'masculine';
}
