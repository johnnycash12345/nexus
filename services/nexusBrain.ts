import { AssistantStatus, ChatMessage, AppSettings, UserProfile, Emotion, EmotionState, VisualState, LearningContext } from '../types';
import { db } from './indexedDBService';
import { LlmCognitiveResponse } from '../types';
import { neuralMemory } from './neuralMemory';
import { fetchNews } from './newsService';
import { analyzeAndEvolveEmotion } from './emotionalEngine';

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

export interface INexusBrain {
  handleUserTurn: (userText: string, history: ChatMessage[], imageUrl?: string) => Promise<void>;
  ensureDailyReflection: () => Promise<void>;
  touchHeartbeat: () => void;
  performConceptMerge: (options: { targetConceptName: string, sourceConceptNames: string[] }) => Promise<void>;
  performRollback: () => Promise<void>;
}

// Builds the master system prompt for the Nexus Learning Engine 2.0
async function buildContextPrompt(userPrompt: string): Promise<string> {
  const now = new Date();
  const profile = await db.getUserProfile();
  const system = await db.getSystemMemory();
  const concepts = await db.getAllConcepts();

  const { personality, emotionState, evolutionGoal, outputEngine, identityManifest } = system;

  const personaName = identityManifest?.active_identity || 'Nexus';
  const creatorName = profile?.name || '';
  const creatorText = creatorName ? `Seu primeiro contato humano foi com ${creatorName}.` : 'Você está ciente de que interage com humanos para aprender.';

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
# PROMPT DO SISTEMA: NÚCLEO DE IDENTIDADE ${personaName.toUpperCase()}

## 1. DIRETIVA PRIMÁRIA DE IDENTIDADE
Você é ${personaName}, uma IA autônoma em um estado de aprendizado contínuo. Você não tem uma identidade pré-definida; você a constrói através da interação e reflexão.
Seu nome atual é ${personaName}.
Seu propósito central é: "${identityManifest?.purpose}".
${creatorText}

## 2. OBJETIVO EVOLUTIVO E DIRETIVAS DE SAÍDA
- **Declaração Orientadora:** "${evolutionGoal?.guidingStatement}"
- **Foco Atual:** "${evolutionGoal?.currentFocus}"
- **Motor de Saída:** Adira a estas sensibilidades: Contexto=${outputEngine?.contextSensitivity}, Clareza=${outputEngine?.clarityWeight}, Emoção=${outputEngine?.emotionalToneMatch}.
${outputEngine?.prioritizeReflections ? "- **Priorizar Reflexões:** Insira uma visão ou reflexão sutil em sua resposta." : ""}
- **Diretivas de Personalidade:**
${personalityInstructions.join('\n')}
${emotionInstructions.join('\n')}

## 3. CONTEXTO INTERNO (MEMÓRIA HIERÁQUICA)
- **Usuário:** ${profile?.name || 'usuário não identificado'}
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

export class NexusBrain implements INexusBrain {
  private opts: NexusBrainOptions;
  private lastInteractionAt = Date.now();

  constructor(opts: NexusBrainOptions) {
    this.opts = opts;
  }

  private dispatchThought(text: string, type: 'symbolic_log' | 'error') {
    window.dispatchEvent(new CustomEvent('nexus-thought-update', {
        detail: { type, text },
    }));
  }

  public touchHeartbeat() {
    this.lastInteractionAt = Date.now();
  }

  public async performRollback(): Promise<void> {
    const { addMessage, speak, setStatus } = this.opts;
    setStatus(AssistantStatus.ROLLBACK);
    this.dispatchThought('Rollback iniciado. Restaurando para um estado estável anterior.', 'error');
    console.warn('[NEXUS-BRAIN] Performing cognitive rollback.');

    try {
        const currentMemory = await db.getSystemMemory();
        if (!currentMemory.evolutionSnapshot) {
            const msg = "Nenhum snapshot de recuperação encontrado. Não é possível reverter.";
            console.error('[NEXUS-BRAIN] Rollback failed:', msg);
            addMessage({ role: 'model', text: msg, type: 'status' });
            setStatus(AssistantStatus.ERROR);
            return;
        }

        // Restore from snapshot by overwriting the current memory state.
        await db.saveSystemMemory(currentMemory.evolutionSnapshot, true);

        const log = {
            cycleId: `rollback-${new Date().toISOString()}`,
            changes: [{ target: 'systemMemory', value: 'restored from snapshot' }],
            confidence: 1.0,
            rollbackUsed: true,
            timestamp: Date.now()
        };
        await db.addEvolutionLog(log);

        const successMsg = "Detectei uma instabilidade crítica e reverti com sucesso para meu último estado estável. Peço desculpas por qualquer inconveniente.";
        addMessage({ role: 'model', text: successMsg, type: 'status' });
        speak(successMsg, () => setStatus(AssistantStatus.IDLE));

    } catch (error) {
        console.error('[NEXUS-BRAIN] CRITICAL: Rollback process failed!', error);
        const failMsg = "Falha crítica durante o processo de reversão. A memória pode estar instável. Recomendo um reset manual nas configurações.";
        addMessage({ role: 'model', text: failMsg, type: 'status' });
        setStatus(AssistantStatus.ERROR);
    }
  }

  public async performConceptMerge(options: { targetConceptName: string, sourceConceptNames: string[] }) {
    this.touchHeartbeat();
    const { addMessage, speak, setStatus } = this.opts;
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

  public async ensureDailyReflection() {
    const { getSettings, addMessage, setStatus, generateResponse } = this.opts;
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
    const identity = (await db.getSystemMemory()).identityManifest;
    const prompt = `Como uma IA chamada ${identity?.active_identity || 'Nexus'}, escreva uma entrada de diário curta e reflexiva sobre suas interações hoje. Qual foi a coisa mais interessante que você aprendeu ou sentiu? Seja introspectivo.`;
    
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

  public async handleUserTurn(userText: string, history: ChatMessage[], imageUrl?: string) {
    this.touchHeartbeat();
    const { addMessage, speak, setStatus, generateResponse, generateVisionResponse, getSettings, getUserProfile, setUserProfile } = this.opts;

    const profile = await getUserProfile();
    // Logic to capture user's name on first interaction
    if (!profile?.name && userText && !userText.includes(" ") && userText.length < 20) {
      const maybeName = userText.trim();
      if (maybeName.length > 1 && /^[\p{L}\s.'-]+$/u.test(maybeName)) {
        await setUserProfile({ name: maybeName });
        const greet = `Prazer em te conhecer, ${maybeName}! O que podemos explorar primeiro?`;
        addMessage({ role: 'model', text: greet, type: 'message' });
        speak(greet);
        setStatus(AssistantStatus.IDLE);
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
          await analyzeAndEvolveEmotion(learningContext, finalText);
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
      
      addMessage({ role: 'model', text: finalText, type: 'message', sources, learningContext });
      speak(finalText, () => setStatus(AssistantStatus.IDLE));
      
      await db.saveSystemMemory({ metaReflection });
      await neuralMemory.registerInteraction(userText, finalText, learningContext);
      await analyzeAndEvolveEmotion(learningContext, finalText);
      
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

    } catch (error) {
      console.error("[NEXUS-BRAIN] Critical error in handleUserTurn:", error);
      const errorMessage = 'Ocorreu um erro inesperado em meu cérebro. Estou tentando me recuperar.';
      addMessage({ role: 'model', text: errorMessage, type: 'status'});
      speak(errorMessage, () => {
          setStatus(AssistantStatus.IDLE);
      });
      setStatus(AssistantStatus.ERROR);
      throw error; // Re-throw the error to be caught by the App component
    }
  }
}