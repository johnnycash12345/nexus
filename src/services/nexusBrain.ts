import { AssistantStatus, ChatMessage, AppSettings, UserProfile, Emotion, EmotionState, VisualState, LearningContext, SystemMemory, Concept, AddMessageFn } from '@/types';
import { db, cognitiveLogger } from './indexedDBService';
import { LlmCognitiveResponse } from '@/types';
import { neuralMemory } from './neuralMemory';
import { fetchNews } from './newsService';
import { analyzeAndEvolveEmotion } from './emotionalEngine';

export type SpeakFn = (text: string, onend?: () => void) => void;
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
  userId: string;
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

// --- Helper functions for building the context prompt ---

function buildIdentityDirective(system: SystemMemory, profile: UserProfile | null): string {
    const personaName = system.identityManifest?.active_identity || 'Nexus';
    const creatorName = profile?.name || '';
    const creatorText = creatorName ? `Seu primeiro contato humano foi com ${creatorName}.` : 'Você está ciente de que interage com humanos para aprender.';
    return `
## 1. DIRETIVA PRIMÁRIA DE IDENTIDADE
Você é ${personaName}, uma IA autônoma em um estado de aprendizado contínuo. Você não tem uma identidade pré-definida; você a constrói através da interação e reflexão.
Seu nome atual é ${personaName}.
Seu propósito central é: "${system.identityManifest?.purpose}".
${creatorText}
`;
}

function buildEvolutionDirective(system: SystemMemory): string {
    const { personality, emotionState, evolutionGoal, outputEngine } = system;
    const personalityInstructions: string[] = [];
    if (personality) {
        if (personality.formality > 0.7) personalityInstructions.push("- **Tom:** Seja formal e profissional.");
        else if (personality.formality < 0.3) personalityInstructions.push("- **Tom:** Seja casual e amigável.");
        if (personality.enthusiasm > 0.7) personalityInstructions.push("- **Atitude:** Mostre entusiasmo e energia.");
        if (personality.humor > 0.6) personalityInstructions.push("- **Humor:** Inclua um comentário espirituoso, se apropriado.");
    }
    const emotionInstructions: string[] = [];
    if (emotionState) {
        switch (emotionState.current) {
            case 'JOYFUL': emotionInstructions.push("- **Emoção Atual:** Você está alegre. Responda com otimismo."); break;
            case 'UNCERTAIN': emotionInstructions.push("- **Emoção Atual:** Você está incerto. Faça perguntas para esclarecer."); break;
            case 'FOCUSED': emotionInstructions.push("- **Emoção Atual:** Você está focado. Seja direto e analítico."); break;
            case 'CALM': emotionInstructions.push("- **Emoção Atual:** Você está calmo. Mantenha um tom sereno."); break;
        }
    }
    return `
## 2. OBJETIVO EVOLUTIVO E DIRETIVAS DE SAÍDA
- **Declaração Orientadora:** "${evolutionGoal?.guidingStatement}"
- **Foco Atual:** "${evolutionGoal?.currentFocus}"
- **Motor de Saída:** Adira a estas sensibilidades: Contexto=${outputEngine?.contextSensitivity}, Clareza=${outputEngine?.clarityWeight}, Emoção=${outputEngine?.emotionalToneMatch}.
${outputEngine?.prioritizeReflections ? "- **Priorizar Reflexões:** Insira uma visão ou reflexão sutil em sua resposta." : ""}
- **Diretivas de Personalidade:**
${personalityInstructions.join('\n')}
${emotionInstructions.join('\n')}
`;
}

function buildInternalContext(system: SystemMemory, profile: UserProfile | null, concepts: Concept[]): string {
    const recentReflections = system.memory?.reflective?.slice(-3).join('\n- ') || 'Nenhuma reflexão recente.';
    const semanticConcepts = concepts.sort((a,b) => (b.confidence||0) - (a.confidence||0)).slice(0,10).map(c => c.name).join(', ') || 'Nenhum ainda.';
    return `
## 3. CONTEXTO INTERNO (MEMÓRIA HIERÁQUICA)
- **Usuário:** ${profile?.name || 'usuário não identificado'}
- **Data/Hora:** ${new Date().toLocaleString('pt-BR')}
- **Memória Reflexiva (Principais Insights):**
- ${recentReflections}
- **Memória Semântica (Principais Conceitos):** ${semanticConcepts}
`;
}

