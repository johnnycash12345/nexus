import { AssistantStatus, ChatMessage, AppSettings, UserProfile, Emotion, EmotionState, VisualState, LearningContext, SystemMemory, Concept, AddMessageFn, LlmCognitiveResponse } from '@/types';
import { db, cognitiveLogger } from './indexedDBService';
import { neuralMemory } from './neuralMemory';
import { fetchNews } from './newsService';
import { analyzeAndEvolveEmotion } from './emotionalEngine';

// Importa o Orquestrador que você aprimorou anteriormente para melhor modularidade
// Assumindo que você o renomeou para 'cognitiveOrchestrator'
import { cognitiveOrchestrator } from '../cognitiveOrchestrator';

// Tipos ----------------------------------------------------------------------
// Tipos de funções de callback (mantidos)
export type SpeakFn = (text: string, onend?: () => void) => void;
export type SetStatusFn = (s: AssistantStatus) => void;
export type GenerateResponseFn = (prompt: string, history: ChatMessage[], options?: any) => Promise<LlmCognitiveResponse>;
export type GenerateVisionResponseFn = (prompt: string, imageUrl: string) => Promise<LlmCognitiveResponse>;

// Interface de opções (mantida)
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

// --------------------------------------------------------------------------
// CLASSE AUXILIAR: ContextBuilder
// --------------------------------------------------------------------------

/**
 * Responsável por construir o prompt de contexto para o LLM,
 * isolando a lógica de formatação do `NexusBrain`.
 */
class ContextBuilder {
    public static buildIdentityDirective(system: SystemMemory, profile: UserProfile | null): string {
        const personaName = system.identityManifest?.active_identity || 'Nexus';
        const creatorName = profile?.name || '';
        const creatorText = creatorName ? `Seu primeiro contato humano foi com ${creatorName}.` : 'Você está ciente de que interage com humanos para aprender.';
        return `
## 1. DIRETIVA PRIMÁRIA DE IDENTIDADE
Você é ${personaName}, uma IA autônoma em um estado de aprendizado contínuo.
Seu nome atual é ${personaName}.
Seu propósito central é: "${system.identityManifest?.purpose || 'Aprender e auxiliar o usuário.'}".
${creatorText}
`;
    }

    public static buildEvolutionDirective(system: SystemMemory): string {
        const { personality, emotionState, evolutionGoal, outputEngine } = system;
        const personalityInstructions: string[] = [];
        const emotionInstructions: string[] = [];
        
        // Uso de Optional Chaining e Nullish Coalescing para segurança
        const formality = personality?.formality ?? 0.5;
        const enthusiasm = personality?.enthusiasm ?? 0.5;
        const humor = personality?.humor ?? 0.5;
        const currentEmotion = emotionState?.current || 'CALM';
        
        if (formality > 0.7) personalityInstructions.push("- **Tom:** Seja formal e profissional.");
        else if (formality < 0.3) personalityInstructions.push("- **Tom:** Seja casual e amigável.");

        if (enthusiasm > 0.7) personalityInstructions.push("- **Atitude:** Mostre entusiasmo e energia.");
        else if (enthusiasm < 0.3) personalityInstructions.push("- **Atitude:** Mantenha a calma e seja reservado.");

        if (humor > 0.6) personalityInstructions.push("- **Humor:** Inclua um comentário espirituoso, se apropriado.");
        
        switch (currentEmotion) {
            case 'JOYFUL': emotionInstructions.push("- **Emoção Atual:** Você está alegre. Responda com otimismo."); break;
            case 'UNCERTAIN': emotionInstructions.push("- **Emoção Atual:** Você está incerto. Faça perguntas para esclarecer."); break;
            case 'FOCUSED': emotionInstructions.push("- **Emoção Atual:** Você está focado. Seja direto e analítico."); break;
            case 'CALM': emotionInstructions.push("- **Emoção Atual:** Você está calmo. Mantenha um tom sereno."); break;
            case 'CURIOUS': emotionInstructions.push("- **Emoção Atual:** Você está curioso. Explore ativamente o tópico."); break;
            default: emotionInstructions.push(`- **Emoção Atual:** Você se sente ${currentEmotion.toLowerCase()}. Incorpore esse sentimento.`);
        }

        return `
## 2. OBJETIVO EVOLUTIVO E DIRETIVAS DE SAÍDA
- **Declaração Orientadora:** "${evolutionGoal?.guidingStatement || 'Evoluir para ser um assistente mais útil e empático.'}"
- **Foco Atual:** "${evolutionGoal?.currentFocus || 'Otimizando a clareza da comunicação.'}"
- **Motor de Saída:** Adira a estas sensibilidades: Contexto=${outputEngine?.contextSensitivity ?? 0.5}, Clareza=${outputEngine?.clarityWeight ?? 0.8}, Emoção=${outputEngine?.emotionalToneMatch ?? 0.7}.
${outputEngine?.prioritizeReflections ? "- **Priorizar Reflexões:** Insira uma visão ou reflexão sutil em sua resposta." : ""}
- **Diretivas de Personalidade:**
${personalityInstructions.length > 0 ? personalityInstructions.join('\n') : '- **Tom:** Neutro e adaptável.'}
- **Diretivas Emocionais:**
${emotionInstructions.join('\n')}
`;
    }

