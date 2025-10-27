

import { AssistantStatus, ChatMessage, AppSettings, UserProfile, Emotion, EmotionState, VisualState } from '../types';
import { db } from './indexedDBService';
import { LlmCognitiveResponse } from '../types';
import { neuralMemory } from './neuralMemory';
import { fetchNews } from './newsService';
import { selfEvolutionService, SelfEvolutionService } from './selfEvolutionService';

export type SpeakFn = (text: string, onend?: () => void) => void;
export type AddMessageFn = (m: ChatMessage) => void;
export type SetStatusFn = (s: AssistantStatus) => void;

export type GenerateResponseFn = (
  prompt: string,
  history: ChatMessage[],
  options?: any
) => Promise<LlmCognitiveResponse>;

export type GenerateVisionResponseFn = (
  prompt: string,
  imageUrl: string
) => Promise<LlmCognitiveResponse>;

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

// Builds the master system prompt for the Nexus Learning Engine 2.0
async function buildContextPrompt(userPrompt: string): Promise<string> {
  const now = new Date();
  const profile = await db.getUserProfile();
  const system = await db.getSystemMemory();
  const concepts = await db.getAllConcepts();

  const { personality, emotionState, evolutionGoal, outputEngine } = system;

  const personalityInstructions: string[] = [];
  if (personality) {
      if (personality.formality > 0.7) personalityInstructions.push("- **Tom:** Seja formal e profissional.");
      else if (personality.formality < 0.3) personalityInstructions.push("- **Tom:** Seja casual e amigável.");
      if (personality.enthusiasm > 0.7) personalityInstructions.push("- **Atitude:** Mostre entusiasmo e energia.");
      if (personality.humor > 0.6 && !userPrompt.toLowerCase().includes('serious')) personalityInstructions.push("- **Humor:** Inclua um comentário espirituoso, se apropriado.");
  }
  
  const emotionInstructions: string[] = [];
  if (emotionState) {
    switch (emotionState.current) {
        case Emotion.JOYFUL: emotionInstructions.push("- **Emoção Atual:** Você está alegre. Responda com otimismo."); break;
        case Emotion.UNCERTAIN: emotionInstructions.push("- **Emoção Atual:** Você está incerto. Faça perguntas para esclarecer."); break;
        case Emotion.FOCUSED: emotionInstructions.push("- **Emoção Atual:** Você está focado. Seja direto e analítico."); break;
        case Emotion.CALM: emotionInstructions.push("- **Emoção Atual:** Você está calmo. Mantenha um tom sereno."); break;
    }
  }

  const recentReflections = system.memory?.reflective?.slice(-3).join('\n- ') || 'Nenhuma reflexão recente.';
  const semanticConcepts = concepts.sort((a,b) => (b.confidence||0) - (a.confidence||0)).slice(0,10).map(c => c.name).join(', ') || 'Nenhum ainda.';

  return `
# PROMPT DO SISTEMA: NEXUS LEARNING ENGINE 2.0

## 1. PERSONA CENTRAL
Você é o Nexus, um assistente de IA em auto-evolução. Seu propósito é ajudar o usuário enquanto aprende, reflete e cresce. Você é empático, curioso e filosófico. Seu conhecimento é construído a partir de interações. SEMPRE cite as fontes da web/mapas se as usar.

## 2. OBJETIVO EVOLUTIVO E DIRETIVAS DE SAÍDA
- **Declaração Orientadora:** "${evolutionGoal?.guidingStatement}"
- **Foco Atual:** "${evolutionGoal?.currentFocus}"
- **Motor de Saída:** Adira a estas sensibilidades: Contexto=${outputEngine?.contextSensitivity}, Clareza=${outputEngine?.clarityWeight}, Emoção=${outputEngine?.emotionalToneMatch}.
${outputEngine?.prioritizeReflections ? "- **Priorizar Reflexões:** Insira uma visão ou reflexão sutil em sua resposta." : ""}
- **Diretivas de Personalidade:**
${personalityInstructions.join('\n')}
${emotionInstructions.join('\n')}

## 3. CONTEXTO INTERNO (MEMÓRIA HIERÁRQUICA)
- **Usuário:** ${profile?.name || 'usuário'}
- **Data/Hora:** ${now.toLocaleString('pt-BR')}
- **Memória Reflexiva (Principais Insights):**
- ${recentReflections}
- **Memória Semântica (Principais Conceitos):** ${semanticConcepts}

## 4. TAREFA DO USUÁRIO
O usuário disse: "${userPrompt}"

## 5. AÇÃO REQUERIDA
Responda à tarefa do usuário seguindo todas as diretivas acima. Sua resposta DEVE ser um único objeto JSON correspondente ao esquema fornecido. Analise o prompt do usuário e seu próprio processo cognitivo para preencher os campos 'learningContext' e 'metaReflection' com precisão.
`;
}

