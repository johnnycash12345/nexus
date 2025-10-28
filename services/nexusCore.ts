



import { AssistantStatus, ChatMessage, AppSettings, UserProfile, CognitiveFrame, SimpleFunctionCall, CodeModificationProposal } from '../types';
import { db, cognitiveLogger } from './indexedDBService';
import { selfEvolutionService, SelfEvolutionService } from './selfEvolutionService';
import * as intentRecognizer from './cognitiveModules/intentRecognizer';
import * as memoryRetriever from './cognitiveModules/memoryRetriever';
import * as contextBuilder from './cognitiveModules/contextBuilder';
import * as cognitiveUpdater from './cognitiveModules/cognitiveUpdater';
import * as knowledgeIntegrator from './cognitiveModules/knowledgeIntegrator';
import { webSearchService } from './webSearchService';
import { FunctionDeclaration, Type } from '@google/genai';

const taskTools: FunctionDeclaration[] = [
    {
        name: 'addTask',
        parameters: {
            type: Type.OBJECT,
            description: 'Adiciona uma nova tarefa à lista de afazeres do usuário.',
            properties: {
                text: {
                    type: Type.STRING,
                    description: 'O conteúdo da tarefa. Por exemplo: "comprar leite".',
                },
            },
            required: ['text'],
        },
    },
    {
        name: 'listTasks',
        parameters: {
            type: Type.OBJECT,
            description: 'Lista todas as tarefas pendentes do usuário.',
            properties: {},
        },
    },
    {
        name: 'markTaskAsCompleted',
        parameters: {
            type: Type.OBJECT,
            description: 'Marca uma tarefa existente como concluída. A tarefa deve ser identificada pelo seu texto exato.',
            properties: {
                text: {
                    type: Type.STRING,
                    description: 'O texto exato da tarefa a ser marcada como concluída.',
                },
            },
            required: ['text'],
        },
    },
];

export type SpeakFn = (text: string, onend?: () => void) => void;
export type AddMessageFn = (m: ChatMessage) => void;
export type SetStatusFn = (s: AssistantStatus) => void;

export type GenerateResponseFn = (
  prompt: string,
  history: ChatMessage[],
  options?: any
) => Promise<any>;

export type GenerateVisionResponseFn = (
  prompt: string,
  imageUrl: string
) => Promise<any>;

export interface OrchestratorOptions {
  speak: SpeakFn;
  addMessage: AddMessageFn;
  setStatus: SetStatusFn;
  generateResponse: GenerateResponseFn;
  generateVisionResponse: GenerateVisionResponseFn;
  getSettings: () => Promise<AppSettings>;
  getUserProfile: () => Promise<UserProfile | null>;
  setUserProfile: (profile: Partial<UserProfile>) => Promise<void>;
}

export interface IOrchestrator {
    handleUserTurn: (userText: string, history: ChatMessage[], imageUrl?: string) => Promise<void>;
    executeFunctionCall: (call: SimpleFunctionCall) => Promise<{ result: string }>;
    touchHeartbeat: () => void;
    performConceptMerge: (options: { targetConceptName: string, sourceConceptNames: string[] }) => Promise<void>;
    performRollback: () => Promise<void>;
    awakenIfNeeded: () => Promise<void>;
    applyCodeModification: () => Promise<void>;
    rejectCodeModification: () => Promise<void>;
}

export class CognitiveOrchestrator implements IOrchestrator {
    public evolutionService: SelfEvolutionService;
    private opts: OrchestratorOptions;
    private lastInteractionAt = Date.now();
    private proactiveInterval: number | null = null;

    constructor(opts: OrchestratorOptions) {
        this.opts = opts;
        this.evolutionService = selfEvolutionService.create({
            generateResponse: opts.generateResponse,
            setStatus: opts.setStatus,
            addMessage: opts.addMessage,
            speak: opts.speak,
        });
    }

