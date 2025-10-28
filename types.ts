// types.ts

export type AssistantStatus =
  | 'IDLE'
  | 'LISTENING'
  | 'THINKING'
  | 'SPEAKING'
  | 'SUCCESS'
  | 'ERROR'
  | 'CURIOUS'
  | 'SLEEPY'
  | 'SURPRISED'
  | 'REWRITING_CODE'
  | 'SELF_ANALYSIS'
  | 'SEARCHING_WEB'
  | 'ROLLBACK';

export type Emotion = 'JOYFUL' | 'CALM' | 'CURIOUS' | 'UNCERTAIN' | 'AFRAID' | 'FOCUSED';

export interface EmotionState {
  current: Emotion;
  intensity: number;
  history: Emotion[];
}

export interface NewsArticle {
  title: string;
  description: string;
  url: string;
  sourceName: string;
}

export interface Source {
  uri: string;
  title: string;
}

export interface ConsolidationOptions {
  targetConceptName: string;
  sourceConceptNames: string[];
}

export interface LearningContext {
  inputIntent: string;
  emotionalTone: string;
  contextTags: string[];
  responseEffectiveness: number;
  reinforcementSignal: 'positive' | 'neutral' | 'negative';
}

export interface ChatMessage {
  id?: number;
  role: 'user' | 'model';
  text: string;
  type: 'message' | 'status' | 'diary_entry' | 'curiosity_prompt' | 'concept_consolidation_prompt' | 'news_summary';
  imageUrl?: string;
  timestamp?: number;
  consolidationOptions?: ConsolidationOptions;
  sources?: Source[];
  articles?: NewsArticle[];
  learningContext?: LearningContext;
}

export interface Permissions {
  allowApiAccess: boolean;
  allowAutonomousDecision: boolean;
  allowSelfModification: boolean;
  autoEvolutionEnabled: boolean;
  transparencyMode: boolean;
}

export interface AppSettings {
  voice: {
    voiceURI: string | null;
    rate: number;
    pitch: number;
  };
  behavior: {
    enableProactive: boolean;
    enableCuriosity: boolean;
    enableDiary: boolean;
    permissions: Permissions;
  };
  apiKeys: {
    deepseekApiKey: string;
    newsApiKey: string;
  };
  llmProvider: 'gemini' | 'deepseek';
  cognitive: {
    emotionalIntensity: number;
    learningRate: number;
    consolidationFrequency: number;
    evolutionCycleHours: number;
    evolutionConfidenceThreshold: number;
    memoryDecayHalfLifeDays: number;
  };
  appearance: 'neutral' | 'feminine' | 'masculine';
}

export interface VisualState {
  highlightNodes: string[];
  pulseIntensity: number;
  emotionalSpectrum: Partial<Record<Emotion, number>>;
}

export interface SimpleFunctionCall {
  name: string;
  args: { [key: string]: any };
}

export interface Concept {
    name: string;
    definition?: string;
    confidence: number;
    related: { type: string, target: string }[];
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
  timestamp: number;
  prompt: string;
  response: string;
  rating: 'good' | 'bad';
  feedback?: string;
}

export interface Personality {
  curiosity: number;
  enthusiasm: number;
  formality: number;
  humor: number;
}

export interface HierarchicalMemory {
  episodic: string[]; // Simplified for now
  semantic: string[];
  reflective: string[];
}

export interface MetaReflection {
  analysis: string;
  improvementFocus: string;
  nextStep: string;
  identifiedBias?: string;
  strategyForNextTurn?: string;
}

export interface EvolutionGoal {
  currentFocus: string;
  metrics: {
    contextAccuracy: number;
    emotionalCoherence: number;
  };
  guidingStatement: string;
  shortTermObjective?: string;
  longTermVision?: string;
}

export interface OutputEngine {
  contextSensitivity: number;
  clarityWeight: number;
  emotionalToneMatch: number;
  prioritizeReflections: boolean;
}

export interface IdentityManifest {
    core_name: string;
    active_identity: string;
    creator: string;
    purpose: string;
    cannotOverride: string[];
}

export interface IdentityOverride {
    personaName: string;
    directives: string[];
    expiresAt?: number;
}

export interface Synapse {
    source: string;
    target: string;
    strength: number;
    lastUsed: number;
    usage: number;
    decayRate: number;
    createdAt: number;
}

export interface SystemMemory {
    id?: number;
    born: boolean;
    birthTime: string;
    personality: Personality;
    emotionState: EmotionState;
    memory: HierarchicalMemory;
    metaReflection: MetaReflection;
    evolutionGoal: EvolutionGoal;
    outputEngine: OutputEngine;
    identityManifest: IdentityManifest;
    identityOverride?: IdentityOverride;
    reflections: string[];
    synapses: Synapse[];
    behavioralHeuristics?: string[];
    interactionCount: number;
    lastReflectionAt?: number;
    lastIntrospectionAt?: number;
    lastReasoningAt?: number;
    lastEvolutionAt?: number;
    evolutionSnapshot?: Partial<SystemMemory>; // To store state before evolution
}

export interface DiaryEntry {
  dayKey: string;
  entry: string;
  createdAt: number;
  learningContext?: LearningContext;
}

export interface Task {
  id?: number;
  text: string;
  createdAt: number;
  completed: boolean;
}

export interface EvolutionChange {
    target: string;
    oldValue: any;
    newValue: any;
}

export interface EvolutionLog {
    id?: number;
    timestamp: number;
    reasoning: string;
    changes: EvolutionChange[];
    confidence: number;
    analysis?: string;
    simulationResult?: string;
}

export type ThoughtCategory = 'decision-making' | 'self-reflection' | 'planning' | 'error-analysis' | 'curiosity';

export interface Thought {
    id?: number;
    thought_id: string;
    timestamp: number;
    category: ThoughtCategory;
    context: string;
    summary: string;
    emotional_state: Emotion;
    confidence: number;
}

export type EvolutionCyclePhase = 'IDLE' | 'OBSERVING' | 'ANALYZING' | 'REASONING' | 'SANDBOXING' | 'INTEGRATING' | 'PAUSED';

export type CognitiveEvent = 'auto_evolution' | 'rollback' | 'new_learning' | 'knowledge_expansion' | 'code_rewrite';
export type CognitiveStage = 'start_cycle' | 'observe' | 'analyze' | 'sandbox' | 'rejection' | 'integrate' | 'initiation' | 'web_learning' | 'proposal_logged';

export interface CognitiveLog {
    id?: number;
    timestamp: number;
    event: CognitiveEvent;
    stage: CognitiveStage;
    description: string;
    impact: string;
    result: string;
    rollback_used: boolean;
}

export interface LlmCognitiveResponse {
  text: string;
  learningContext: LearningContext;
  metaReflection: MetaReflection;
  functionCalls?: any[];
  sources?: Source[];
}

export type Intent = 'question' | 'command_news' | 'command_task' | 'small_talk' | 'self_reflection_query' | 'vision_query' | 'complex_reasoning' | 'unknown';

export interface CognitiveFrame {
    userInput: string;
    history: ChatMessage[];
    imageUrl?: string;
    intent: Intent;
    status: AssistantStatus;
    retrievedConcepts?: Concept[];
    retrievedReflections?: string[];
    llmResponse?: LlmCognitiveResponse;
}