export enum AssistantStatus {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  THINKING = 'THINKING',
  SPEAKING = 'SPEAKING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  type?: 'message' | 'status' | 'curiosity_prompt' | 'diary_entry';
}

export interface Concept {
  name: string;
  definition?: string;
  confidence: number; // 0 to 1
  related: {
    type: string; // e.g., 'is-a', 'used-for'
    target: string;
  }[];
  evidence: string[];
  updatedAt: number;
}

export interface DiaryEntry {
    dayKey: string; // "YYYY-MM-DD"
    entry: string;
    createdAt: number;
}

export interface VoiceSettings {
    voiceURI: string | null;
    rate: number;
    pitch: number;
}

export interface BehaviorSettings {
    enableDiary: boolean;
    enableCuriosity: boolean;
}

export interface AppSettings {
    voice: VoiceSettings;
    behavior: BehaviorSettings;
}
