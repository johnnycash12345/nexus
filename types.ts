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

export interface CodeModificationProposal {
    reasoning: string;
    modificationType: 'REPLACE' | 'INSERT_BEFORE' | 'INSERT_AFTER';
    targetSnippet: string;
    newCode: string;
}

export interface ChatMessage {
  id?: number;
  userId: string;
  role: 'user' | 'model';
  text: string;
  type: 'message' | 'status' | 'diary_entry' | 'curiosity_prompt' | 'concept_consolidation_prompt' | 'news_summary' | 'code_proposal_prompt';
  imageUrl?: string;
  timestamp?: number;
  consolidationOptions?: ConsolidationOptions;
  sources?: Source[];
  articles?: NewsArticle[];
  learningContext?: LearningContext;
  codeProposal?: {
      goal: string;
      code: string;
  };
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
    enableReflection: boolean;
    enableAutonomousLearning: boolean;
    enableBackgroundMaintenance: boolean;
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
    reflectionFrequencyMinutes: number;
    learningModel: 'gemini-2.5-flash' | 'gemini-2.5-pro';
    // FIX: Add missing cognitive settings properties.
    reflectionEffectivenessThreshold?: number;
    reflectionMinInteractions?: number;
    reflectionMinLowPerf?: number;
    reflectionMinTrends?: number;
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
  id: string;
}

export interface Concept {
    userId: string;
    name: string;
    definition?: string;
    confidence: number;
    related: { type: string, target: string }[];
    evidence: string[];
    createdAt: number;
    updatedAt: number;
}

export type UserRole = 'Creator' | 'Standard';

export interface UserProfile {
  id: string; // userId
  name: string;
  role: UserRole;
}

export interface UserContext {
    userId: string;
    userName: string;
    userRole: UserRole;
}

export interface RlhfData {
  id?: number;
  userId: string;
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
    system_role: string;
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
    userId: string;
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
  userId: string;
  dayKey: string;
  entry: string;
  createdAt: number;
  learningContext?: LearningContext;
}

export interface Task {
  id?: number;
  userId: string;
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
    userId: string;
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
    userId: string;
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
    userId: string;
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
  functionCalls?: SimpleFunctionCall[];
  sources?: Source[];
}

export type Intent = 'question' | 'command_news' | 'command_task' | 'small_talk' | 'self_reflection_query' | 'vision_query' | 'complex_reasoning' | 'project_start' | 'web_search' | 'unknown';

export interface CognitiveFrame {
    userInput: string;
    history: ChatMessage[];
    imageUrl?: string;
    intent: Intent;
    status: AssistantStatus;
    userContext: UserContext;
    // FIX: Add optional latency property.
    latency?: number;
    retrievedConcepts?: Concept[];
    retrievedReflections?: string[];
    llmResponse?: LlmCognitiveResponse;
}

export interface ProjectTask {
    step: number;
    description: string;
    status: 'pending' | 'in_progress' | 'completed';
    result?: string;
}

export interface Project {
    id?: number;
    userId: string;
    name: string;
    goal: string;
    tasks: ProjectTask[];
    createdAt: number;
    status: 'active' | 'completed' | 'paused';
}

export type SpeakFn = (text: string, onend?: () => void) => void;
export type AddMessageFn = (m: Omit<ChatMessage, 'userId' | 'timestamp'>) => void;
export type SetStatusFn = (s: AssistantStatus) => void;
export type GenerateResponseFn = (prompt: string, history: ChatMessage[], options?: any) => Promise<any>;
export type GenerateVisionResponseFn = (prompt: string, imageUrl: string) => Promise<any>;

export interface OrchestratorOptions {
  userId: string;
  speak: SpeakFn;
  addMessage: AddMessageFn;
  setStatus: SetStatusFn;
  generateResponse: GenerateResponseFn;
  generateVisionResponse: GenerateVisionResponseFn;
}

export type DecisionLogType = 'CODE_PROPOSAL' | 'AUTONOMOUS_SEARCH' | 'CONCEPT_MERGE';

export interface DecisionLogEntry {
    id?: number;
    userId: string;
    timestamp: number;
    decisionType: DecisionLogType;
    reasoning: string;
    details: any; // JSON payload with action details
}