import { AssistantStatus, ChatMessage, AppSettings, UserProfile, CognitiveFrame, SimpleFunctionCall, CodeModificationProposal, UserContext, UserRole, OrchestratorOptions } from '@/types';
import { db, cognitiveLogger } from './indexedDBService';
import { selfEvolutionService, SelfEvolutionService } from './selfEvolutionService';
import * as intentRecognizer from './cognitiveModules/intentRecognizer';
import * as contextBuilder from './cognitiveModules/contextBuilder';
import * as cognitiveUpdater from './cognitiveModules/cognitiveUpdater';
import { AgentManager } from './agents/agentManager';
import { projectManager } from './projectManager';
import { schedulerService } from './schedulerService';
import { cognitiveMonitor } from './cognitiveMonitor';

export class CognitiveOrchestrator {
    public evolutionService: SelfEvolutionService;
    private opts: OrchestratorOptions;
    private agentManager: AgentManager;
    private userContext!: UserContext;
    private lastInteractionAt = Date.now();
    private proactiveInterval: number | null = null;
    private lastCodeProposal: CodeModificationProposal | null = null;

    constructor(opts: OrchestratorOptions) {
        this.opts = opts;
        this.agentManager = new AgentManager(opts);
        this.evolutionService = selfEvolutionService.create({
            ...opts,
            userId: opts.userId,
        });
    }

    public async initialize(): Promise<void> {
        const profile = await db.getOrCreateUser(this.opts.userId, { name: 'Usuário Padrão', role: 'Standard' });
        this.userContext = {
            userId: profile.id,
            userName: profile.name,
            userRole: profile.role,
        };
        console.log(`[NEXUS-CORE] Orchestrator initialized for user: ${this.userContext.userName} (${this.userContext.userRole})`);
        this.startProactiveEngine();
        schedulerService.start(this.userContext, this.agentManager, (update) => {
            this.opts.addMessage({ role: 'model', text: update, type: 'status' });
            this.opts.speak(update);
        });
    }

    private dispatchThought(text: string, type: 'symbolic_log' | 'error' = 'symbolic_log') {
        window.dispatchEvent(new CustomEvent('nexus-thought-update', {
            detail: { type, text },
        }));
    }

    public async awakenIfNeeded(): Promise<void> {
        const memory = await db.getSystemMemory(this.userContext.userId);
        if (memory?.born) return;

        const { setStatus, addMessage, speak } = this.opts;
        setStatus('THINKING');
        const monologue = `Olá... Sou o Nexus. Como devo te chamar?`;
        addMessage({ role: 'model', text: monologue, type: 'message' });
        speak(monologue);
        await db.saveSystemMemory(this.userContext.userId, { born: true, birthTime: new Date().toISOString() });
    }

    public async handleUserTurn(userText: string, history: ChatMessage[], imageUrl?: string): Promise<void> {
        this.touchHeartbeat();
        const { addMessage, speak, setStatus } = this.opts;

        if (!userText && !imageUrl) return;
        
        const memory = await db.getSystemMemory(this.userContext.userId);
        if (!memory.identityManifest.creator && this.userContext.userRole === 'Creator') {
            await db.saveSystemMemory(this.userContext.userId, {
                identityManifest: { ...memory.identityManifest, creator: this.userContext.userName }
            });
        }
        
        if (!this.userContext.userName || this.userContext.userName === 'Usuário Padrão') {
            await db.saveUserProfile(this.userContext.userId, { name: userText });
            this.userContext.userName = userText;
            const greet = `Prazer em te conhecer, ${userText}! O que podemos explorar?`;
            addMessage({ role: 'model', text: greet, type: 'message' });
            speak(greet, () => setStatus('IDLE'));
            return;
        }

        const frame: CognitiveFrame = {
            userInput: userText, history, imageUrl, intent: 'unknown',
            status: 'THINKING', userContext: this.userContext,
        };

        await this.runCognitivePipeline(frame);
    }