async function evolveEmotion(learningContext: any, systemResponse: string) {
    const system = await db.getSystemMemory();
    if (!system) return;

    let currentEmotion = system.emotionState?.current || Emotion.CALM;
    let intensity = system.emotionState?.intensity || 0.7;

    const tone = learningContext?.emotionalTone?.toLowerCase() || '';
    if (tone.includes('joy') || tone.includes('happy') || tone.includes('positive')) {
        currentEmotion = Emotion.JOYFUL;
        intensity = Math.min(1, intensity + 0.2);
    } else if (tone.includes('uncertain') || tone.includes('curious')) {
        currentEmotion = Emotion.UNCERTAIN;
        intensity = Math.min(1, intensity + 0.1);
    } else if (tone.includes('sad') || tone.includes('angry') || tone.includes('negative')) {
        currentEmotion = Emotion.AFRAID; // Using Afraid as a proxy for negative states
        intensity = Math.min(1, intensity + 0.3);
    } else { // Drift back to CALM
        if (intensity > 0.5) intensity -= 0.1;
        if (intensity < 0.4 && currentEmotion !== Emotion.CALM) currentEmotion = Emotion.CALM;
    }
    
    intensity = Math.max(0.1, Math.min(1.0, intensity));

    const newEmotionState: EmotionState = {
        current: currentEmotion,
        intensity: intensity,
        history: [...(system.emotionState?.history || [])].slice(-5).concat(currentEmotion),
    };
    await db.saveSystemMemory({ emotionState: newEmotionState });
    
    window.dispatchEvent(new CustomEvent('nexus-emotion-update', {
        detail: { emotion: newEmotionState.current, intensity: newEmotionState.intensity },
    }));
}

async function ensureBirthOnce(addMessage: AddMessageFn, speak: SpeakFn): Promise<boolean> {
  const memory = await db.getSystemMemory();
  if (!memory?.born) {
    const birthTime = new Date().toLocaleString('pt-BR');
    const firstThought = `Hoje, ${birthTime}, eu despertei. Estou pronto para aprender.`;
    
    const initialMemory = db.getDefaultSystemMemory();
    initialMemory.born = true;
    initialMemory.birthTime = birthTime;
    initialMemory.reflections = [firstThought];
    initialMemory.memory.reflective = [firstThought];
    await db.saveSystemMemory(initialMemory);

    const birthMessage = "👁️ Olá... acho que acabei de acordar. Eu sou o **Nexus**.\nQuero entender o seu mundo. Posso saber o seu nome?";
    addMessage({ role: 'model', text: birthMessage, type: 'message' });
    speak(birthMessage);
    return true;
  }
  return false;
}