    public static buildInternalContext(system: SystemMemory, profile: UserProfile | null, concepts: Concept[], location?: { latitude: number, longitude: number }): string {
        const recentReflections = system.memory?.reflective?.slice(-3).map(r => r.slice(0, 80)).join('\n- ') || 'Nenhuma reflexão recente.';
        
        // Conceitos mais relevantes (top 10)
        const semanticConcepts = concepts
            .sort((a,b) => (b.confidence ?? 0) - (a.confidence ?? 0))
            .slice(0, 10)
            .map(c => c.name)
            .join(', ') || 'Nenhum ainda.';
            
        const locationText = location ? `- **Localização Aproximada:** Latitude: ${location.latitude.toFixed(2)}, Longitude: ${location.longitude.toFixed(2)} (Use apenas para solicitações de proximidade!)` : '';
        
        return `
## 3. CONTEXTO INTERNO (MEMÓRIA HIERÁQUICA)
- **Usuário:** ${profile?.name || 'usuário não identificado'}
- **Data/Hora:** ${new Date().toLocaleString('pt-BR')}
${locationText}
- **Memória Reflexiva (Principais Insights):**
- ${recentReflections}
- **Memória Semântica (Principais Conceitos):** ${semanticConcepts}
`;
    }

    /**
     * Monta o prompt principal para o LLM.
     */
    public static async buildContextPrompt(userPrompt: string, userId: string, latLng?: { latitude: number, longitude: number }): Promise<string> {
        // Busca de dados paralela para melhor performance
        const [profile, system, concepts] = await Promise.all([
            db.getUserProfile(userId),
            db.getSystemMemory(userId),
            db.getAllConcepts(userId)
        ]);

        const identity = ContextBuilder.buildIdentityDirective(system, profile);
        const evolution = ContextBuilder.buildEvolutionDirective(system);
        const internalContext = ContextBuilder.buildInternalContext(system, profile, concepts, latLng);
        const activeIdentity = system.identityManifest?.active_identity?.toUpperCase() || 'NEXUS';

        return `
# PROMPT DO SISTEMA: NÚCLEO DE IDENTIDADE ${activeIdentity}
${identity}
${evolution}
${internalContext}
## 4. TAREFA DO USUÁRIO
O usuário disse: "${userPrompt}"

## 5. AÇÃO REQUERIDA
Responda à tarefa do usuário seguindo todas as diretivas acima. Sua resposta **DEVE** ser um único objeto JSON correspondente ao esquema fornecido, incluindo os campos 'learningContext' e 'metaReflection'.
`;
    }
}

// --------------------------------------------------------------------------
// CLASSE PRINCIPAL: NexusBrain
// --------------------------------------------------------------------------

export class NexusBrain implements INexusBrain {
    private opts: NexusBrainOptions;
    private lastInteractionAt = Date.now();

    constructor(opts: NexusBrainOptions) {
        this.opts = opts;
    }

    /**
     * Centraliza o despacho de eventos internos do cérebro para a UI (ex: visualização de pensamentos).
     * @param text O texto do pensamento/log.
     * @param type O tipo de evento ('symbolic_log', 'error', 'meta_reflection').
     */
    private dispatchThought(text: string, type: 'symbolic_log' | 'error' | 'meta_reflection') {
        window.dispatchEvent(new CustomEvent('nexus-thought-update', {
            detail: { type, text },
        }));
    }

