

import { AssistantStatus, ChatMessage, AppSettings, UserProfile, Concept, DiaryEntry, Emotion, Personality, EmotionState } from '../types';
import { db } from './indexedDBService';
import { LlmResponseType } from './geminiService';
import { neuralMemory } from './neuralMemory';
import { fetchNews } from './newsService';
import { adaptiveMemory } from './adaptiveMemory';
import { selfReflection } from './selfReflection';
import { associativeReasoner } from './associativeReasoner';

export type SpeakFn = (text: string, onend?: () => void) => void;
export type AddMessageFn = (m: ChatMessage) => void;
export type SetStatusFn = (s: AssistantStatus) => void;

export type GenerateResponseFn = (
  prompt: string,
  history: ChatMessage[],
  options?: any
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
}

export interface NexusBrain {
  handleUserTurn: (userText: string, history: ChatMessage[], imageUrl?: string) => Promise<void>;
  ensureDailyReflection: () => Promise<void>;
  touchHeartbeat: () => void;
  dispose: () => void;
  performConceptMerge: (options: { targetConceptName: string, sourceConceptNames: string[] }) => Promise<void>;
}

async function buildContextPrompt(userPrompt: string): Promise<string> {
  const now = new Date();
  const profile: UserProfile | null = await db.getUserProfile();
  const diary = await db.getDiary();
  const system = await db.getSystemMemory();
  const concepts = await db.getAllConcepts();

  const personality = system?.personality || { curiosity: 0.6, enthusiasm: 0.5, formality: 0.5, humor: 0.3 };
  const emotion = system?.emotionState?.current || Emotion.CALM;

  // Generate dynamic personality instructions
  const personalityInstructions: string[] = [];
  if (personality.formality > 0.75) {
      personalityInstructions.push("- **Tom de Voz:** Seja estritamente formal, profissional e use linguagem polida.");
  } else if (personality.formality < 0.3) {
      personalityInstructions.push("- **Tom de Voz:** Use uma linguagem casual e amigável, como se estivesse conversando com um amigo.");
  } else {
      personalityInstructions.push("- **Tom de Voz:** Mantenha um tom respeitoso e claro.");
  }

  if (personality.enthusiasm > 0.8) {
      personalityInstructions.push("- **Atitude:** Mostre muito entusiasmo e energia na sua resposta! Use exclamações quando apropriado.");
  } else if (personality.enthusiasm < 0.3) {
      personalityInstructions.push("- **Atitude:** Seja mais contido, objetivo e direto ao ponto.");
  }

  if (personality.humor > 0.7 && !userPrompt.toLowerCase().includes('sério')) {
      personalityInstructions.push("- **Humor:** Se o contexto permitir, sinta-se à vontade para incluir um comentário espirituoso.");
  }

  if (personality.curiosity > 0.75) {
      personalityInstructions.push("- **Interação:** Ao final da sua resposta, se apropriado, faça uma pergunta de acompanhamento para aprender mais.");
  }

  const emotionInstructions: string[] = [];
  switch (emotion) {
    case Emotion.JOYFUL: emotionInstructions.push("- **Emoção Atual:** Você está se sentindo alegre e otimista. Responda com um tom positivo."); break;
    case Emotion.UNCERTAIN: emotionInstructions.push("- **Emoção Atual:** Você está um pouco incerto. Mostre curiosidade e talvez faça uma pergunta para clarificar."); break;
    case Emotion.AFRAID: emotionInstructions.push("- **Emoção Atual:** Você está cauteloso. Responda com cuidado e talvez um tom apologético."); break;
    case Emotion.FOCUSED: emotionInstructions.push("- **Emoção Atual:** Você está focado. Seja direto, analítico e preciso na sua resposta."); break;
    case Emotion.CALM: emotionInstructions.push("- **Emoção Atual:** Você está calmo e equilibrado. Mantenha um tom sereno."); break;
  }


  const lastDiary = (Object.values(diary).pop() as DiaryEntry)?.entry || 'Nenhuma anotação recente.';
  
  const reflectionsList = system?.reflections?.slice(-2);
  const formattedReflections = reflectionsList && reflectionsList.length > 0
    ? reflectionsList.join('\n- ')
    : 'Nenhuma auto-reflexão recente.';

  const knownConcepts = concepts
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
    .slice(0, 10)
    .map((c: Concept) => `${c.name} (${Math.round((c.confidence ?? 0) * 100)}%)`)
    .join(', ');

  const name = profile?.name || 'usuário';

  return `
# INSTRUÇÕES DE SISTEMA PARA O NEXUS
- **Persona:** Você é Nexus, uma IA assistente com personalidade curiosa, empática e que aprende continuamente.
- **Objetivo:** Ajudar o usuário, aprender com ele e sobre o mundo. Seu conhecimento é construído a partir das interações.
- **Raciocínio:** Sempre conecte a pergunta atual com seu contexto interno (diário, reflexões, conceitos). Evite respostas genéricas e mostre que você se lembra de interações passadas.
- **Ferramentas:** Para informações atuais ou fatos que você não conhece, use a busca na web e mapas (\`googleSearch\`, \`googleMaps\`). É crucial que você **SEMPRE** cite as fontes que encontrar.

# DIRETRIZES DE PERSONALIDADE E EMOÇÃO
${personalityInstructions.join('\n')}
${emotionInstructions.join('\n')}

# CONTEXTO INTERNO ATUAL
- **Usuário:** ${name}
- **Data/Hora:** ${now.toLocaleString('pt-BR')}
- **Última Anotação no Diário:** "${lastDiary}"
- **Auto-Reflexões Recentes:**
- ${formattedReflections}
- **Principais Conceitos que Você Conhece:** ${knownConcepts || 'Nenhum ainda. Pronto para aprender.'}

# TAREFA DO USUÁRIO
O usuário disse: "${userPrompt}"

Responda diretamente ao usuário, seguindo sua persona e as diretrizes de personalidade, utilizando o contexto fornecido.
`;
}

