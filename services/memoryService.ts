import { Concept, DiaryEntry, AppSettings } from '../types';

const ACTIONS_KEY = 'nexus_actions';
const CONCEPTS_KEY = 'nexus_concepts';
const DIARY_KEY = 'nexus_diary';
const SETTINGS_KEY = 'nexus_settings';
const MAX_ACTIONS = 20;

// --- Settings Management ---
export const getSettings = (): AppSettings => {
    try {
        const stored = localStorage.getItem(SETTINGS_KEY);
        const defaultSettings: AppSettings = {
            voice: { voiceURI: null, rate: 1, pitch: 1 },
            behavior: { enableDiary: true, enableCuriosity: true },
        };
        return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
    } catch (e) {
        return {
            voice: { voiceURI: null, rate: 1, pitch: 1 },
            behavior: { enableDiary: true, enableCuriosity: true },
        };
    }
};

export const saveSettings = (settings: AppSettings): void => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

// --- Action Logging ---
export const logAction = (name: string, args: any): void => {
  try {
    const stored = localStorage.getItem(ACTIONS_KEY);
    const actions = stored ? JSON.parse(stored) : [];
    const newAction = { name, args, timestamp: new Date().toISOString() };
    actions.push(newAction);
    if (actions.length > MAX_ACTIONS) actions.shift();
    localStorage.setItem(ACTIONS_KEY, JSON.stringify(actions));
  } catch (error) {
    console.error("Failed to log action:", error);
  }
};

// --- Semantic Memory (Concepts) ---
const getConcepts = (): Record<string, Concept> => {
  try {
    const stored = localStorage.getItem(CONCEPTS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (e) { return {}; }
};

const saveConcepts = (concepts: Record<string, Concept>): void => {
  localStorage.setItem(CONCEPTS_KEY, JSON.stringify(concepts));
};

export const getAllConcepts = (): Concept[] => {
    return Object.values(getConcepts()).sort((a,b) => b.updatedAt - a.updatedAt);
};

export const deleteConcept = (name: string): void => {
    const concepts = getConcepts();
    delete concepts[name];
    saveConcepts(concepts);
};

export const learnConcept = (
  name: string,
  metadata: { definition?: string; related?: { type: string; target: string }[] },
  evidence: string
): void => {
  const concepts = getConcepts();
  const existing = concepts[name] || {
    name,
    confidence: 0.3,
    related: [],
    evidence: [],
    updatedAt: Date.now()
  };

  const updatedConcept: Concept = {
    ...existing,
    definition: metadata.definition || existing.definition,
    confidence: Math.min(1.0, existing.confidence + 0.15),
    related: [...new Set([...existing.related, ...(metadata.related || [])])], // Avoid duplicates
    evidence: [evidence, ...existing.evidence].slice(0, 5), // Prepend new evidence
    updatedAt: Date.now(),
  };
  concepts[name] = updatedConcept;
  saveConcepts(concepts);
};

export const strengthenConcept = (name: string, evidence: string): void => {
    const concepts = getConcepts();
    const concept = concepts[name];
    if (concept) {
        concept.confidence = Math.min(1.0, concept.confidence + 0.1);
        concept.evidence = [evidence, ...concept.evidence].slice(0, 5);
        concept.updatedAt = Date.now();
        saveConcepts(concepts);
    }
};


export const getWeakestConcepts = (limit: number = 5): Concept[] => {
    const concepts = getConcepts();
    return Object.values(concepts)
        .filter(c => c.confidence < 0.8)
        .sort((a, b) => a.confidence - b.confidence)
        .slice(0, limit);
};

// --- Daily Diary ---
export const getDiary = (): Record<string, DiaryEntry> => {
    try {
        const stored = localStorage.getItem(DIARY_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch (e) { return {}; }
};

export const saveDiaryEntry = (entry: string): void => {
    const diary = getDiary();
    const dayKey = new Date().toISOString().split('T')[0];
    diary[dayKey] = {
        dayKey,
        entry,
        createdAt: Date.now()
    };
    localStorage.setItem(DIARY_KEY, JSON.stringify(diary));
};

// --- Context for Prompt ---
export const getContextForPrompt = (): string => {
  const currentTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  let context = `Contexto Atual: São ${currentTime}.`;

  const concepts = getConcepts();
  const importantConcepts = Object.values(concepts).sort((a,b) => b.confidence - a.confidence).slice(0, 3);
  if (importantConcepts.length > 0) {
      context += `\n\nConceitos que eu já entendo bem:\n${importantConcepts.map(c => `- ${c.name} (confiança: ${Math.round(c.confidence*100)}%)`).join('\n')}`;
  }
  
  return context;
};