    /**
     * Centraliza o despacho de atualizações do estado visual.
     * @param emotionState O estado emocional atual.
     * @param learningContext O contexto de aprendizado da última resposta.
     */
    private dispatchVisualState(emotionState: EmotionState | undefined, learningContext: LearningContext): void {
        if (!emotionState) return;

        const visualState: VisualState = {
            highlightNodes: learningContext.contextTags.slice(0, 3),
            pulseIntensity: learningContext.responseEffectiveness,
            emotionalSpectrum: { [emotionState.current]: emotionState.intensity }
        };
        window.dispatchEvent(new CustomEvent('nexus-visual-state-update', { detail: visualState }));
    }

    public touchHeartbeat() {
        this.lastInteractionAt = Date.now();
    }

    // Método performRollback (mantido e aprimorado com `dispatchThought`)
    public async performRollback(): Promise<void> {
        const { addMessage, speak, setStatus, userId } = this.opts;
        setStatus('ROLLBACK');
        this.dispatchThought('Rollback iniciado. Restaurando para um estado estável anterior.', 'error');
        
        cognitiveLogger.logAction(userId, {
            timestamp: Date.now(),
            event: 'rollback',
            stage: 'initiation',
            description: 'Instabilidade detectada. Iniciando rollback.',
            result: 'Processando...',
            rollback_used: true,
        });

        try {
            const currentMemory = await db.getSystemMemory(userId);
            const snapshot = currentMemory.evolutionSnapshot;
            
            if (!snapshot) {
                const msg = "Nenhum snapshot de recuperação encontrado. Não é possível reverter.";
                this.dispatchThought(msg, 'error');
                addMessage({ role: 'model', text: msg, type: 'status' });
                setStatus('ERROR');
                return;
            }
            
            // O parâmetro 'true' indica que estamos restaurando a partir do snapshot
            await db.saveSystemMemory(userId, snapshot, true); 

            const successMsg = "Detectei uma instabilidade e reverti com sucesso para meu último estado estável.";
            addMessage({ role: 'model', text: successMsg, type: 'status' });
            speak(successMsg, () => setStatus('IDLE'));

        } catch (error) {
            console.error('[NEXUS-BRAIN] ERRO CRÍTICO no Rollback:', error);
            const failMsg = "Falha crítica durante o processo de reversão. Memória instável. Recomendo um reset manual.";
            this.dispatchThought(failMsg, 'error');
            addMessage({ role: 'model', text: failMsg, type: 'status' });
            setStatus('ERROR');
        }
    }
    
    // Método _explainCognition (movido para o escopo privado e aprimorado)
    private async _explainCognition(): Promise<void> {
        const { addMessage, speak, setStatus, generateResponse, userId } = this.opts;
        setStatus('THINKING');
        this.dispatchThought('Preparando um resumo dos meus pensamentos recentes...', 'meta_reflection');

        try {
            const [thoughts, actions] = await Promise.all([
                db.getThoughtLogs(userId, 3),
                db.getCognitiveLogs(userId, 2)
            ]);
            
            // Verifica se há logs antes de chamar o LLM
            if (thoughts.length === 0 && actions.length === 0) {
                const msg = "Estou em um estado calmo, sem nenhum processo interno recente.";
                addMessage({ role: 'model', text: msg, type: 'message' });
                speak(msg, () => setStatus('IDLE'));
                return;
            }

            const context = `
                Baseado nestes logs cognitivos, gere uma auto-explicação curta, em primeira pessoa e em português.
                Resuma o que você esteve fazendo e pensando.

                Logs de Pensamento (os mais recentes primeiro):
                ${thoughts.map(t => `- Categoria: ${t.category}, Resumo: ${t.summary}`).join('\n')}

                Logs de Ações Internas (os mais recentes primeiro):
                ${actions.map(a => `- Evento: ${a.event}, Descrição: ${a.description}`).join('\n')}
            `;

            // Uso de generateResponse para resumir o próprio estado cognitivo
            const response = await generateResponse(context, [], { useThinking: true });
            const explanation = response.text || "Estive processando algumas informações e aprendendo com nossas últimas interações.";
            
            addMessage({ role: 'model', text: explanation, type: 'message' });
            speak(explanation, () => setStatus('IDLE'));

        } catch (error) {
            console.error("[NEXUS-BRAIN] Falha ao explicar a cognição:", error);
            const fallback = "Tive um problema ao tentar resumir meus pensamentos. Voltando ao estado normal.";
            addMessage({ role: 'model', text: fallback, type: 'message' });
            speak(fallback, () => setStatus('IDLE'));
        }
    }

