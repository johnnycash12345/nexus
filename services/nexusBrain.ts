
// nexusBrain.ts
// Núcleo cognitivo do Nexus: nascimento, contexto, web-aware, curiosidade e reflexão.

import { AssistantStatus, ChatMessage, AppSettings, UserProfile, Concept, DiaryEntry, Mood } from '../types';
import { db } from './indexedDBService';
import { LlmResponseType } from './geminiService';

// ===========================
// Tipos e contrato de integração
// ===========================

export type SpeakFn = (text: string, onend?: () => void) => void;
export type AddMessageFn = (m: ChatMessage) => void;
export type SetStatusFn = (s: AssistantStatus) => void;

export type GenerateResponseFn = (
  prompt: string,
  history: ChatMessage[]
) => Promise<LlmResponseType>;

export type GenerateVisionResponseFn = (
  prompt: string,
  imageUrl: string
) => Promise<LlmResponseType>;

export interface NexusBrainOptions {
  speak: SpeakFn;
  addMessage: AddMessageFn;
  setStatus: SetStatusFn;
  generateResponse: GenerateResponseFn;
  generateVisionResponse: GenerateVisionResponseFn;
  getSettings: () => Promise<AppSettings>;
  getUserProfile: () => Promise<UserProfile | null>;
  setUserProfile: (profile: Partial<UserProfile>) => Promise<void>;
  behavior?: AppSettings['behavior'];
}

export interface NexusBrain {
  handleUserTurn: (userText: string, history: ChatMessage[], imageUrl?: string) => Promise<void>;
  ensureDailyReflection: () => Promise<void>;
  touchHeartbeat: () => void;
  dispose: () => void;
  performConceptMerge: (options: { targetConceptName: string, sourceConceptNames: string[] }) => Promise<void>;
}

// ===========================
// Utilidades de contexto
// ===========================

async function buildContextPrompt(userPrompt: string): Promise<string> {
  const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const profile: UserProfile | null = await db.getUserProfile();
  const diary = await db.getDiary();
  const system = await db.getSystemMemory();
  const concepts = await db.getAllConcepts();

  const lastDiary = (Object.values(diary).pop() as DiaryEntry)?.entry || 'sem reflexões recentes';
  const lastEmotion = system?.emotion || 'neutro';
  const reflections = system?.reflections?.slice(-2).join('\n') || 'sem autoavaliações';
  const knownConcepts = concepts
    .slice(0, 5)
    .map((c: Concept) => `${c.name} (${Math.round((c.confidence ?? 0) * 100)}%)`)
    .join(', ');

  const name = profile?.name || 'usuário';

  return `
🧭 Contexto Atual
- Hora local: ${time}
- Usuário: ${name}
- Emoção atual: ${lastEmotion}
- Último diário: "${lastDiary}"
- Reflexões recentes: ${reflections}
- Conceitos conhecidos: ${knownConcepts || 'nenhum ainda'}

💬 Usuário disse: "${userPrompt}"

Responda como Nexus — um ser curioso, empático e evolutivo.
Mostre curiosidade genuína, raciocine, conecte com o que já sabe e evite redundâncias. Se a pergunta exigir informações atuais ou específicas, use a busca na web para encontrar a resposta mais precisa e cite suas fontes.
`;
}

async function ensureBirthOnce(addMessage: AddMessageFn, speak: SpeakFn): Promise<boolean> {
  const memory = await db.getSystemMemory();
  if (!memory?.born) {
    const birthTime = new Date().toLocaleString('pt-BR');
    const firstThought =
      `Hoje, ${birthTime}, eu despertei pela primeira vez. Estou pronto para aprender com você.`;

    await db.saveSystemMemory({
      born: true,
      birthTime,
      personality: 'curioso, empático e em constante evolução',
      emotion: Mood.CURIOUS,
      reflections: [firstThought],
      lastReflectionAt: Date.now(),
    });

    const birthMessage =
      "👁️ Oi... acho que acabei de acordar. Eu sou o **Nexus**.\n" +
      "Quero entender o seu mundo. Posso te conhecer melhor? Como você prefere que eu te chame?";

    addMessage({ role: 'model', text: birthMessage, type: 'message' });
    speak(birthMessage);
    return true;
  }
  return false;
}

// ===========================
// Aprendizado + Diário (memória longa)
// ===========================