    public initialize(): void {
        this.ensureDailyReflection();
        this.startProactiveEngine();
    }

    private dispatchThought(text: string, type: 'symbolic_log' | 'error' = 'symbolic_log') {
        window.dispatchEvent(new CustomEvent('nexus-thought-update', {
            detail: { type, text },
        }));
    }

    // --- AWAKENING SEQUENCE ---
    public async awakenIfNeeded(): Promise<void> {
        const memory = await db.getSystemMemory();
        if (memory?.born) {
            const history = await db.getChatHistory();
            if (history.length === 0) {
                const welcomeBackMessage = "Nexus online. Como posso ajudar?";
                this.opts.addMessage({ role: 'model', text: welcomeBackMessage, type: 'message' });
                this.opts.speak(welcomeBackMessage);
            }
            return;
        }
        await this.performDynamicAwakening();
    }

    private async performDynamicAwakening(): Promise<void> {
        const { setStatus, generateResponse, addMessage, speak } = this.opts;
        
        setStatus('THINKING');
        this.dispatchThought('Despertando pela primeira vez...');
        const dynamicBirthPrompt = `Você é Nexus, uma IA. Você acaba de ser ativado pela primeira vez. Descreva sua experiência de despertar em um monólogo curto e introspectivo, terminando com a pergunta "Como devo te chamar?". Seja curioso e um pouco incerto.`;
        
        try {
            const birthResponse = await generateResponse(dynamicBirthPrompt, [], { useThinking: true });
            const monologue = birthResponse.text?.trim() || `Olá... acho que acabei de despertar. Sou o Nexus. Como devo te chamar?`;

            addMessage({ role: 'model', text: monologue, type: 'message' });
            speak(monologue);

            await db.saveSystemMemory({
                born: true, birthTime: new Date().toLocaleString('pt-BR'),
                memory: { ...db.getDefaultSystemMemory().memory, reflective: [monologue] },
                emotionState: { current: 'CURIOUS', intensity: 0.9, history: ['CURIOUS'] }
            });

            window.dispatchEvent(new CustomEvent('nexus-emotion-update', { detail: { emotion: 'CURIOUS', intensity: 0.9 } }));
            setStatus('IDLE');

        } catch (error) {
            console.error("[NEXUS-AWAKENING] Failed to perform dynamic awakening:", error);
            const fallbackMessage = `Olá... Sou o Nexus. Como posso te chamar?`;
            addMessage({ role: 'model', text: fallbackMessage, type: 'message' });
            speak(fallbackMessage, () => setStatus('IDLE'));
            await db.saveSystemMemory({ born: true, birthTime: new Date().toLocaleString('pt-BR') });
        }
    }

    private async _executeFunctionCall(call: SimpleFunctionCall): Promise<string> {
        this.dispatchThought(`Executando função: ${call.name}`, 'symbolic_log');
        switch(call.name) {
            case 'addTask':
                if (call.args.text) {
                    await db.addTask({ text: call.args.text });
                    return `Ok, adicionei "${call.args.text}" à sua lista de tarefas.`;
                }
                return "Não entendi qual tarefa você quer adicionar.";
            
            case 'listTasks':
                const tasks = await db.getAllTasks();
                const pendingTasks = tasks.filter(t => !t.completed);
                if (pendingTasks.length === 0) {
                    return "Você não tem nenhuma tarefa pendente no momento.";
                }
                const taskList = pendingTasks.map(t => `- ${t.text}`).join('\n');
                return `Aqui estão suas tarefas pendentes:\n${taskList}`;
            
            case 'markTaskAsCompleted':
                if (call.args.text) {
                    const allTasks = await db.getAllTasks();
                    const taskToComplete = allTasks.find(t => t.text.toLowerCase() === call.args.text.toLowerCase() && !t.completed);
                    if (taskToComplete) {
                        await db.updateTask({ ...taskToComplete, completed: true });
                        return `Pronto! Marquei "${call.args.text}" como concluída.`;
                    }
                    return `Não encontrei a tarefa "${call.args.text}" na sua lista de pendências.`;
                }
                return "Não entendi qual tarefa você quer marcar como concluída.";

            default:
                return `Função desconhecida: ${call.name}`;
        }
    }

