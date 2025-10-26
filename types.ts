
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
}

export enum Mood {
  ENTHUSIASTIC = 'ENTHUSIASTIC',
  CURIOUS = 'CURIOUS',
  SATISFIED = 'SATISFIED',
  BORED = 'BORED',
  IRRITATED = 'IRRITATED',
}

export interface ChatMessage {
  id?: number; // Optional ID from IndexedDB
  role: 'user' | 'model';
  text: string;
  type?: 'message' | 'status' | 'proactive_question' | 'diary_entry' | 'curiosity_prompt' | 'concept_consolidation_prompt';
  timestamp?: number; // Optional timestamp from IndexedDB
  imageUrl?: string; // Base64 encoded image URL for vision
  consolidationOptions?: {
    targetConceptName: string;
    sourceConceptNames: string[];
  };
  sources?: { uri: string; title: string }[];
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
    personality: string;
    emotion: Mood;
    reflections: string[];
    lastReflectionAt?: number;
}

export interface DiaryEntry {
    id?: number;
    dayKey: string; // "YYYY-MM-DD"
    entry: string;
    createdAt: number;
}


// --- App Settings ---
export interface VoiceSettings {
    voiceURI: string | null;
    rate: number;
    pitch: number;
}

export interface BehaviorSettings {
    enableProactive?: boolean;
    enableCuriosity?: boolean;
    enableDiary?: boolean;
}

export interface AppSettings {
    id?: number;
    voice: VoiceSettings;
    behavior: BehaviorSettings;
    apiKeys?: Record<string, never>; // API keys are now handled by environment variables
}