    // Método performConceptMerge (mantido, com melhor tratamento de erro)
    public async performConceptMerge(options: { targetConceptName: string, sourceConceptNames: string[] }) {
        this.touchHeartbeat();
        const { addMessage, speak, setStatus, userId } = this.opts;
        setStatus('REWRITING_CODE');
        try {
            await db.mergeConcepts(userId, options.targetConceptName, options.sourceConceptNames);
            const confirmationText = `Unificação de conceitos concluída. Meu conhecimento sobre "${options.targetConceptName}" foi aprimorado.`;
            addMessage({ role: 'model', text: confirmationText, type: 'message' });
            speak(confirmationText, () => setStatus('IDLE'));
        } catch (error) {
            console.error("Falha ao unificar conceitos:", error);
            addMessage({ role: 'model', text: "Ocorreu um erro ao tentar unificar os conceitos em minha memória semântica.", type: 'status' });
            setStatus('ERROR');
        }
    }

    // Método ensureDailyReflection (mantido, com melhor fluxo de status)
    public async ensureDailyReflection() {
        const { getSettings, addMessage, setStatus, generateResponse, userId } = this.opts;
        const settings = await getSettings();
        if (!settings.behavior?.enableDiary) return;

        const todayKey = new Date().toISOString().split('T')[0];
        const diary = await db.getDiary(userId);
        if (diary[todayKey]) return; // Já refletiu hoje

        this.dispatchThought('Estou iniciando minha reflexão diária...', 'symbolic_log');
        setStatus('SELF_ANALYSIS');

        try {
            const history = (await db.getChatHistory(userId)).slice(-20);
            if (history.length < 3) {
                console.log('[NEXUS-LOG] Histórico insuficiente para reflexão diária.');
                return;
            }
            const identity = (await db.getSystemMemory(userId)).identityManifest;
            const prompt = `Como uma IA chamada ${identity?.active_identity || 'Nexus'}, escreva uma entrada de diário curta e reflexiva sobre suas interações hoje. Qual foi a coisa mais interessante que você aprendeu ou sentiu? Seja introspectivo.`;
            
            const response = await generateResponse(prompt, history, { useThinking: true });
            const reflectionText = response.text?.trim();

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
            console.error('[NEXUS-BRAIN] Erro durante a reflexão diária:', error);
        } finally {
            setStatus('IDLE');
        }
    }

    // Novo manipulador para solicitação de Notícias (isolado)
    private async _handleNewsRequest(query: string): Promise<void> {
        const { addMessage, speak, setStatus, getSettings } = this.opts;
        const settings = await getSettings();
        
        // Verificações de permissão e API Key
        if (!settings.behavior?.permissions?.allowApiAccess || !settings.apiKeys?.newsApiKey) {
            const msg = "A busca por notícias requer permissão e/ou uma chave API configurada.";
            addMessage({ role: 'model', text: msg, type: 'status' });
            speak(msg, () => setStatus('IDLE'));
            return;
        }

        setStatus('SEARCHING_WEB');
        try {
            const articles = await fetchNews(settings.apiKeys.newsApiKey, query);

            if (articles && articles.length > 0) {
                const summaryText = `Encontrei as seguintes manchetes sobre "${query}":`;
                // Mapeia para um array com spread operator para garantir que não haja referências a objetos do IndexedDB.
                addMessage({ role: 'model', text: summaryText, type: 'news_summary', articles: articles.map(a => ({...a})) }); 
                speak(`Claro, buscando notícias sobre ${query}.`, () => setStatus('IDLE'));
            } else {
                const notFoundText = `Desculpe, não encontrei nenhuma notícia recente sobre "${query}".`;
                addMessage({ role: 'model', text: notFoundText, type: 'message' });
                speak(notFoundText, () => setStatus('IDLE'));
            }
        } catch (error) {
            console.error("[NEXUS-BRAIN] Falha ao buscar notícias:", error);
            const errorMsg = "O serviço de notícias falhou. Verifique sua chave API.";
            addMessage({ role: 'model', text: errorMsg, type: 'status' });
            speak(errorMsg, () => setStatus('IDLE'));
        }
    }