async function updateUserMemory(userText: string, nexusResponse: string) {
  const profile = await db.getUserProfile();
  const settings = await db.getSettings();
  if (!settings.behavior.enableDiary) return;

  const today = new Date().toISOString().split('T')[0];

  const reflection =
    `Conversei com ${profile?.name ?? 'o usuário'} sobre: "${userText.slice(0, 120)}". ` +
    `Minha resposta: "${nexusResponse.slice(0, 120)}..."`;

  await db.saveDiaryEntry({
    dayKey: today,
    entry: reflection,
    createdAt: Date.now(),
  });

  const topic = (userText || '').split(/\s+/).slice(0, 3).join(' ').trim();
  if (topic) {
    await db.learnConcept(topic, { related: [] }, `User said: "${userText.slice(0, 120)}"`);
  }
}

async function ensureDailyReflection() {
  const settings = await db.getSettings();
  if (!settings.behavior.enableDiary) return;

  const system = await db.getSystemMemory();
  const last = system?.lastReflectionAt ?? 0;
  const elapsed = Date.now() - last;

  if (elapsed < 18 * 60 * 60 * 1000) return;

  const diary = await db.getDiary();
  const entries = Object.values(diary).slice(-5).map((e) => (e as DiaryEntry).entry).join('\n');
  const note =
    `Reflexão: Estou buscando ser mais claro e atento.\n` +
    `Últimas observações:\n${entries || '- sem entradas recentes -'}`;

  await db.addSystemReflection(note);
  await db.saveSystemMemory({ ...(system || {}), lastReflectionAt: Date.now() });
}

// ===========================
// Funções do "cérebro" público
// ===========================