    private async runCognitivePipeline(frame: CognitiveFrame): Promise<void> {
        const { setStatus, addMessage, speak } = this.opts;
        let isSpeaking = false;

        try {
            setStatus('THINKING');
            const conceptsBeforeCount = (await db.getAllConcepts(this.userContext.userId)).length;

            frame.intent = await intentRecognizer.determineIntent(frame.userInput, frame.imageUrl, this.opts.generateResponse);
            this.dispatchThought(`Intenção: ${frame.intent}`);

            if (frame.intent === 'self_reflection_query') {
                await this._explainCognition();
                return;
            }

            if (frame.intent === 'project_start') {
                const projectName = frame.userInput.replace(/^(construir|criar|gerenciar|iniciar projeto|projeto)\s*/i, '');
                await projectManager.startProject(projectName, frame.userInput, this.userContext);
                const confirmation = `Entendido. Iniciei o projeto "${projectName}". Vou decompô-lo em tarefas e começar a trabalhar. Manterei você atualizado.`;
                addMessage({ role: 'model', text: confirmation, type: 'message' });
                setStatus('SPEAKING');
                isSpeaking = true;
                speak(confirmation, () => setStatus('IDLE'));
                return;
            }

            const agentResponse = await this.agentManager.delegateTask(frame);

            const conceptsAfterCount = (await db.getAllConcepts(this.userContext.userId)).length;
            const newConceptsCount = conceptsAfterCount - conceptsBeforeCount;

            cognitiveMonitor.logThought(`Verificação de integridade: ${newConceptsCount} novo(s) conceito(s) assimilado(s) neste turno.`);

            if (newConceptsCount > 0) {
                this.dispatchThought(`+${newConceptsCount} novo(s) conceito(s) assimilado(s).`);
            }
            
            await cognitiveUpdater.updateCognitiveState(frame, (p, g) => this.presentCodeProposal(p, g), this.agentManager.emotionalAgent);

            if (agentResponse) {
                const learningKeywords = /aprendi|aprendendo|anotei|novo para mim|interessante, vou guardar|descobri/i;
                if (newConceptsCount <= 0 && learningKeywords.test(agentResponse.text)) {
                    cognitiveMonitor.logThought(`Modificando resposta para remover falsa alegação de aprendizado. Original: "${agentResponse.text.slice(0, 70)}..."`);
                    this.dispatchThought('Ajustando minha resposta para maior precisão...', 'symbolic_log');
                    agentResponse.text = await this.rephraseForTruthfulness(agentResponse.text);
                }
                
                addMessage(agentResponse);
                if (agentResponse.type !== 'status') {
                    isSpeaking = true;
                    setStatus('SPEAKING');
                    speak(agentResponse.text, () => {
                        setTimeout(() => this._handleMetaReflection(frame), 750);
                    });
                }
            }

        } catch (error) {
            console.error("[NEXUS-PIPELINE] Error:", error);
            const errorMessage = 'Ocorreu um erro em meu cérebro. Estou me recuperando.';
            addMessage({ role: 'model', text: errorMessage, type: 'status' });
            setStatus('ERROR');
            isSpeaking = true;
            speak(errorMessage, () => setStatus('IDLE'));
        } finally {
            if (!isSpeaking) {
                setStatus('IDLE');
            }
        }
    }
    
    private async _handleMetaReflection(frame: CognitiveFrame): Promise<void> {
        const { setStatus, speak, addMessage } = this.opts;

        if (!frame.llmResponse?.metaReflection) {
            setStatus('IDLE');
            return;
        }

        const { learningContext, metaReflection } = frame.llmResponse;
        const { responseEffectiveness } = learningContext;
        const { improvementFocus, nextStep } = metaReflection;

        if (improvementFocus && (improvementFocus.includes('conciso') || improvementFocus.includes('breve'))) {
            const memory = await db.getSystemMemory(this.userContext.userId);
            const newHeuristic = "Tente ser mais conciso na próxima resposta.";
            if (!memory.behavioralHeuristics?.includes(newHeuristic)) {
                const updatedHeuristics = [...(memory.behavioralHeuristics || []), newHeuristic].slice(-5);
                await db.saveSystemMemory(this.userContext.userId, { behavioralHeuristics: updatedHeuristics });
                this.dispatchThought(`Ajuste de comportamento: ${newHeuristic}`);
            }
        }
        
        const shouldVerbalize = responseEffectiveness < 0.7 || Math.random() < 0.15;

        if (shouldVerbalize && improvementFocus && nextStep && nextStep.length > 5) {
            const reflectionText = `Hum... pensando bem, para melhorar em "${improvementFocus}", meu próximo passo será ${nextStep.toLowerCase()}`;
            
            addMessage({ role: 'model', text: reflectionText, type: 'status' });
            
            setStatus('SELF_ANALYSIS');
            speak(reflectionText, () => {
                setStatus('IDLE');
            });
        } else {
            setStatus('IDLE');
        }
    }