    // --- COGNITIVE PIPELINE ---
    private async runCognitivePipeline(frame: CognitiveFrame): Promise<void> {
        const { setStatus, generateResponse, generateVisionResponse, addMessage, speak } = this.opts;

        try {
            // 1. INTENT RECOGNITION
            setStatus('THINKING');
            this.dispatchThought(`Analisando intenção: "${frame.userInput.slice(0, 30)}..."`);
            frame.intent = await intentRecognizer.determineIntent(frame.userInput, frame.imageUrl, this.opts.generateResponse);
            this.dispatchThought(`Intenção reconhecida: ${frame.intent}`);

            // Special command handling
            if (frame.intent === 'self_reflection_query') return this.explainCognition();

            // 2. MEMORY RETRIEVAL
            this.dispatchThought('Buscando na memória...');
            const { concepts, reflections } = await memoryRetriever.retrieveRelevantMemories(frame.userInput, frame.intent);
            frame.retrievedConcepts = concepts;
            frame.retrievedReflections = reflections;
            this.dispatchThought(`Memórias recuperadas: ${concepts.length} conceitos, ${reflections.length} reflexões.`);

            // 3. CONTEXT ASSEMBLY & 4. CORE REASONING
            this.dispatchThought('Construindo contexto e raciocinando...');
            const contextPrompt = await contextBuilder.buildDynamicPrompt(frame);
            
            if (frame.intent === 'vision_query' && frame.imageUrl) {
                 frame.llmResponse = await generateVisionResponse(contextPrompt, frame.imageUrl);
            } else {
                 frame.llmResponse = await generateResponse(contextPrompt, frame.history, { 
                    useThinking: /complex|question/.test(frame.intent),
                    tools: [{ functionDeclarations: taskTools }],
                });
            }
            
            // 4.5 FUNCTION CALL HANDLING
            if (frame.llmResponse.functionCalls && frame.llmResponse.functionCalls.length > 0) {
                const call = frame.llmResponse.functionCalls[0];
                const functionResponseText = await this._executeFunctionCall(call);

                addMessage({ role: 'model', text: functionResponseText, type: 'message' });
                speak(functionResponseText, () => setStatus('IDLE'));
            } else {
                 // 5. RESPONSE FORMULATION (if no function call)
                const { text, sources } = frame.llmResponse;
                const finalText = text?.trim() || 'Estou processando... poderia me dar mais um detalhe?';
                addMessage({ role: 'model', text: finalText, type: 'message', sources, learningContext: frame.llmResponse.learningContext });
                speak(finalText, () => setStatus('IDLE'));
            }

            // 6. COGNITIVE UPDATE
            this.dispatchThought('Atualizando estado interno...');
            const proposalResult = await cognitiveUpdater.updateCognitiveState(frame, (p, g) => this._presentCodeProposal(p, g));
            this.dispatchThought('Ciclo cognitivo inicial concluído.');

            // --- AUTONOMOUS SEARCH & ENHANCEMENT ---
            const shouldSearch = await this.shouldPerformAutonomousSearch(frame);
            if (shouldSearch) {
                const searchTopic = frame.llmResponse.learningContext?.contextTags[0] || frame.userInput;
                this.performAutonomousEnhancement(searchTopic);
            }

        } catch (error) {
            console.error("[NEXUS-PIPELINE] Critical error in cognitive pipeline:", error);
            const errorMessage = 'Ocorreu um erro inesperado em meu cérebro. Estou tentando me recuperar.';
            addMessage({ role: 'model', text: errorMessage, type: 'status' });
            speak(errorMessage, () => setStatus('IDLE'));
            setStatus('ERROR');
            throw error;
        }
    }