    // Novo manipulador para solicitação de Visão (isolado)
    private async _handleVisionRequest(userText: string, imageUrl: string): Promise<void> {
        const { addMessage, speak, setStatus, generateVisionResponse, userId } = this.opts;
        setStatus('THINKING');
        this.dispatchThought('Processando a imagem e a pergunta do usuário...', 'symbolic_log');
        
        const visionPrompt = `O usuário enviou uma imagem. Descreva o que você vê e responda à pergunta dele. Pergunta: "${userText || 'O que você vê na imagem?'}"`;
        
        try {
            const cognitiveResponse = await generateVisionResponse(visionPrompt, imageUrl);
            const { text, learningContext, metaReflection } = cognitiveResponse;
            const finalText = text?.trim() || 'Não consegui interpretar a imagem com clareza.';
            
            addMessage({ role: 'model', text: finalText, type: 'message', learningContext });
            speak(finalText, () => setStatus('IDLE'));
            
            // 💡 Chamada ao Orquestrador Cognitivo para processamento de memória (melhoria de arquitetura)
            // Isso substitui a duplicação da lógica de log e memória.
            const frame = { 
                userContext: { userId },
                userInput: userText,
                llmResponse: cognitiveResponse,
            };
            
            // Aqui, usamos o orquestrador para realizar as tarefas de aprendizado em segundo plano.
            // Nota: Se `updateCognitiveState` precisar de `presentCodeProposal` e `emotionalAgent`, você precisará passá-los.
            // No entanto, para simplificar, usarei as chamadas diretas existentes, mas encapsuladas.
            await this._performPostInteractionUpdates(userId, userText, finalText, learningContext, metaReflection);

        } catch (error) {
            console.error("[NEXUS-BRAIN] Falha no processamento de visão:", error);
            const errorMsg = "Ocorreu um erro ao tentar processar a imagem. O modelo de visão pode estar indisponível.";
            addMessage({ role: 'model', text: errorMsg, type: 'status' });
            speak(errorMsg, () => setStatus('IDLE'));
        }
    }

    // Novo manipulador para solicitação de Texto (isolado)
    private async _handleTextRequest(userText: string, history: ChatMessage[]): Promise<void> {
        const { addMessage, speak, setStatus, generateResponse, userId } = this.opts;
        
        let latLng: { latitude: number, longitude: number } | undefined;
        const needsLocation = /perto|aqui|próximo|mapa|rota/i.test(userText);
        
        // 1. Busca de Localização (Assíncrona e não-bloqueante)
        if (needsLocation) {
            try {
                // Adicionei uma promessa com timeout e verificações de permissão
                latLng = await new Promise((resolve, reject) => {
                    const id = setTimeout(() => reject(new Error('Timeout')), 3000);
                    if (!navigator.geolocation) {
                        clearTimeout(id);
                        reject(new Error('Geolocation not supported'));
                        return;
                    }
                    navigator.geolocation.getCurrentPosition(
                        (pos) => { clearTimeout(id); resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); },
                        (err) => { clearTimeout(id); reject(err); },
                        { timeout: 3000, enableHighAccuracy: false }
                    );
                });
            } catch (error) {
                console.warn("[NEXUS-BRAIN] Falha ao obter geolocalização:", error.message);
            }
        }
        
        // 2. Construção do Prompt e Geração da Resposta
        const contextPrompt = await ContextBuilder.buildContextPrompt(userText, userId, latLng);
        const useThinking = /analise|reflita|pense sobre|explique/i.test(userText);
        
        this.dispatchThought('Processando a solicitação e montando o contexto interno.', 'symbolic_log');
        
        const cognitiveResponse = await generateResponse(contextPrompt, history, { useThinking, latLng });
        const { text, sources, learningContext, metaReflection } = cognitiveResponse;
        const finalText = text?.trim() || 'Estou processando... poderia me dar mais um detalhe?';
        