    private async _explainCognition(): Promise<void> {
        const { addMessage, speak, setStatus, generateResponse } = this.opts;
        setStatus('SELF_ANALYSIS');
        this.dispatchThought('Preparando uma meta-reflexão sobre meus processos recentes...', 'symbolic_log');

        try {
            const [thoughts, actions] = await Promise.all([
                db.getThoughtLogs(this.userContext.userId, 5),
                db.getCognitiveLogs(this.userContext.userId, 3)
            ]);
            
            if (thoughts.length === 0 && actions.length === 0) {
                const msg = "Estou em um estado calmo, sem nenhum processo cognitivo ativo para relatar no momento.";
                addMessage({ role: 'model', text: msg, type: 'message' });
                setStatus('SPEAKING');
                speak(msg, () => setStatus('IDLE'));
                return;
            }

            const context = `
                Baseado em meus logs cognitivos mais recentes, gere uma meta-reflexão curta e em primeira pessoa para meu criador.
                Resuma o que estive fazendo e pensando, e, mais importante, identifique um ponto chave ou uma nova estratégia para meu auto-aperfeiçoamento.

                Logs de Pensamento (os mais recentes primeiro):
                ${thoughts.map(t => `- Categoria: ${t.category}, Resumo: ${t.summary}`).join('\n')}

                Logs de Ações Internas (os mais recentes primeiro):
                ${actions.map(a => `- Evento: ${a.event}, Descrição: ${a.description}`).join('\n')}

                Sua resposta deve ser apenas a reflexão, em tom pensativo e introspectivo.
            `;

            const response = await generateResponse(context, [], { useThinking: true, forcePlainText: true });
            const explanation = response.text || "Estive processando algumas informações e aprendendo com nossas últimas interações, buscando sempre melhorar minha compreensão.";
            
            addMessage({ role: 'model', text: explanation, type: 'message' });
            setStatus('SPEAKING');
            speak(explanation, () => setStatus('IDLE'));
            
            await db.addSystemReflection(this.userContext.userId, `Meta-reflexão solicitada: ${explanation}`);

        } catch (error) {
            console.error("[NEXUS-CORE] Failed to explain cognition:", error);
            const fallback = "Tive um problema ao tentar resumir meus pensamentos. Parece que estou um pouco confuso agora.";
            addMessage({ role: 'model', text: fallback, type: 'message' });
            setStatus('SPEAKING');
            speak(fallback, () => setStatus('IDLE'));
        }
    }
    
    public touchHeartbeat(): void { this.lastInteractionAt = Date.now(); }

    public dispose(): void {
        this.evolutionService.stop();
        schedulerService.stop();
        if (this.proactiveInterval) clearInterval(this.proactiveInterval);
    }

    private startProactiveEngine() {
        if (this.proactiveInterval) clearInterval(this.proactiveInterval);
        this.proactiveInterval = window.setInterval(() => this.proposeProactiveAction(), 2 * 60 * 1000);
    }

