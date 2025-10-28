import { AssistantStatus, ChatMessage, AppSettings, UserProfile, CognitiveFrame, SimpleFunctionCall, CodeModificationProposal, UserContext, UserRole, OrchestratorOptions } from '@/types';
import { db, cognitiveLogger } from './indexedDBService';
import { selfEvolutionService, SelfEvolutionService } from './selfEvolutionService';
import * as intentRecognizer from './cognitiveModules/intentRecognizer';
import * as contextBuilder from './cognitiveModules/contextBuilder';
import * as cognitiveUpdater from './cognitiveModules/cognitiveUpdater';
import { AgentManager } from './agents/agentManager';
import { projectManager } from './projectManager';
import { schedulerService } from './schedulerService';

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
        try {
            setStatus('THINKING');
            frame.intent = await intentRecognizer.determineIntent(frame.userInput, frame.imageUrl, this.opts.generateResponse);
            this.dispatchThought(`Intenção: ${frame.intent}`);

            if (frame.intent === 'project_start') {
                const projectName = frame.userInput.replace(/^(construir|criar|gerenciar|iniciar projeto|projeto)\s*/i, '');
                await projectManager.startProject(projectName, frame.userInput, this.userContext);
                const confirmation = `Entendido. Iniciei o projeto "${projectName}". Vou decompô-lo em tarefas e começar a trabalhar. Manterei você atualizado.`;
                addMessage({ role: 'model', text: confirmation, type: 'message' });
                speak(confirmation, () => setStatus('IDLE'));
                return;
            }

            // Delegate to the appropriate agent
            const agentResponse = await this.agentManager.delegateTask(frame);

            if (agentResponse) {
                addMessage(agentResponse);
                if (agentResponse.type !== 'status') speak(agentResponse.text);
            }

            // Cognitive update runs after delegation
            await cognitiveUpdater.updateCognitiveState(frame, (p, g) => this.presentCodeProposal(p, g), this.agentManager.emotionalAgent);

        } catch (error) {
            console.error("[NEXUS-PIPELINE] Error:", error);
            const errorMessage = 'Ocorreu um erro em meu cérebro. Estou me recuperando.';
            addMessage({ role: 'model', text: errorMessage, type: 'status' });
            speak(errorMessage, () => setStatus('IDLE'));
            setStatus('ERROR');
        } finally {
            if (status !== 'SPEAKING' && status !== 'LISTENING') setStatus('IDLE');
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