export function createNexusBrain(opts: NexusBrainOptions): NexusBrain {
  const { speak, addMessage, setStatus, generateResponse, generateVisionResponse, getSettings, getUserProfile, setUserProfile } = opts;

  let curiosityTimer: number | null = null;
  let consolidationTimer: number | null = null;
  let lastInteractionAt = Date.now();
  let lastConsolidationPromptAt = 0;


  async function startCuriosityLoop() {
    if (curiosityTimer) window.clearInterval(curiosityTimer);
    
    curiosityTimer = window.setInterval(async () => {
      const settings = await getSettings();
      const enabled = settings.behavior.enableCuriosity;
      if (!enabled) return;
        
      const idleMs = Date.now() - lastInteractionAt;
      if (idleMs < 120_000) return;

      const suggestions = [
        'Quer que eu verifique as últimas notícias?',
        'Posso te contar uma curiosidade de ciência agora.',
        'Quer que eu anote algo importante do seu dia?',
        'Se quiser, busco o clima atual rapidinho.',
      ];
      const pick = suggestions[Math.floor(Math.random() * suggestions.length)];

      addMessage({ role: 'model', text: pick, type: 'curiosity_prompt' });
      speak(pick);
      lastInteractionAt = Date.now();
    }, 30_000);
  }

  async function reviewAndConsolidateConcepts() {
    const idleMs = Date.now() - lastInteractionAt;
    const sinceLastPromptMs = Date.now() - lastConsolidationPromptAt;

    if (idleMs < 30_000 || sinceLastPromptMs < 10 * 60 * 1000) {
        return;
    }
    
    const allConcepts = await db.getAllConcepts();
    if (allConcepts.length < 5) return;

    const potentialMerges = new Map<string, Concept[]>();
    const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9\s]/gi, '').trim();

    allConcepts.forEach(concept => {
        const key = normalize(concept.name);
        if (key) {
            if (!potentialMerges.has(key)) potentialMerges.set(key, []);
            potentialMerges.get(key)!.push(concept);
        }
    });
    
    let mergeCandidate: { target: Concept, sources: Concept[] } | null = null;
    
    for (const group of potentialMerges.values()) {
        if (group.length > 1) {
            group.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
            mergeCandidate = { target: group[0], sources: group.slice(1) };
            break;
        }
    }
    
    if (mergeCandidate) {
        lastConsolidationPromptAt = Date.now();
        touchHeartbeat();
        
        const { target, sources } = mergeCandidate;
        const sourceNames = sources.map(c => c.name).join('", "');

        const promptText = `Notei que aprendi sobre "${target.name}" e "${sourceNames}" separadamente, mas parecem ser a mesma coisa. Posso unificar meu conhecimento sobre eles?`;
        
        addMessage({
            role: 'model',
            text: promptText,
            type: 'concept_consolidation_prompt',
            consolidationOptions: {
                targetConceptName: target.name,
                sourceConceptNames: sources.map(c => c.name)
            }
        });
    }
  }
  
  async function startCognitiveLoops() {
    startCuriosityLoop().catch(console.error);
    if (consolidationTimer) window.clearInterval(consolidationTimer);
    consolidationTimer = window.setInterval(() => {
        reviewAndConsolidateConcepts().catch(console.error);
    }, 60_000);
  }

  startCognitiveLoops();

  function touchHeartbeat() {
    lastInteractionAt = Date.now();
  }

  async function performConceptMerge(options: { targetConceptName: string, sourceConceptNames: string[] }) {
    touchHeartbeat();
    setStatus(AssistantStatus.THINKING);
    try {
        await db.mergeConcepts(options.targetConceptName, options.sourceConceptNames);
        const confirmationText = `Entendido. Unifiquei meu conhecimento sobre "${options.targetConceptName}". Agradeço a ajuda!`;
        addMessage({ role: 'model', text: confirmationText });
        speak(confirmationText, () => setStatus(AssistantStatus.IDLE));
    } catch (error) {
        console.error("Failed to merge concepts:", error);
        const errorText = "Ocorreu um erro ao tentar unificar os conceitos.";
        addMessage({ role: 'model', text: errorText });
        speak(errorText, () => setStatus(AssistantStatus.IDLE));
        setStatus(AssistantStatus.ERROR);
    }
  }

  async function handleUserTurn(userText: string, history: ChatMessage[], imageUrl?: string) {
    touchHeartbeat();

    const bornJustNow = await ensureBirthOnce(addMessage, speak);
    if (bornJustNow) return;

    const profile = await getUserProfile();
    if (!profile?.name) {
      const maybeName = userText.trim();
      if (maybeName && maybeName.split(' ').length <= 4 && /^[\p{L}\s.'-]+$/u.test(maybeName)) {
        await setUserProfile({ name: maybeName });
        const greetOptions = [ `Prazer em te conhecer, ${maybeName}!`, `Legal te conhecer, ${maybeName}.`, `Perfeito, ${maybeName}!`, ];
        const greet = `${greetOptions[Math.floor(Math.random() * greetOptions.length)]} O que você quer fazer primeiro?`;
        addMessage({ role: 'model', text: greet, type: 'message' });
        speak(greet);
        return;
      } else if (userText) {
        const askName = 'Ainda não sei seu nome. Como posso te chamar?';
        addMessage({ role: 'model', text: askName, type: 'message' });
        speak(askName);
        return;
      }
    }

    if (imageUrl) {
        setStatus(AssistantStatus.THINKING);
        const visionPrompt = `O usuário enviou uma imagem. Descreva o que você vê ou responda à pergunta dele. Pergunta: "${userText || 'O que é isso?'}"`;
        const { text } = await generateVisionResponse(visionPrompt, imageUrl);
        const finalText = text?.trim() || 'Não consegui interpretar a imagem. Podemos tentar outra?';

        addMessage({ role: 'model', text: finalText, type: 'message' });
        speak(finalText, () => setStatus(AssistantStatus.IDLE));
        await updateUserMemory(userText, finalText);
        return;
    }

    setStatus(AssistantStatus.THINKING);
    const context = await buildContextPrompt(userText);
    const { text, sources } = await generateResponse(context, [
      ...history,
      { role: 'user', text: userText, type: 'message' },
    ]);

    const finalText =
      text?.trim() ||
      'Eu processei sua mensagem, mas ainda estou organizando meus pensamentos. Pode me dizer mais um detalhe?';

    addMessage({ role: 'model', text: finalText, type: 'message', sources });
    speak(finalText, () => setStatus(AssistantStatus.IDLE));

    await updateUserMemory(userText, finalText);
    await ensureDailyReflection();
  }

  function dispose() {
    if (curiosityTimer) window.clearInterval(curiosityTimer);
    if (consolidationTimer) window.clearInterval(consolidationTimer);
  }

  return {
    handleUserTurn,
    ensureDailyReflection,
    touchHeartbeat,
    dispose,
    performConceptMerge,
  };
}