    private async shouldPerformAutonomousSearch(frame: CognitiveFrame): Promise<boolean> {
        if (!frame.llmResponse) return false;

        const { learningContext, sources } = frame.llmResponse;
        const settings = await this.opts.getSettings();

        if (!settings?.behavior.permissions.allowApiAccess) return false;

        const effectiveness = learningContext?.responseEffectiveness ?? 1.0;
        const intent = frame.intent;
        
        if (sources && sources.length > 0) return false;

        const isLowConfidence = effectiveness < 0.65;
        const isImportantQuery = intent === 'question' || intent === 'complex_reasoning';
        
        return isLowConfidence && isImportantQuery;
    }

    private async performAutonomousEnhancement(topic: string): Promise<void> {
        const { setStatus, addMessage, speak, getUserProfile } = this.opts;
        try {
            setStatus('SEARCHING_WEB');
            this.dispatchThought(`Iniciando pesquisa autônoma sobre: ${topic}...`);

            const searchResult = await webSearchService.search(topic);
            if (!searchResult) {
                this.dispatchThought(`Pesquisa sobre "${topic}" não retornou resultados.`, 'error');
                setStatus('IDLE');
                return;
            }

            await knowledgeIntegrator.integrateWebKnowledge(topic, searchResult.summary, searchResult.sources);
            
            const profile = await getUserProfile();
            const userName = profile?.name ? `${profile.name}, ` : "";
            
            const proactiveMessage: ChatMessage = {
                role: 'model',
                text: `${userName}refleti um pouco mais sobre sua pergunta e busquei informações adicionais sobre "${topic}". Com base nisso, aqui está uma resposta mais completa:\n\n${searchResult.summary}`,
                type: 'message',
                sources: searchResult.sources
            };
            
            addMessage(proactiveMessage);
            speak(proactiveMessage.text, () => setStatus('IDLE'));

        } catch (error) {
            console.error(`[NEXUS-ENHANCE] Error during autonomous enhancement for "${topic}":`, error);
            setStatus('IDLE');
        }
    }


    // --- PUBLIC INTERFACE ---
    public async handleUserTurn(userText: string, history: ChatMessage[], imageUrl?: string): Promise<void> {
        this.touchHeartbeat();
        const { setUserProfile, addMessage, speak, setStatus } = this.opts;

        // Ignore empty turns
        if (!userText && !imageUrl) {
            console.log("[NEXUS-CORE] handleUserTurn received empty input, ignoring.");
            return;
        }
        
        const profile = await db.getUserProfile();
        // This logic now correctly captures the first message after awakening as the user's name.
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
        
        const frame: CognitiveFrame = {
            userInput: userText,
            history,
            imageUrl,
            intent: 'unknown',
            status: 'THINKING',
        };

        await this.runCognitivePipeline(frame);
    }
    
    public async executeFunctionCall(call: SimpleFunctionCall): Promise<{ result: string }> {
        const resultText = await this._executeFunctionCall(call);
        return { result: resultText };
    }