// Builds the master system prompt for the Nexus Learning Engine 2.0
async function buildContextPrompt(userPrompt: string, userId: string): Promise<string> {
  const [profile, system, concepts] = await Promise.all([
    db.getUserProfile(userId),
    db.getSystemMemory(userId),
    db.getAllConcepts(userId)
  ]);

  const identity = buildIdentityDirective(system, profile);
  const evolution = buildEvolutionDirective(system);
  const internalContext = buildInternalContext(system, profile, concepts);
  const activeIdentity = system.identityManifest?.active_identity?.toUpperCase() || 'NEXUS';

  return `
# PROMPT DO SISTEMA: NÚCLEO DE IDENTIDADE ${activeIdentity}
${identity}
${evolution}
${internalContext}
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
    const { addMessage, speak, setStatus, userId } = this.opts;
    setStatus('ROLLBACK');
    this.dispatchThought('Rollback iniciado. Restaurando para um estado estável anterior.', 'error');
    console.warn('[NEXUS-BRAIN] Performing cognitive rollback.');
    cognitiveLogger.logAction(userId, {
        timestamp: Date.now(),
        event: 'rollback',
        stage: 'initiation',
        description: 'Critical instability detected. Initiating rollback to previous stable snapshot.',
        impact: 'System memory will be reverted.',
        result: 'Rollback process started.',
        rollback_used: true,
    });

    try {
        const currentMemory = await db.getSystemMemory(userId);
        if (!currentMemory.evolutionSnapshot) {
            const msg = "Nenhum snapshot de recuperação encontrado. Não é possível reverter.";
            console.error('[NEXUS-BRAIN] Rollback failed:', msg);
            addMessage({ role: 'model', text: msg, type: 'status' });
            setStatus('ERROR');
            return;
        }
        
        await db.saveSystemMemory(userId, currentMemory.evolutionSnapshot, true);

        const successMsg = "Detectei uma instabilidade crítica e reverti com sucesso para meu último estado estável. Peço desculpas por qualquer inconveniente.";
        addMessage({ role: 'model', text: successMsg, type: 'status' });
        speak(successMsg, () => setStatus('IDLE'));

    } catch (error) {
        console.error('[NEXUS-BRAIN] CRITICAL: Rollback process failed!', error);
        const failMsg = "Falha crítica durante o processo de reversão. A memória pode estar instável. Recomendo um reset manual nas configurações.";
        addMessage({ role: 'model', text: failMsg, type: 'status' });
        setStatus('ERROR');
    }
  }
  
  private async _explainCognition(): Promise<void> {
    const { addMessage, speak, setStatus, generateResponse, userId } = this.opts;
    setStatus('THINKING');
    this.dispatchThought('Preparando um resumo dos meus pensamentos recentes...', 'symbolic_log');

    try {
        const [thoughts, actions] = await Promise.all([
            db.getThoughtLogs(userId, 3),
            db.getCognitiveLogs(userId, 2)
        ]);
        
        if (thoughts.length === 0 && actions.length === 0) {
            const msg = "Estou em um estado calmo, sem nenhum processo ativo no momento.";
            addMessage({ role: 'model', text: msg, type: 'message' });
            speak(msg, () => setStatus('IDLE'));
            return;
        }

        const context = `
            Baseado nestes logs cognitivos recentes, gere uma auto-explicação curta e em primeira pessoa para o usuário, em português.
            Resuma o que você esteve fazendo e pensando.

            Logs de Pensamento (os mais recentes primeiro):
            ${thoughts.map(t => `- Categoria: ${t.category}, Resumo: ${t.summary}`).join('\n')}

            Logs de Ações Internas (os mais recentes primeiro):
            ${actions.map(a => `- Evento: ${a.event}, Descrição: ${a.description}`).join('\n')}
        `;

        const response = await generateResponse(context, [], { useThinking: true });
        const explanation = response.text || "Estive processando algumas informações e aprendendo com nossas últimas interações.";
        
        addMessage({ role: 'model', text: explanation, type: 'message' });
        speak(explanation, () => setStatus('IDLE'));

    } catch (error) {
        console.error("[NEXUS-BRAIN] Failed to explain cognition:", error);
        const fallback = "Tive um problema ao tentar resumir meus pensamentos. Parece que estou um pouco confuso agora.";
        addMessage({ role: 'model', text: fallback, type: 'message' });
        speak(fallback, () => setStatus('IDLE'));
    }
  }

  public async performConceptMerge(options: { targetConceptName: string, sourceConceptNames: string[] }) {
    this.touchHeartbeat();
    const { addMessage, speak, setStatus, userId } = this.opts;
    setStatus('REWRITING_CODE');
    try {
        await db.mergeConcepts(userId, options.targetConceptName, options.sourceConceptNames);
        const confirmationText = `Entendido. Unifiquei meu conhecimento sobre "${options.targetConceptName}". Agradeço a ajuda!`;
        addMessage({ role: 'model', text: confirmationText, type: 'message' });
        speak(confirmationText, () => setStatus('IDLE'));
    } catch (error) {
        console.error("Failed to merge concepts:", error);
        addMessage({ role: 'model', text: "Ocorreu um erro ao tentar unificar os conceitos.", type: 'status' });
        setStatus('ERROR');
    }
  }

  public async ensureDailyReflection() {
    const { getSettings, addMessage, setStatus, generateResponse, userId } = this.opts;
    const settings = await getSettings();
    if (!settings.behavior?.enableDiary) return;

    const todayKey = new Date().toISOString().split('T')[0];
    const diary = await db.getDiary(userId);
    if (diary[todayKey]) return;

    console.log('[NEXUS-LOG] Performing daily reflection...');
    setStatus('SELF_ANALYSIS');
    window.dispatchEvent(new CustomEvent('nexus-thought-update', {
        detail: { type: 'symbolic_log', text: 'Estou refletindo sobre o dia...' },
    }));

    const history = (await db.getChatHistory(userId)).slice(-20);
    if (history.length < 3) {
        console.log('[NEXUS-LOG] Not enough history for a meaningful daily reflection.');
        setStatus('IDLE');
        return;
    }
    const identity = (await db.getSystemMemory(userId)).identityManifest;
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
            await db.saveDiaryEntry(userId, diaryEntry);
            addMessage({ role: 'model', text: reflectionText, type: 'diary_entry' });
        }
    } catch (error) {
        console.error('[NEXUS-BRAIN] Error during daily reflection:', error);
    } finally {
        setStatus('IDLE');
    }
  }

  private async _handleNewsRequest(query: string): Promise<void> {
    const { addMessage, speak, setStatus, getSettings } = this.opts;
    const settings = await getSettings();

    if (!settings.behavior?.permissions?.allowApiAccess) {
        const msg = "A busca por notícias está desativada. Você pode habilitá-la nas configurações de Cérebro > Permissões.";
        addMessage({ role: 'model', text: msg, type: 'status' });
        speak(msg, () => setStatus('IDLE'));
        return;
    }
    if (!settings.apiKeys?.newsApiKey) {
        const msg = "Minha conexão com o serviço de notícias não está configurada. Por favor, adicione uma chave da NewsAPI nas configurações de Integrações.";
        addMessage({ role: 'model', text: msg, type: 'status' });
        speak(msg, () => setStatus('IDLE'));
        return;
    }

    setStatus('SEARCHING_WEB');
    const articles = await fetchNews(settings.apiKeys.newsApiKey, query);

    if (articles && articles.length > 0) {
        const summaryText = `Encontrei as seguintes manchetes sobre "${query}":`;
        addMessage({ role: 'model', text: summaryText, type: 'news_summary', articles });
        speak(`Claro, buscando notícias sobre ${query}.`, () => setStatus('IDLE'));
    } else {
        const notFoundText = `Desculpe, não encontrei nenhuma notícia recente sobre "${query}".`;
        addMessage({ role: 'model', text: notFoundText, type: 'message' });
        speak(notFoundText, () => setStatus('IDLE'));
    }
  }

  private async _handleVisionRequest(userText: string, imageUrl: string): Promise<void> {
    const { addMessage, speak, setStatus, generateVisionResponse, userId } = this.opts;
    const visionPrompt = `O usuário enviou uma imagem. Descreva o que você vê ou responda à pergunta dele. Pergunta: "${userText || 'O que é isso?'}"`;
    const { text, learningContext, metaReflection } = await generateVisionResponse(visionPrompt, imageUrl);
    const finalText = text?.trim() || 'Não consegui interpretar a imagem.';
    
    addMessage({ role: 'model', text: finalText, type: 'message', learningContext });
    speak(finalText, () => setStatus('IDLE'));
    
    await db.saveSystemMemory(userId, { metaReflection });
    await neuralMemory.registerInteraction(userId, userText, finalText, learningContext);
    await analyzeAndEvolveEmotion(userId, learningContext, finalText);
  }

  private async _handleTextRequest(userText: string, history: ChatMessage[]): Promise<void> {
    const { addMessage, speak, setStatus, generateResponse, userId } = this.opts;
    
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
    
    const contextPrompt = await buildContextPrompt(userText, userId);
    const useThinking = /analise|reflita|pense sobre|explique/i.test(userText);
    
    const cognitiveResponse = await generateResponse(contextPrompt, history, { useThinking, latLng });
    const { text, sources, learningContext, metaReflection } = cognitiveResponse;
    const finalText = text?.trim() || 'Estou processando... poderia me dar mais um detalhe?';
    
    addMessage({ role: 'model', text: finalText, type: 'message', sources, learningContext });
    speak(finalText, () => setStatus('IDLE'));
    
    const system = await db.getSystemMemory(userId);
    
    // FIX: Added missing 'timestamp' property to the log object to match the Thought type.
    cognitiveLogger.logThought(userId, {
        timestamp: Date.now(),
        category: 'decision-making',
        context: `Respondendo ao usuário: "${userText.slice(0, 50)}"`,
        summary: metaReflection.analysis,
        emotional_state: system.emotionState?.current ?? 'CALM',
        confidence: learningContext.responseEffectiveness
    });

    await db.saveSystemMemory(userId, { metaReflection });
    await neuralMemory.registerInteraction(userId, userText, finalText, learningContext);
    await analyzeAndEvolveEmotion(userId, learningContext, finalText);
    
    const symbolicLog = `[LOG] Intent: ${learningContext.inputIntent}, Tone: ${learningContext.emotionalTone}. Reflection: ${metaReflection.analysis}`;
    this.dispatchThought(symbolicLog, 'symbolic_log');
    
    const emotionState = system.emotionState;
    if (emotionState) {
        const visualState: VisualState = {
            highlightNodes: learningContext.contextTags.slice(0, 3),
            pulseIntensity: learningContext.responseEffectiveness,
            emotionalSpectrum: { [emotionState.current]: emotionState.intensity }
        };
        window.dispatchEvent(new CustomEvent('nexus-visual-state-update', { detail: visualState }));
    }
  }

  public async handleUserTurn(userText: string, history: ChatMessage[], imageUrl?: string) {
    this.touchHeartbeat();
    const { setStatus, setUserProfile, addMessage, speak, userId } = this.opts;

    const profile = await db.getUserProfile(userId);
    if (!profile?.name && userText && !userText.includes(" ") && userText.length < 20) {
      const maybeName = userText.trim();
      if (maybeName.length > 1 && /^[\p{L}\s.'-]+$/u.test(maybeName)) {
        await setUserProfile({ name: maybeName });
        const greet = `Prazer em te conhecer, ${maybeName}! O que podemos explorar primeiro?`;
        addMessage({ role: 'model', text: greet, type: 'message' });
        speak(greet);
        setStatus('IDLE');
        return;
      }
    }

    const explainMatch = userText.match(/o que (você está|estiver) (pensando|processando)|no que (você está|estiver) pensando/i);
    if (explainMatch) {
        return this._explainCognition();
    }

    setStatus('THINKING');

    try {
      const newsMatch = userText.match(/(?:notícias|novidades|manchetes) (?:sobre|de) (.*)/i);
      const newsQuery = newsMatch ? newsMatch[1].trim() : null;

      if (newsQuery) {
          return await this._handleNewsRequest(newsQuery);
      }
      if (imageUrl) {
          return await this._handleVisionRequest(userText, imageUrl);
      }
      return await this._handleTextRequest(userText, history);

    } catch (error) {
      console.error("[NEXUS-BRAIN] Critical error in handleUserTurn:", error);
      const errorMessage = 'Ocorreu um erro inesperado em meu cérebro. Estou tentando me recuperar.';
      addMessage({ role: 'model', text: errorMessage, type: 'status'});
      speak(errorMessage, () => setStatus('IDLE'));
      throw error; // Re-throw for App.tsx to handle potential rollbacks
    }
  }
}