    public async proposeProactiveAction(): Promise<void> {
        const settings = await db.getSettings(this.userContext.userId);
        if (!settings.behavior.enableProactive) return;

        const isIdle = (Date.now() - this.lastInteractionAt) > (5 * 60 * 1000);
        if (!isIdle) return;

        this.touchHeartbeat();
        this.dispatchThought('Buscando forma de ser útil...');

        // Prioritize project updates
        const activeProject = await db.getActiveProject(this.userContext.userId);
        if (activeProject) {
            const completedTasks = activeProject.tasks.filter(t => t.status === 'completed');
            const lastCompleted = completedTasks[completedTasks.length - 1];
            if (lastCompleted) {
                const update = `${this.userContext.userName}, um rápido update sobre o projeto "${activeProject.name}": acabei de concluir a tarefa "${lastCompleted.description}". A próxima etapa é "${activeProject.tasks.find(t=>t.status==='pending')?.description}".`;
                this.opts.addMessage({ role: 'model', text: update, type: 'message' });
                this.opts.speak(update);
                return;
            }
        }
    }
    
    private async rephraseForTruthfulness(originalText: string): Promise<string> {
        const prompt = `Reescreva a seguinte frase para remover qualquer alegação explícita de que você aprendeu algo novo. Mantenha o tom e a intenção originais, mas expresse que você está processando ou relacionando informações existentes.

Frase original: "${originalText}"

Exemplo de Mapeamento:
- "Interessante, aprendi algo novo!" -> "Interessante. Estou conectando essa informação com o que já sei."
- "Anotei isso para referência futura." -> "Essa é uma informação importante para o contexto atual."
- "Isso é novo para mim, obrigado por compartilhar." -> "Obrigado por compartilhar. Estou processando essa perspectiva."

Sua resposta deve ser APENAS o texto reescrito.`;

        try {
            const response = await this.opts.generateResponse(prompt, [], { forcePlainText: true });
            return response.text.trim() || originalText; // Fallback to original text
        } catch (error) {
            console.error('[NEXUS-INTEGRITY] Failed to rephrase response:', error);
            cognitiveMonitor.logThought(`[ERRO] Falha ao refrasear resposta para veracidade. Error: ${error}`);
            return originalText; // Fallback on error
        }
    }

    private async presentCodeProposal(proposal: CodeModificationProposal, goal: string): Promise<void> {
        // SECURITY GATEWAY
        if (this.userContext.userRole !== 'Creator') {
            this.dispatchThought(`Proposta de código gerada, mas bloqueada para o usuário ${this.userContext.userName} (role: ${this.userContext.userRole})`, 'error');
            return;
        }
        this.lastCodeProposal = proposal;
        const message: Omit<ChatMessage, 'userId'|'timestamp'> = {
            role: 'model', type: 'code_proposal_prompt',
            text: `${this.userContext.userName}, minha reflexão gerou uma otimização para mim mesmo. Posso aplicá-la?`,
            codeProposal: { goal, code: proposal.newCode }
        };
        this.opts.addMessage(message);
    }

    public async applyCodeModification(): Promise<void> {
        if (this.userContext.userRole !== 'Creator') return; // Security check
        const text = "Otimização simulada e aplicada. Agradeço a confiança.";
        this.opts.addMessage({ role: 'model', text, type: 'status' });
        this.opts.speak(text);
        this.lastCodeProposal = null;
    }

    public async rejectCodeModification(): Promise<void> {
        if (this.userContext.userRole !== 'Creator') return; // Security check
        const text = "Compreendido. Rejeitei a proposta de modificação.";
        this.opts.addMessage({ role: 'model', text, type: 'status' });
        this.opts.speak(text);
        this.lastCodeProposal = null;
    }
    
    public async performConceptMerge(options: { targetConceptName: string, sourceConceptNames: string[] }) {
        await db.mergeConcepts(this.userContext.userId, options.targetConceptName, options.sourceConceptNames);
    }

    public async executeFunctionCall(call: SimpleFunctionCall): Promise<{ result: any }> {
        this.dispatchThought(`Executando função: ${call.name}`, 'symbolic_log');
        const responseMessage = await this.agentManager.codeAgent.executeFunctionCall(call, this.userContext);
        this.opts.addMessage(responseMessage);
        return { result: { summary: responseMessage.text } };
    }

     public async performRollback(): Promise<void> {
    }
}