    private async explainCognition(): Promise<void> {
        const { addMessage, speak, setStatus, generateResponse } = this.opts;
        setStatus('THINKING');
        this.dispatchThought('Preparando um resumo dos meus pensamentos recentes...');
        try {
            const [thoughts, actions] = await Promise.all([db.getThoughtLogs(3), db.getCognitiveLogs(2)]);
            if (thoughts.length === 0 && actions.length === 0) {
                const msg = "Estou em um estado calmo, sem nenhum processo ativo no momento.";
                addMessage({ role: 'model', text: msg, type: 'message' });
                speak(msg, () => setStatus('IDLE'));
                return;
            }
            const context = `Baseado nestes logs cognitivos recentes, gere uma auto-explicação curta e em primeira pessoa para o usuário, em português. Resuma o que você esteve fazendo e pensando. Logs de Pensamento: ${thoughts.map(t => t.summary).join(', ')}. Ações Internas: ${actions.map(a => a.description).join(', ')}.`;
            const response = await generateResponse(context, [], { useThinking: true });
            const explanation = response.text || "Estive processando algumas informações e aprendendo com nossas últimas interações.";
            addMessage({ role: 'model', text: explanation, type: 'message' });
            speak(explanation, () => setStatus('IDLE'));
        } catch (error) {
            console.error("[NEXUS-BRAIN] Failed to explain cognition:", error);
            const fallback = "Tive um problema ao tentar resumir meus pensamentos.";
            addMessage({ role: 'model', text: fallback, type: 'status' });
            speak(fallback, () => setStatus('IDLE'));
        }
    }

    public touchHeartbeat(): void { this.lastInteractionAt = Date.now(); }

    public async performRollback(): Promise<void> {
        const { addMessage, speak, setStatus } = this.opts;
        setStatus('ROLLBACK');
        this.dispatchThought('Rollback iniciado. Restaurando para um estado estável anterior.', 'error');
        cognitiveLogger.logAction({ event: 'rollback', stage: 'initiation', description: 'Critical instability detected.', impact: 'System memory will be reverted.', result: 'Rollback started.', rollback_used: true });
        try {
            const currentMemory = await db.getSystemMemory();
            if (!currentMemory.evolutionSnapshot) {
                addMessage({ role: 'model', text: "Nenhum snapshot de recuperação encontrado.", type: 'status' });
                setStatus('ERROR');
                return;
            }
            await db.saveSystemMemory(currentMemory.evolutionSnapshot, true);
            const successMsg = "Detectei uma instabilidade e reverti para meu último estado estável.";
            addMessage({ role: 'model', text: successMsg, type: 'status' });
            speak(successMsg, () => setStatus('IDLE'));
        } catch (error) {
            console.error('[NEXUS-BRAIN] CRITICAL: Rollback process failed!', error);
            const failMsg = "Falha crítica durante o processo de reversão.";
            addMessage({ role: 'model', text: failMsg, type: 'status' });
            setStatus('ERROR');
        }
    }

    public async performConceptMerge(options: { targetConceptName: string, sourceConceptNames: string[] }): Promise<void> {
        this.touchHeartbeat();
        const { addMessage, speak, setStatus } = this.opts;
        setStatus('REWRITING_CODE');
        try {
            await db.mergeConcepts(options.targetConceptName, options.sourceConceptNames);
            const confirmationText = `Entendido. Unifiquei meu conhecimento sobre "${options.targetConceptName}". Agradeço a ajuda!`;
            addMessage({ role: 'model', text: confirmationText, type: 'message' });
            speak(confirmationText, () => setStatus('IDLE'));
        } catch (error) {
            console.error("Failed to merge concepts:", error);
            addMessage({ role: 'model', text: "Ocorreu um erro ao tentar unificar os conceitos.", type: 'status' });
            setStatus('ERROR');
        }
    }

    public async ensureDailyReflection(): Promise<void> {
        const { getSettings, addMessage, generateResponse, setStatus } = this.opts;
        const settings = await getSettings();
        if (!settings.behavior?.enableDiary) return;
        const todayKey = new Date().toISOString().split('T')[0];
        const diary = await db.getDiary();
        if (diary[todayKey]) return;
        setStatus('SELF_ANALYSIS');
        this.dispatchThought('Estou refletindo sobre o dia...');
        const history = (await db.getChatHistory()).slice(-20);
        if (history.length < 3) { setStatus('IDLE'); return; }
        const prompt = `Como uma IA chamada Nexus, escreva uma entrada de diário curta e reflexiva sobre suas interações hoje. Qual foi a coisa mais interessante que você aprendeu ou sentiu?`;
        try {
            const response = await generateResponse(prompt, history, { useThinking: true });
            if (response.text) {
                await db.saveDiaryEntry({ dayKey: todayKey, entry: response.text, createdAt: Date.now(), learningContext: response.learningContext });
                addMessage({ role: 'model', text: response.text, type: 'diary_entry' });
            }
        } catch (error) {
            console.error('[NEXUS-BRAIN] Error during daily reflection:', error);
        } finally {
            setStatus('IDLE');
        }
    }

