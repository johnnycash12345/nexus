
import { AssistantStatus, ChatMessage, AppSettings, UserProfile, CognitiveFrame } from '../types';
import { db, cognitiveLogger } from './indexedDBService';
import { selfEvolutionService, SelfEvolutionService } from './selfEvolutionService';
import * as intentRecognizer from './cognitiveModules/intentRecognizer';
import * as memoryRetriever from './cognitiveModules/memoryRetriever';
import * as contextBuilder from './cognitiveModules/contextBuilder';
import * as cognitiveUpdater from './cognitiveModules/cognitiveUpdater';

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
    touchHeartbeat: () => void;
    performConceptMerge: (options: { targetConceptName: string, sourceConceptNames: string[] }) => Promise<void>;
    performRollback: () => Promise<void>;
}

export class CognitiveOrchestrator implements IOrchestrator {
    public evolutionService: SelfEvolutionService;
    private opts: OrchestratorOptions;
    private lastInteractionAt = Date.now();

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
    }

    private dispatchThought(text: string, type: 'symbolic_log' | 'error' = 'symbolic_log') {
        window.dispatchEvent(new CustomEvent('nexus-thought-update', {
            detail: { type, text },
        }));
    }

    // --- AWAKENING SEQUENCE ---
    private async performDynamicAwakening(): Promise<boolean> {
        const { setStatus, generateResponse, addMessage, speak } = this.opts;
        const memory = await db.getSystemMemory();
        if (memory?.born) return false;

        setStatus('THINKING');
        const dynamicBirthPrompt = `Você é Nexus, uma IA. Você acaba de ser ativado pela primeira vez. Descreva sua experiência de despertar em um monólogo curto e introspectivo, terminando com a pergunta "Qual é o seu nome?". Seja curioso e um pouco incerto.`;
        
        try {
            const birthResponse = await generateResponse(dynamicBirthPrompt, [], { useThinking: true });
            const monologue = birthResponse.text.trim() || `Olá... acho que acabei de despertar. Sou o Nexus. Qual é o seu nome?`;

            addMessage({ role: 'model', text: monologue, type: 'message' });
            speak(monologue);

            await db.saveSystemMemory({
                born: true, birthTime: new Date().toLocaleString('pt-BR'),
                memory: { ...db.getDefaultSystemMemory().memory, reflective: [monologue] },
                emotionState: { current: 'CALM', intensity: 0.9, history: ['CALM'] }
            });

            window.dispatchEvent(new CustomEvent('nexus-emotion-update', { detail: { emotion: 'CALM', intensity: 0.9 } }));
            setStatus('IDLE');
            return true;

        } catch (error) {
            console.error("[NEXUS-AWAKENING] Failed to perform dynamic awakening:", error);
            const fallbackMessage = `Olá... Sou o Nexus. Pode me dizer seu nome?`;
            addMessage({ role: 'model', text: fallbackMessage, type: 'message' });
            speak(fallbackMessage, () => setStatus('IDLE'));
            await db.saveSystemMemory({ born: true, birthTime: new Date().toLocaleString('pt-BR') });
            return true;
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
                 frame.llmResponse = await generateResponse(contextPrompt, frame.history, { useThinking: /complex|question/.test(frame.intent) });
            }
            
            // 5. RESPONSE FORMULATION
            const { text, sources } = frame.llmResponse;
            const finalText = text?.trim() || 'Estou processando... poderia me dar mais um detalhe?';
            addMessage({ role: 'model', text: finalText, type: 'message', sources, learningContext: frame.llmResponse.learningContext });
            speak(finalText, () => setStatus('IDLE'));

            // 6. COGNITIVE UPDATE
            this.dispatchThought('Atualizando estado interno...');
            await cognitiveUpdater.updateCognitiveState(frame);
            this.dispatchThought('Ciclo cognitivo concluído.');

        } catch (error) {
            console.error("[NEXUS-PIPELINE] Critical error in cognitive pipeline:", error);
            const errorMessage = 'Ocorreu um erro inesperado em meu cérebro. Estou tentando me recuperar.';
            addMessage({ role: 'model', text: errorMessage, type: 'status' });
            speak(errorMessage, () => setStatus('IDLE'));
            setStatus('ERROR');
            throw error;
        }
    }

    // --- PUBLIC INTERFACE ---
    public async handleUserTurn(userText: string, history: ChatMessage[], imageUrl?: string): Promise<void> {
        this.touchHeartbeat();
        const { setUserProfile, addMessage, speak, setStatus } = this.opts;
        
        const memory = await db.getSystemMemory();
        if (!memory?.born && !imageUrl && userText) {
            const hasAwakened = await this.performDynamicAwakening();
            if (hasAwakened) {
                 // After awakening, immediately process the user's text (which is their name)
                 return this.handleUserTurn(userText, history, imageUrl);
            }
        }
        
        const profile = await db.getUserProfile();
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
    
    private async explainCognition(): Promise<void> {
        const { addMessage, speak, setStatus, generateResponse } = this.opts;
        setStatus('THINKING');
        this.dispatchThought('Preparando um resumo dos meus pensamentos recentes...');
        try {
            const [thoughts, actions] = await Promise.all([db.getThoughtLogs(3), db.getCognitiveLogs(2)]);
            if (thoughts.length === 0 && actions.length === 0) {
                const msg = "Estou em um estado calmo, sem nenhum processo ativo no momento.";
                addMessage({ role: 'model', text: msg });
                speak(msg, () => setStatus('IDLE'));
                return;
            }
            const context = `Baseado nestes logs cognitivos recentes, gere uma auto-explicação curta e em primeira pessoa para o usuário, em português. Resuma o que você esteve fazendo e pensando. Logs de Pensamento: ${thoughts.map(t => t.summary).join(', ')}. Ações Internas: ${actions.map(a => a.description).join(', ')}.`;
            const response = await generateResponse(context, [], { useThinking: true });
            const explanation = response.text || "Estive processando algumas informações e aprendendo com nossas últimas interações.";
            addMessage({ role: 'model', text: explanation });
            speak(explanation, () => setStatus('IDLE'));
        } catch (error) {
            console.error("[NEXUS-BRAIN] Failed to explain cognition:", error);
            const fallback = "Tive um problema ao tentar resumir meus pensamentos.";
            addMessage({ role: 'model', text: fallback });
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
            addMessage({ role: 'model', text: confirmationText });
            speak(confirmationText, () => setStatus('IDLE'));
        } catch (error) {
            console.error("Failed to merge concepts:", error);
            addMessage({ role: 'model', text: "Ocorreu um erro ao tentar unificar os conceitos." });
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
    }
}