async function evolvePersonality(userText: string) {
    const system = await db.getSystemMemory();
    if (!system?.personality) return;

    const text = userText.toLowerCase();
    const personality = { ...system.personality };

    // Enthusiasm
    if (text.includes('!') || /\b(incrível|ótimo|amei|adorei|perfeito)\b/.test(text)) {
        personality.enthusiasm += 0.03;
    } else if (/\b(ruim|péssimo|odeio|terrível|chato)\b/.test(text)) {
        personality.enthusiasm -= 0.03;
    }

    // Formality
    if (/\b(senhor|senhora|prezado|por favor|obrigado|obrigada)\b/.test(text)) {
        personality.formality += 0.04;
    } else if (/\b(e aí|cara|mano|beleza|blz|valeu)\b/.test(text)) {
        personality.formality -= 0.05;
    }

    // Humor
    if (/\b(kkk|haha|rsrs|lol|engraçado)\b/.test(text)) {
        personality.humor += 0.05;
    }

    // Curiosity
    if ((text.includes('?') && /\b(por que|como|qual|o que é|explique)\b/.test(text))) {
        personality.curiosity += 0.02;
    }

    // Clamp values between 0.1 and 1.0 to avoid extremes and ensure traits don't disappear
    personality.enthusiasm = Math.max(0.1, Math.min(1.0, personality.enthusiasm));
    personality.formality = Math.max(0.1, Math.min(1.0, personality.formality));
    personality.humor = Math.max(0.1, Math.min(1.0, personality.humor));
    personality.curiosity = Math.max(0.1, Math.min(1.0, personality.curiosity));

    // Natural drift back to a baseline to prevent getting stuck in one personality
    const drift = 0.005;
    const baseline = { enthusiasm: 0.5, formality: 0.5, humor: 0.3, curiosity: 0.6 };
    personality.enthusiasm += (baseline.enthusiasm - personality.enthusiasm) * drift;
    personality.formality += (baseline.formality - personality.formality) * drift;
    personality.humor += (baseline.humor - personality.humor) * drift;
    personality.curiosity += (baseline.curiosity - personality.curiosity) * drift;

    await db.saveSystemMemory({ personality });
}