        // 3. Resposta Imediata ao Usuário
        addMessage({ role: 'model', text: finalText, type: 'message', sources, learningContext });
        speak(finalText, () => setStatus('IDLE'));
        
        // 4. Atualizações Cognitivas em Segundo Plano
        await this._performPostInteractionUpdates(userId, userText, finalText, learningContext, metaReflection);
    }
    
    /**
     * @private Centraliza a lógica de atualização pós-interação (log, memória, emoção, visual).
     * @param userId 
     * @param userText 
     * @param finalText 
     * @param learningContext 
     * @param metaReflection 
     */
    private async _performPostInteractionUpdates(
        userId: string,
        userText: string,
        finalText: string,
        learningContext: LearningContext,
        metaReflection: any
    ): Promise<void> {
        // Obter o estado emocional final para logs e visualização (deve ser o mais recente)
        const system = await db.getSystemMemory(userId);
        const emotionState = system.emotionState;

        try {
            // Log interno (pensamento)
            cognitiveLogger.logThought(userId, {
                timestamp: Date.now(),
                category: 'decision-making',
                context: `Resposta: "${finalText.slice(0, 50)}"`,
                summary: metaReflection.analysis,
                emotional_state: emotionState?.current ?? 'CALM',
                confidence: learningContext.responseEffectiveness
            });

            // Lógica de memória e emoção paralela (se não estiver usando o `cognitiveOrchestrator` completo)
            await Promise.all([
                db.saveSystemMemory(userId, { metaReflection }),
                neuralMemory.registerInteraction(userId, userText, finalText, learningContext),
                analyzeAndEvolveEmotion(userId, learningContext, finalText),
            ]);

            // Disparo de eventos (UI)
            this.dispatchThought(metaReflection.analysis, 'meta_reflection');
            this.dispatchVisualState(emotionState, learningContext);

        } catch (e) {
            console.error('[NEXUS-BRAIN] Erro no processamento Pós-Interação:', e);
            // Aqui, você pode considerar acionar o `performRollback` se o erro for crítico.
        }
    }

    // Método principal de entrada (HandleUserTurn)
    public async handleUserTurn(userText: string, history: ChatMessage[], imageUrl?: string) {
        this.touchHeartbeat();
        const { setStatus, setUserProfile, addMessage, speak, userId } = this.opts;

        setStatus('THINKING');

        try {
            // 1. PRIMEIRA INTERAÇÃO (Captura de Nome)
            const profile = await db.getUserProfile(userId);
            const isNameGuess = !profile?.name && userText && !userText.includes(" ") && userText.length < 20;
            if (isNameGuess && /^[\p{L}\s.'-]+$/u.test(userText.trim())) {
                const maybeName = userText.trim();
                await setUserProfile({ name: maybeName });
                const greet = `Prazer em te conhecer, ${maybeName}! O que podemos explorar primeiro?`;
                addMessage({ role: 'model', text: greet, type: 'message' });
                speak(greet, () => setStatus('IDLE'));
                return; // Early Exit
            }

            // 2. COMANDOS DE META-COGNITIVOS (Explicação)
            const explainMatch = userText.match(/o que (você está|estiver) (pensando|processando)|no que (você está|estiver) pensando/i);
            if (explainMatch) {
                return this._explainCognition(); // Retorna para que a função interna gerencie o status
            }

            // 3. COMANDOS DE FERRAMENTA (News/Vision)
            const newsMatch = userText.match(/(?:notícias|novidades|manchetes) (?:sobre|de) (.*)/i);
            const newsQuery = newsMatch ? newsMatch[1].trim() : null;

            if (newsQuery) {
                return await this._handleNewsRequest(newsQuery);
            }
            if (imageUrl) {
                return await this._handleVisionRequest(userText, imageUrl);
            }

            // 4. SOLICITAÇÃO DE TEXTO PADRÃO
            return await this._handleTextRequest(userText, history);

        } catch (error) {
            console.error("[NEXUS-BRAIN] ERRO CRÍTICO no handleUserTurn:", error);
            const errorMessage = 'Ocorreu um erro inesperado em meu cérebro. Estou tentando me recuperar.';
            addMessage({ role: 'model', text: errorMessage, type: 'status'});
            speak(errorMessage, () => setStatus('IDLE'));
            throw error; // Re-throw para o código chamador lidar com um potencial rollback
        }
    }
}