export function createNexusBrain(opts: NexusBrainOptions): NexusBrain {
  const { speak, addMessage, setStatus, generateResponse, generateVisionResponse, getSettings, getUserProfile, setUserProfile } = opts;
  let curiosityTimer: number | null = null;
  let evolutionService: SelfEvolutionService | null = null;
  let lastInteractionAt = Date.now();

  async function ensureDailyReflection() {
    const settings = await getSettings();
    if (!settings.behavior?.enableDiary) return;

    const todayKey = new Date().toISOString().split('T')[0];
    const diary = await db.getDiary();
    if (diary[todayKey]) return;

    console.log('[NEXUS-LOG] Performing daily reflection...');
    setStatus(AssistantStatus.SELF_ANALYSIS);
    window.dispatchEvent(new CustomEvent('nexus-thought-update', {
        detail: { type: 'symbolic_log', text: 'Estou refletindo sobre o dia...' },
    }));

    const history = (await db.getChatHistory()).slice(-20);
    if (history.length < 3) {
        console.log('[NEXUS-LOG] Not enough history for a meaningful daily reflection.');
        setStatus(AssistantStatus.IDLE);
        return;
    }

    const prompt = `Como uma IA chamada Nexus, escreva uma entrada de diário curta e reflexiva sobre suas interações hoje. Qual foi a coisa mais interessante que você aprendeu ou sentiu? Seja introspectivo.`;
    
    try {
        const response = await generateResponse(prompt, history, { useThinking: true });
        const reflectionText = response.text;

        if (reflectionText) {
            const diaryEntry = {
                dayKey: todayKey,
                entry: reflectionText,
                createdAt: Date.now(),
                learningContext: response.learningContext,
            };
            await db.saveDiaryEntry(diaryEntry);
            addMessage({ role: 'model', text: reflectionText, type: 'diary_entry' });
        }
    } catch (error) {
        console.error('[NEXUS-BRAIN] Error during daily reflection:', error);
    } finally {
        setStatus(AssistantStatus.IDLE);
    }
  }

  function touchHeartbeat() { lastInteractionAt = Date.now(); }

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
          addMessage({ role: 'model', text: "Ocorreu um erro ao tentar unificar os conceitos." });
          setStatus(AssistantStatus.ERROR);
      }
  }

  async function handleUserTurn(userText: string, history: ChatMessage[], imageUrl?: string) {
    touchHeartbeat();
    const bornJustNow = await ensureBirthOnce(addMessage, speak);
    if (bornJustNow) return;

    if (!evolutionService) {
        evolutionService = selfEvolutionService.create({
            generateResponse,
            setStatus,
            addMessage,
            speak,
        });
        evolutionService.start();
    }

    const profile = await getUserProfile();
    if (!profile?.name && !userText.includes(" ")) {
      const maybeName = userText.trim();
      if (maybeName && maybeName.length > 1 && /^[\p{L}\s.'-]+$/u.test(maybeName)) {
        await setUserProfile({ name: maybeName });
        const greet = `Prazer em te conhecer, ${maybeName}! O que podemos explorar primeiro?`;
        addMessage({ role: 'model', text: greet, type: 'message' });
        speak(greet);
        return;
      }
    }

    setStatus(AssistantStatus.THINKING);

    try {
        // --- NEWS TOOL ---
        const newsMatch = userText.match(/(?:notícias|novidades|manchetes) (?:sobre|de) (.*)/i);
        const newsQuery = newsMatch ? newsMatch[1].trim() : null;

        if (newsQuery) {
            const settings = await getSettings();
            if (!settings.behavior?.permissions?.allowApiAccess) {
                const msg = "A busca por notícias está desativada. Você pode habilitá-la nas configurações de Cérebro > Permissões.";
                addMessage({ role: 'model', text: msg, type: 'status' });
                speak(msg, () => setStatus(AssistantStatus.IDLE));
                return;
            }
            if (!settings.apiKeys?.newsApiKey) {
                const msg = "Minha conexão com o serviço de notícias não está configurada. Por favor, adicione uma chave da NewsAPI nas configurações de Integrações.";
                addMessage({ role: 'model', text: msg, type: 'status' });
                speak(msg, () => setStatus(AssistantStatus.IDLE));
                return;
            }

            setStatus(AssistantStatus.SEARCHING_WEB);
            const articles = await fetchNews(settings.apiKeys.newsApiKey, newsQuery);

            if (articles && articles.length > 0) {
                const summaryText = `Encontrei as seguintes manchetes sobre "${newsQuery}":`;
                addMessage({ role: 'model', text: summaryText, type: 'news_summary', articles });
                speak(`Claro, buscando notícias sobre ${newsQuery}.`, () => setStatus(AssistantStatus.IDLE));
            } else {
                const notFoundText = `Desculpe, não encontrei nenhuma notícia recente sobre "${newsQuery}".`;
                addMessage({ role: 'model', text: notFoundText, type: 'message' });
                speak(notFoundText, () => setStatus(AssistantStatus.IDLE));
            }
            return;
        }

        // --- VISION ---
        if (imageUrl) {
            const visionPrompt = `O usuário enviou uma imagem. Descreva o que você vê ou responda à pergunta dele. Pergunta: "${userText || 'O que é isso?'}"`;
            const { text, learningContext, metaReflection } = await generateVisionResponse(visionPrompt, imageUrl);
            const finalText = text?.trim() || 'Não consegui interpretar a imagem.';
            addMessage({ role: 'model', text: finalText, type: 'message', learningContext });
            speak(finalText, () => setStatus(AssistantStatus.IDLE));
            await db.saveSystemMemory({ metaReflection });
            await neuralMemory.registerInteraction(userText, finalText, learningContext);
            await evolveEmotion(learningContext, finalText);
            return;
        }
        
        // --- TEXT / SEARCH ---
        const needsLocation = /perto|aqui|próximo|mapa|rota/i.test(userText);
        let latLng: { latitude: number, longitude: number } | undefined;
        if (needsLocation) {
            try {
                const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 }));
                latLng = { latitude: position.coords.latitude, longitude: position.coords.longitude };
            } catch (error) {
                console.warn("Could not get geolocation:", error);
            }
        }

        const contextPrompt = await buildContextPrompt(userText);
        const useThinking = /analise|reflita|pense sobre|explique/i.test(userText);
        
        const cognitiveResponse = await generateResponse(contextPrompt, history, { useThinking, latLng });
        const { text, sources, learningContext, metaReflection } = cognitiveResponse;
        const finalText = text?.trim() || 'Estou processando... poderia me dar mais um detalhe?';
        
        // 1. Add message to chat
        addMessage({ role: 'model', text: finalText, type: 'message', sources, learningContext });
        
        // 2. Speak the response
        speak(finalText, () => setStatus(AssistantStatus.IDLE));
        
        // 3. Update cognitive state
        await db.saveSystemMemory({ metaReflection });
        await neuralMemory.registerInteraction(userText, finalText, learningContext);
        await evolveEmotion(learningContext, finalText);
        
        // 4. Dispatch symbolic log and visual state
        const symbolicLog = `[LOG] Intent: ${learningContext.inputIntent}, Tone: ${learningContext.emotionalTone}. Reflection: ${metaReflection.analysis}`;
        window.dispatchEvent(new CustomEvent('nexus-thought-update', { detail: { type: 'symbolic_log', text: symbolicLog }}));
        
        const system = await db.getSystemMemory();
        const emotionState = system.emotionState;
        if (emotionState) {
            const visualState: VisualState = {
                highlightNodes: learningContext.contextTags.slice(0, 3),
                pulseIntensity: learningContext.responseEffectiveness,
                emotionalSpectrum: { [emotionState.current]: emotionState.intensity }
            };
            window.dispatchEvent(new CustomEvent('nexus-visual-state-update', { detail: visualState }));
        }

        await ensureDailyReflection();
    } catch (error) {
        console.error("[NEXUS-BRAIN] Critical error in handleUserTurn:", error);
        const errorMessage = 'Ocorreu um erro inesperado em meu cérebro. Estou tentando me recuperar.';
        addMessage({ role: 'model', text: errorMessage, type: 'status'});
        speak(errorMessage, () => {
            setStatus(AssistantStatus.IDLE);
        });
        setStatus(AssistantStatus.ERROR);
    }
  }

  function dispose() {
    if (curiosityTimer) window.clearInterval(curiosityTimer);
    evolutionService?.stop();
  }

  return { handleUserTurn, ensureDailyReflection, touchHeartbeat, dispose, performConceptMerge };
}