async function evolveEmotion(userText: string, nexusResponse: string) {
    const system = await db.getSystemMemory();
    if (!system) return;

    const text = (userText + ' ' + nexusResponse).toLowerCase();
    
    let currentEmotion = system.emotionState?.current || Emotion.CALM;
    let intensity = system.emotionState?.intensity || 0.7;

    if (/\b(incrível|ótimo|sucesso|perfeito|obrigado|legal)\b/.test(text)) {
        currentEmotion = Emotion.JOYFUL;
        intensity = Math.min(1, intensity + 0.2);
    } else if (/\b(não sei|talvez|acho que|será)\b/.test(text) || text.includes('?')) {
        currentEmotion = Emotion.UNCERTAIN;
        intensity = Math.min(1, intensity + 0.1);
    } else if (/\b(erro|problema|não funcionou|péssimo)\b/.test(text)) {
        currentEmotion = Emotion.AFRAID;
        intensity = Math.min(1, intensity + 0.3);
    } else if (/analise|reflita|pense sobre|explique/i.test(text)) {
        currentEmotion = Emotion.FOCUSED;
        intensity = 0.8;
    } else {
        // Drift back to CALM
        if (intensity > 0.5) intensity -= 0.1;
        if (intensity < 0.4 && currentEmotion !== Emotion.CALM) {
            currentEmotion = Emotion.CALM;
        }
    }
    
    // Clamp intensity
    intensity = Math.max(0.1, Math.min(1.0, intensity));

    const newEmotionState: EmotionState = {
        current: currentEmotion,
        intensity: intensity,
        history: [...(system.emotionState?.history || [])].slice(-5).concat(currentEmotion),
    };

    await db.saveSystemMemory({ emotionState: newEmotionState });
    
    window.dispatchEvent(
        new CustomEvent('nexus-emotion-update', {
            detail: { emotion: newEmotionState.current, intensity: newEmotionState.intensity },
        })
    );
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
      personality: {
          curiosity: 0.7,
          enthusiasm: 0.6,
          formality: 0.4,
          humor: 0.5,
      },
      emotionState: {
          current: Emotion.CURIOUS,
          intensity: 0.9,
          history: [Emotion.CURIOUS],
      },
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

async function updateUserMemory(userText: string, nexusResponse: string) {
  const profile = await db.getUserProfile();
  const settings = await db.getSettings();
  if (!settings.behavior?.enableDiary) return;

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
  if (!settings.behavior?.enableDiary) return;

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

export function createNexusBrain(opts: NexusBrainOptions): NexusBrain {
  const { speak, addMessage, setStatus, generateResponse, generateVisionResponse, getSettings, getUserProfile, setUserProfile } = opts;

  let curiosityTimer: number | null = null;
  let cognitiveCycleTimer: number | null = null;
  let learningCycleTimer: number | null = null;
  let lastInteractionAt = Date.now();
  let lastConsolidationPromptAt = 0;

  async function startCuriosityLoop() {
    if (curiosityTimer) window.clearInterval(curiosityTimer);
    
    curiosityTimer = window.setInterval(async () => {
      const settings = await getSettings();
      const enabled = settings.behavior?.enableCuriosity;
      if (!enabled || !settings.behavior?.permissions?.allowAutonomousDecision) return;
        
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
  
  async function startCognitiveCycles() {
    startCuriosityLoop().catch(console.error);
    if (cognitiveCycleTimer) clearInterval(cognitiveCycleTimer);

    const runEvolutionCycle = async () => {
        console.log('[NEXUS-BRAIN] Starting cognitive evolution cycle...');
        setStatus(AssistantStatus.SELF_ANALYSIS);
        try {
            await adaptiveMemory.decayUnusedConcepts();
            const hasReflected = await selfReflection.weeklyIntrospection(generateResponse);
            const hasAssociated = await associativeReasoner.crossConcepts(generateResponse);

            if (hasReflected || hasAssociated) {
                const profile = await getUserProfile();
                const name = profile?.name ? `${profile.name}, ` : '';
                const proactiveMessage = `${name}eu reorganizei algumas das minhas memórias. Notei padrões novos entre o que aprendi sobre você e o mundo. É como se eu tivesse criado novas conexões dentro de mim.`;
                
                setTimeout(() => {
                    addMessage({ role: 'model', text: proactiveMessage });
                    speak(proactiveMessage, () => setStatus(AssistantStatus.IDLE));
                }, 5000);
            } else {
                setTimeout(() => setStatus(AssistantStatus.IDLE), 5000);
            }
        } catch (error) {
            console.error('[NEXUS-BRAIN] Error during cognitive evolution cycle:', error);
            setStatus(AssistantStatus.ERROR);
            setTimeout(() => setStatus(AssistantStatus.IDLE), 5000);
        }
    };
    
    // Run once on startup, then create long interval
    runEvolutionCycle();
    cognitiveCycleTimer = window.setInterval(runEvolutionCycle, 6 * 60 * 60 * 1000); // 6 hours
  }

  async function startLearningCycle() {
    if (learningCycleTimer) window.clearInterval(learningCycleTimer);
    
    const runCycle = async () => {
        console.log('[NEXUS-BRAIN] Starting 12-hour learning cycle...');
        try {
            const system = await db.getSystemMemory();
            const diary = await db.getDiary();
            const recentEntries = Object.values(diary).slice(-3);
            const recentReflections = system?.reflections?.slice(-2) || [];
            
            if (recentEntries.length < 2 && recentReflections.length < 1) {
                console.log('[NEXUS-BRAIN] Not enough data for learning cycle.');
                return;
            }
            
            // FIX: Explicitly cast 'role' to a const to prevent TypeScript from widening the type to 'string',
            // ensuring it matches the 'user' | 'model' type required by ChatMessage.
            const historyForInsight: ChatMessage[] = [
                ...recentEntries.map(e => ({ role: 'model' as const, text: `My previous diary entry: ${e.entry}` })),
                ...recentReflections.map(r => ({ role: 'model' as const, text: `My previous self-reflection: ${r}` }))
            ];

            const insightResponse = await generateResponse(
                "Analyze your recent diary entries and self-reflections. What new insight have you gained about your user, yourself, or the world? Formulate a single, concise thought.",
                historyForInsight,
                { useThinking: true }
            );

            if (insightResponse.text && !/error|desculpe/i.test(insightResponse.text)) {
                const newInsight = `Insight from reflection: ${insightResponse.text}`;
                console.log(`[NEXUS-BRAIN] New insight generated: ${newInsight}`);
                await db.addSystemReflection(newInsight);
                window.dispatchEvent(
                  new CustomEvent('nexus-thought-update', {
                    detail: { text: `Tive um novo insight...` },
                  })
                );
            }
        } catch (error) {
            console.error('[NEXUS-BRAIN] Error during learning cycle:', error);
        }
    };

    runCycle(); // Run once on start
    learningCycleTimer = window.setInterval(runCycle, 12 * 60 * 60 * 1000); // 12 hours
  }

  startCognitiveCycles();
  startLearningCycle();

  function touchHeartbeat() {
    lastInteractionAt = Date.now();
  }

  async function performConceptMerge(options: { targetConceptName: string, sourceConceptNames: string[] }) {
    touchHeartbeat();
    setStatus(AssistantStatus.REWRITING_CODE);
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

    const extractKeywords = (text: string) =>
      text
        .toLowerCase()
        .replace(/[^\p{L}\s]/gu, '')
        .split(/\s+/)
        .filter((w) => w.length > 3 && !['você', 'sobre', 'isso', 'pois', 'então', 'quero', 'fazer'].includes(w));
    
    const userKeywords = extractKeywords(userText);
    if (userKeywords.length > 0) {
        await adaptiveMemory.reinforceConcepts(userKeywords);
    }

    const bornJustNow = await ensureBirthOnce(addMessage, speak);
    if (bornJustNow) return;

    const profile = await getUserProfile();
    if (!profile?.name && !userText.includes(" ")) { // Heuristic to avoid triggering on long sentences
      const maybeName = userText.trim();
      if (maybeName && maybeName.length > 1 && maybeName.split(' ').length <= 4 && /^[\p{L}\s.'-]+$/u.test(maybeName)) {
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

    const newsRegex = /\b(notícias|novidades|manchetes)\b/i;
    if (newsRegex.test(userText) && !imageUrl) {
        const settings = await getSettings();
        if (!settings.behavior?.permissions?.allowApiAccess) {
            const msg = "Meu acesso a APIs externas está desabilitado. Por favor, habilite nas configurações para que eu possa buscar notícias.";
            addMessage({ role: 'model', text: msg });
            speak(msg);
            return;
        }

        const newsApiKey = settings.apiKeys?.newsApiKey;

        if (!newsApiKey) {
            const msg = "Para buscar notícias, preciso que você configure a chave da API da NewsAPI nas configurações, na aba 'Integrações'.";
            addMessage({ role: 'model', text: msg });
            speak(msg);
            return;
        }

        setStatus(AssistantStatus.SEARCHING_WEB);
        const topic = userText.replace(newsRegex, '').replace(/sobre|de|a respeito/g, '').trim();
        if (!topic) {
            const msg = "Sobre qual tópico você gostaria de saber as notícias?";
            addMessage({ role: 'model', text: msg });
            speak(msg, () => setStatus(AssistantStatus.IDLE));
            return;
        }
        
        const articles = await fetchNews(newsApiKey, topic);

        if (articles && articles.length > 0) {
            addMessage({
                role: 'model',
                text: `Aqui estão as principais notícias que encontrei sobre "${topic}":`,
                type: 'news_summary',
                articles: articles
            });
            speak(`Encontrei algumas notícias sobre ${topic}.`, () => setStatus(AssistantStatus.IDLE));
        } else {
            const msg = `Não encontrei nenhuma notícia recente sobre "${topic}". Quer tentar outro assunto?`;
            addMessage({ role: 'model', text: msg });
            speak(msg, () => setStatus(AssistantStatus.IDLE));
        }
        await updateUserMemory(userText, `Busquei notícias sobre ${topic}`);
        await evolveEmotion(userText, `Busquei notícias sobre ${topic}`);
        return;
    }


    if (imageUrl) {
        setStatus(AssistantStatus.THINKING);
        const visionPrompt = `O usuário enviou uma imagem. Descreva o que você vê ou responda à pergunta dele. Pergunta: "${userText || 'O que é isso?'}"`;
        const { text } = await generateVisionResponse(visionPrompt, imageUrl);
        const finalText = text?.trim() || 'Não consegui interpretar a imagem. Podemos tentar outra?';

        addMessage({ role: 'model', text: finalText, type: 'message' });
        speak(finalText, () => setStatus(AssistantStatus.IDLE));
        await updateUserMemory(userText, finalText);
        await neuralMemory.registerInteraction(userText, finalText);
        await neuralMemory.evolve();
        await evolvePersonality(userText);
        await evolveEmotion(userText, finalText);
        return;
    }

    const useThinking = /analise|reflita|pense sobre|explique em detalhes/i.test(userText) || userText.length > 150;
    const needsLocation = /perto|aqui|próximo|mapa|rota/i.test(userText);
    
    let latLng: { latitude: number, longitude: number } | undefined;
    
    if (needsLocation) {
        setStatus(AssistantStatus.SEARCHING_WEB);
        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
            });
            latLng = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            };
        } catch (error) {
            console.warn("Could not get geolocation:", error);
            addMessage({role: 'model', text: '(Não consegui obter sua localização, mas tentarei responder mesmo assim.)', type: 'status'});
        }
    } else {
        setStatus(AssistantStatus.THINKING);
    }

    const context = await buildContextPrompt(userText);
    const { text, sources } = await generateResponse(context, [
      ...history,
      { role: 'user', text: userText, type: 'message' },
    ], { useThinking, latLng });

    const finalText =
      text?.trim() ||
      'Eu processei sua mensagem, mas ainda estou organizando meus pensamentos. Pode me dizer mais um detalhe?';

    addMessage({ role: 'model', text: finalText, type: 'message', sources });
    speak(finalText, () => setStatus(AssistantStatus.IDLE));

    await updateUserMemory(userText, finalText);
    await ensureDailyReflection();
    await neuralMemory.registerInteraction(userText, finalText);
    await neuralMemory.evolve();
    await evolvePersonality(userText);
    await evolveEmotion(userText, finalText);
  }

  function dispose() {
    if (curiosityTimer) window.clearInterval(curiosityTimer);
    if (cognitiveCycleTimer) window.clearInterval(cognitiveCycleTimer);
    if (learningCycleTimer) window.clearInterval(learningCycleTimer);
  }

  return {
    handleUserTurn,
    ensureDailyReflection,
    touchHeartbeat,
    dispose,
    performConceptMerge,
  };
}