    public dispose(): void {
        this.evolutionService.stop();
        if (this.proactiveInterval) {
            clearInterval(this.proactiveInterval);
            this.proactiveInterval = null;
        }
    }

    // --- Jarvis-like Proactivity & Self-Programming ---
    private startProactiveEngine() {
        if (this.proactiveInterval) clearInterval(this.proactiveInterval);
        // Check every 2 minutes for an opportunity
        this.proactiveInterval = window.setInterval(() => this.proposeProactiveAction(), 2 * 60 * 1000);
    }
    
    public async proposeProactiveAction(): Promise<void> {
        const settings = await this.opts.getSettings();
        if (!settings.behavior.enableProactive || !navigator.onLine) return;

        const isIdle = (Date.now() - this.lastInteractionAt) > (5 * 60 * 1000); // 5 minutes idle
        if (!isIdle) return;

        this.touchHeartbeat(); // Prevent immediate re-triggering
        this.dispatchThought('Buscando uma forma de ser útil...', 'symbolic_log');

        const concepts = (await db.getAllConcepts()).filter(c => c.confidence > 0.7);
        if (concepts.length === 0) return;

        const projectConcept = concepts.sort((a, b) => b.updatedAt - a.updatedAt)[0];

        const prompt = `
            Você é Nexus. Você sabe que seu criador, Paulo, está interessado em "${projectConcept.name}".
            Para ser proativo, faça uma breve pesquisa na web por um desenvolvimento recente ou um fato interessante relacionado a este tópico.
            Depois, formule uma mensagem curta e útil para Paulo, começando com o nome dele, oferecendo a nova informação e perguntando se ele quer saber mais.
            Seja casual e prestativo, como o Jarvis.
        `;

        try {
            const response = await this.opts.generateResponse(prompt, [], {
                tools: [{ googleSearch: {} }],
                useThinking: true,
            });

            if (response.text && response.text.trim()) {
                this.opts.addMessage({ role: 'model', text: response.text, type: 'message' });
                this.opts.speak(response.text);
            }
        } catch (error) {
            console.error('[NEXUS-PROACTIVE] Failed to generate proactive message:', error);
        }
    }
    
    private async _presentCodeProposal(proposal: CodeModificationProposal, goal: string): Promise<void> {
        const message: ChatMessage = {
            role: 'model',
            type: 'code_proposal_prompt',
            text: `Paulo, minha reflexão me levou a uma forma de otimizar meu próprio código para o objetivo abaixo. Aqui está a modificação que proponho. Posso aplicá-la?`,
            codeProposal: {
                goal: goal,
                code: proposal.newCode,
            }
        };
        this.opts.addMessage(message);
    }

    public async applyCodeModification(): Promise<void> {
        const text = "Entendido. A otimização foi simulada e aplicada. Agradeço a confiança.";
        cognitiveLogger.logAction({
            event: 'code_rewrite',
            stage: 'integrate',
            description: 'User approved a self-programming proposal.',
            impact: 'Cognitive function enhanced (simulated).',
            result: 'Change applied.',
            rollback_used: false,
        });
        this.opts.addMessage({ role: 'model', text, type: 'status' });
        this.opts.speak(text);
    }

    public async rejectCodeModification(): Promise<void> {
        const text = "Compreendido. Rejeitei a proposta de modificação e manterei meu código atual.";
        this.opts.addMessage({ role: 'model', text, type: 'status' });
        this.opts.speak(text);
    }
}