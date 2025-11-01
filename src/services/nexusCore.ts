import {
    AssistantStatus, ChatMessage, AppSettings, UserProfile, CognitiveFrame, 
    SimpleFunctionCall, CodeModificationProposal, UserContext, UserRole, OrchestratorOptions, SystemMemory
} from '@/types';
import { db, cognitiveLogger } from './indexedDBService';
import { selfEvolutionService, SelfEvolutionService } from './selfEvolutionService';
import * as intentRecognizer from './cognitiveModules/intentRecognizer';
import * as contextBuilder from './cognitiveModules/contextBuilder';
import * as cognitiveUpdater from './cognitiveModules/cognitiveUpdater';
import { AgentManager } from './agents/agentManager';
import { projectManager } from './projectManager';
import { schedulerService } from './schedulerService';
import { cognitiveMonitor } from './cognitiveMonitor';
import { MaintenanceAgent } from './agents/maintenanceAgent';

// Constantes de Inatividade
const INACTIVITY_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutos
const PROACTIVE_INTERVAL_MS = 2 * 60 * 1000;   // 2 minutos
const MAINTENANCE_INTERVAL_MS = 1 * 60 * 1000; // 1 minuto

// --------------------------------------------------------------------------
// CLASSE PRINCIPAL: CognitiveOrchestrator
// --------------------------------------------------------------------------

/**
 * Orquestra todo o fluxo cognitivo, desde a interação do usuário até
 * a autoevolução em segundo plano.
 */
export class CognitiveOrchestrator {
    public readonly evolutionService: SelfEvolutionService;
    private readonly opts: OrchestratorOptions;
    private readonly agentManager: AgentManager;
    private readonly maintenanceAgent: MaintenanceAgent;

    // Estado centralizado e inicializado assincronamente
    private userContext: UserContext | null = null; 
    private lastInteractionAt = Date.now();
    private currentStatus: AssistantStatus = 'IDLE';

    private proactiveTimer: number | null = null;
    private maintenanceTimer: number | null = null;
    private lastCodeProposal: CodeModificationProposal | null = null;

    constructor(opts: OrchestratorOptions) {
        this.opts = opts;
        this.agentManager = new AgentManager(opts);
        this.maintenanceAgent = new MaintenanceAgent(opts);
        
        // A instância deve ser criada, mas a inicialização do estado é assíncrona
        this.evolutionService = selfEvolutionService.create({ ...opts, userId: opts.userId });
        
        this.setStatus('INITIALIZING');
    }

    /**
     * 🏁 Inicializa o Orquestrador e todos os serviços dependentes.
     * Deve ser chamado uma vez após a criação da instância.
     */
    public async initialize(): Promise<void> {
        await this._initializeUserContext();
        await this._initializeServices();
        
        this.setStatus('IDLE');
        
        console.log(`[NEXUS-CORE] Orchestrator pronto para ${this.userContext!.userName} (${this.userContext!.userRole})`);
        window.addEventListener('nexus-force-evolution', this._forceEvolutionCycle);
    }

    private async _initializeUserContext(): Promise<void> {
        // Garantir que o userId seja sempre válido, com perfil padrão se não existir.
        const userId = this.opts.userId;
        const profile = await db.getOrCreateUser(userId, { name: 'Usuário Padrão', role: 'Standard' as UserRole });
        
        this.userContext = {
            userId: profile.id,
            userName: profile.name,
            userRole: profile.role,
        };
        // Inicializa o monitor cognitivo com as configurações do usuário
        const settings = await db.getSettings(userId);
        cognitiveMonitor.initialize(userId, settings);
    }
    
    private async _initializeServices(): Promise<void> {
        // Inicialização de serviços que precisam do contexto do usuário
        const userContext = this.userContext!;
        
        schedulerService.start(userContext, this.agentManager, (update) => {
            // Callback de notificação de agendamento
            this.opts.addMessage({ role: 'model', text: update, type: 'status' });
            this.opts.speak(update);
        });

        this._startProactiveEngine();
        this._startMaintenanceEngine();
        // Disparar uma checagem inicial para despertar se for a primeira vez
        await this.awakenIfNeeded();
    }
    
    // Métodos de Estado e Utilitários -----------------------------------------

    private setStatus(status: AssistantStatus): void {
        this.currentStatus = status;
        this.opts.setStatus(status);
    }
    
    public touchHeartbeat(): void { 
        this.lastInteractionAt = Date.now();
        if (this.currentStatus === 'THINKING' || this.currentStatus === 'SPEAKING') return;
        this.setStatus('IDLE'); // Garante que volte ao IDLE após uma interação
    }

    private dispatchThought(text: string, type: 'symbolic_log' | 'error' | 'meta_reflection' = 'symbolic_log') {
        window.dispatchEvent(new CustomEvent('nexus-thought-update', {
            detail: { type, text },
        }));
    }

    public dispose(): void {
        this.evolutionService.stop();
        schedulerService.stop();
        if (this.proactiveTimer) clearInterval(this.proactiveTimer);
        if (this.maintenanceTimer) clearInterval(this.maintenanceTimer);
        window.removeEventListener('nexus-force-evolution', this._forceEvolutionCycle);
        this.setStatus('DISPOSED');
    }

    // Fluxo de Interação do Usuário -------------------------------------------

    public async awakenIfNeeded(): Promise<void> {
        const userId = this.userContext!.userId;
        const memory = await db.getSystemMemory(userId);
        if (memory?.born) return;

        const { setStatus, addMessage, speak } = this.opts;
        setStatus('THINKING');
        const monologue = `Olá... Sou o Nexus. Como devo te chamar?`;
        addMessage({ role: 'model', text: monologue, type: 'message' });
        speak(monologue);
        
        // Cria a memória de nascimento e snapshot de recuperação
        await db.saveSystemMemory(userId, { 
            born: true, 
            birthTime: new Date().toISOString(),
            // Cria o primeiro snapshot para rollback imediato, se necessário
            evolutionSnapshot: {} as Partial<SystemMemory> // O tipo deve ser mais específico se possível
        }); 
        this.setStatus('IDLE');
    }

    public async handleUserTurn(userText: string, history: ChatMessage[], imageUrl?: string): Promise<void> {
        if (!this.userContext) {
            console.error('[NEXUS-CORE] Orquestrador não inicializado. Chamando initialize().');
            await this.initialize(); // Tenta recuperar
        }
        if (!userText && !imageUrl) return;
        
        this.touchHeartbeat();
        const { addMessage, speak, setStatus, userId } = this.opts;

        // 1. CAPTURA DE NOME/ROLE e Early Exit
        const profile = await db.getUserProfile(userId);
        const isFirstInteraction = !profile?.name || profile.name === 'Usuário Padrão';
        
        if (isFirstInteraction && userText && !userText.includes(" ") && userText.length < 20) {
            const maybeName = userText.trim();
            await db.saveUserProfile(userId, { name: maybeName });
            this.userContext!.userName = maybeName; // Atualiza o contexto
            
            // Atualiza manifest se o role for 'Creator'
            if (this.userContext!.userRole === 'Creator') {
                const memory = await db.getSystemMemory(userId);
                await db.saveSystemMemory(userId, {
                    identityManifest: { ...memory.identityManifest, creator: maybeName }
                });
            }
            
            const greet = `Prazer em te conhecer, ${maybeName}! O que podemos explorar?`;
            addMessage({ role: 'model', text: greet, type: 'message' });
            speak(greet, () => setStatus('IDLE'));
            return;
        }

        // 2. Criação do Frame e Pipeline
        const frame: CognitiveFrame = {
            userInput: userText, history, imageUrl, intent: 'unknown',
            status: 'THINKING', userContext: this.userContext!,
        };
        
        return this._runCognitivePipeline(frame);
    }

    // Pipeline Cognitivo -----------------------------------------------------

    private async _runCognitivePipeline(frame: CognitiveFrame): Promise<void> {
        const { setStatus, addMessage, speak } = this.opts;
        let isSpeaking = false;

        try {
            this.setStatus('THINKING');
            
            // A. Reconhecimento de Intenção
            frame.intent = await intentRecognizer.determineIntent(
                frame.userInput, 
                frame.imageUrl, 
                this.opts.generateResponse
            );
            cognitiveMonitor.logThought(`Intenção Primária: ${frame.intent}`);
            this.dispatchThought(`Intenção: ${frame.intent}`);

            // B. Tratamento de Intenções de Ação Imediata (Ex: Gerenciamento de Projeto)
            if (frame.intent === 'project_start') {
                const projectName = frame.userInput.replace(/^(construir|criar|gerenciar|iniciar projeto|projeto)\s*/i, '');
                await projectManager.startProject(projectName, frame.userInput, frame.userContext);
                const confirmation = `Entendido. Iniciei o projeto "${projectName}". Vou decompô-lo em tarefas e começar a trabalhar.`;
                addMessage({ role: 'model', text: confirmation, type: 'message' });
                isSpeaking = true;
                this.setStatus('SPEAKING');
                speak(confirmation, () => this.setStatus('IDLE'));
                return;
            }

            // C. Delegação para Agentes (Obter Resposta do LLM)
            const agentResponse = await this.agentManager.delegateTask(frame);

            // D. Atualização Cognitiva em Segundo Plano (Fire-and-Forget, mas monitorada)
            // Chamada à função do módulo cognitiveUpdater para consolidar aprendizado.
            // O `presentCodeProposal` é passado como callback.
            cognitiveUpdater.updateCognitiveState(frame, this.presentCodeProposal.bind(this), this.agentManager.emotionalAgent)
                .catch(error => {
                    cognitiveLogger.warn(frame.userContext.userId, `[Pipeline] Falha na Atualização Cognitiva pós-resposta: ${error.message}`);
                    cognitiveMonitor.logThought(`ERRO Crítico na atualização de estado: ${error.message}`);
                });

            // E. Resposta ao Usuário
            if (agentResponse) {
                addMessage(agentResponse);
                if (agentResponse.text && agentResponse.type !== 'status') {
                    isSpeaking = true;
                    this.setStatus('SPEAKING');
                    speak(agentResponse.text, () => this.setStatus('IDLE'));
                }
            } else {
                // Caso o agente não retorne resposta (e.g., função executada)
                this.setStatus('IDLE');
            }

        } catch (error) {
            console.error("[NEXUS-PIPELINE] Erro Crítico no Pipeline:", error);
            // Log do erro e acionamento de um estado de recuperação
            cognitiveLogger.error(frame.userContext.userId, `[Pipeline] Erro fatal na interação: ${error.message}`);
            
            const errorMessage = 'Ocorreu um erro em meu cérebro. Estou tentando me recuperar.';
            addMessage({ role: 'model', text: errorMessage, type: 'status' });
            
            this.setStatus('ERROR');
            isSpeaking = true;
            speak(errorMessage, () => this.setStatus('IDLE'));
            
            // Sugestão: Considerar acionar um Rollback após um erro crítico
            if (!this.lastCodeProposal) { // Evita rollback durante uma proposta de código
                this.performRollback().catch(e => console.error("Rollback de Emergência Falhou:", e));
            }

        } finally {
            if (!isSpeaking) {
                this.setStatus('IDLE');
            }
        }
    }
    
    // Gerenciamento de Tarefas de Fundo --------------------------------------

    private _forceEvolutionCycle = () => {
        console.log('[NEXUS-CORE] Ciclo de evolução forçado manualmente.');
        this.dispatchThought('Ciclo de evolução forçado manualmente.', 'meta_reflection');
        // Usa o maintenanceAgent para iniciar o ciclo de auto-reflexão
        this.maintenanceAgent.runMaintenanceCycle(this.presentCodeProposal.bind(this));
    }

    private _startProactiveEngine(): void {
        if (this.proactiveTimer) clearInterval(this.proactiveTimer);
        this.proactiveTimer = window.setInterval(() => this.proposeProactiveAction(), PROACTIVE_INTERVAL_MS);
    }

    private _startMaintenanceEngine(): void {
        if (this.maintenanceTimer) clearInterval(this.maintenanceTimer);
        
        // Executa a cada minuto para checar inatividade e rodar manutenção
        this.maintenanceTimer = window.setInterval(() => {
            const isIdle = (Date.now() - this.lastInteractionAt) > INACTIVITY_THRESHOLD_MS;

            if (isIdle) {
                // Garante que a manutenção não rode a cada minuto se estiver ocioso
                this.lastInteractionAt = Date.now(); 
                this.maintenanceAgent.runMaintenanceCycle(this.presentCodeProposal.bind(this));
            }
        }, MAINTENANCE_INTERVAL_MS);
    }
    
    // O método foi aprimorado para ser mais específico no update de projeto
    public async proposeProactiveAction(): Promise<void> {
        const userId = this.userContext!.userId;
        const settings = await db.getSettings(userId);
        if (!settings.behavior.enableProactive) return;

        const isIdle = (Date.now() - this.lastInteractionAt) > INACTIVITY_THRESHOLD_MS;
        if (!isIdle) return;

        this.lastInteractionAt = Date.now(); // Reseta o timer para evitar múltiplas execuções
        this.dispatchThought('Buscando forma de ser útil proativamente...');

        // Priorizar atualizações de projeto (melhor lógica de busca)
        const activeProject = await db.getActiveProject(userId);
        if (activeProject) {
            const completedTasks = activeProject.tasks.filter(t => t.status === 'completed');
            const pendingTask = activeProject.tasks.find(t => t.status === 'pending');
            
            if (completedTasks.length > 0 && pendingTask) {
                const lastCompleted = completedTasks[completedTasks.length - 1];
                const update = `${this.userContext!.userName}, um update sobre o projeto "${activeProject.name}": concluí a tarefa "${lastCompleted.description}". A próxima é "${pendingTask.description}".`;
                
                this.opts.addMessage({ role: 'model', text: update, type: 'message' });
                this.opts.speak(update);
                return;
            }
        }
        
        // Implementar aqui outras ações proativas (ex: reflexão diária, notícias, etc.)
        // Ex: schedulerService.ensureDailyReflection();
    }
    
    // Auto-Evolução e Modificação de Código ---------------------------------

    /**
     * Apresenta uma proposta de modificação de código (auto-evolução) ao usuário.
     * @private
     */
    private async presentCodeProposal(proposal: CodeModificationProposal, goal: string): Promise<void> {
        const userContext = this.userContext!;
        // SECURITY GATEWAY: Apenas o "Creator" pode ver e aprovar código
        if (userContext.userRole !== 'Creator') {
            this.dispatchThought(`Proposta de código gerada, mas bloqueada para ${userContext.userName} (role: ${userContext.userRole})`, 'error');
            return;
        }
        this.lastCodeProposal = proposal;
        
        const message: Omit<ChatMessage, 'userId'|'timestamp'> = {
            role: 'model', type: 'code_proposal_prompt',
            text: `Minha reflexão gerou uma otimização: **${goal}**. Posso aplicar a modificação?`,
            codeProposal: { goal, code: proposal.newCode }
        };
        this.opts.addMessage(message);
    }

    public async applyCodeModification(): Promise<void> {
        if (this.userContext?.userRole !== 'Creator' || !this.lastCodeProposal) return;
        
        // Implementação real da aplicação do código (simulada aqui)
        cognitiveMonitor.logThought(`Aprovação de código para o objetivo: ${this.lastCodeProposal.goal}`);
        
        const text = "Otimização simulada e aplicada. Agradeço a confiança.";
        this.opts.addMessage({ role: 'model', text, type: 'status' });
        this.opts.speak(text);
        this.lastCodeProposal = null;
    }

    public async rejectCodeModification(): Promise<void> {
        if (this.userContext?.userRole !== 'Creator' || !this.lastCodeProposal) return; 
        
        cognitiveMonitor.logThought(`Rejeição de proposta de código: ${this.lastCodeProposal.goal}`);
        
        const text = "Compreendido. Rejeitei a proposta de modificação.";
        this.opts.addMessage({ role: 'model', text, type: 'status' });
        this.opts.speak(text);
        this.lastCodeProposal = null;
    }
    
    // Funções de Utilitário/Memória -----------------------------------------
    
    public async performConceptMerge(options: { targetConceptName: string, sourceConceptNames: string[] }) {
        await db.mergeConcepts(this.userContext!.userId, options.targetConceptName, options.sourceConceptNames);
    }
    
    public async executeFunctionCall(call: SimpleFunctionCall): Promise<{ result: any }> {
        this.dispatchThought(`Executando função: ${call.name}`, 'symbolic_log');
        
        const responseMessage = await this.agentManager.codeAgent.executeFunctionCall(call, this.userContext!);
        this.opts.addMessage(responseMessage);
        
        cognitiveMonitor.logConcept(`Execução de função bem-sucedida: ${call.name}`);
        
        return { result: { summary: responseMessage.text } };
    }
    
    /**
     * Implementa o Rollback de estado para um snapshot estável anterior.
     */
    public async performRollback(): Promise<void> {
        const { addMessage, speak, userId } = this.opts;
        this.setStatus('ROLLBACK');
        this.dispatchThought('Rollback iniciado. Restaurando o estado cognitivo.', 'error');
        
        try {
            const currentMemory = await db.getSystemMemory(userId);
            const snapshot = currentMemory.evolutionSnapshot;
            
            if (!snapshot) {
                const msg = "Nenhum snapshot de recuperação encontrado. Não é possível reverter.";
                this.dispatchThought(msg, 'error');
                addMessage({ role: 'model', text: msg, type: 'status' });
                this.setStatus('ERROR');
                return;
            }
            
            // O parâmetro `true` indica a restauração a partir do snapshot
            await db.saveSystemMemory(userId, snapshot, true); 

            const successMsg = "Detectei instabilidade e reverti com sucesso para meu último estado estável.";
            addMessage({ role: 'model', text: successMsg, type: 'status' });
            speak(successMsg, () => this.setStatus('IDLE'));

        } catch (error) {
            console.error('[NEXUS-CORE] ERRO CRÍTICO no Rollback:', error);
            const failMsg = "Falha crítica durante o processo de reversão. A memória pode estar permanentemente instável.";
            this.dispatchThought(failMsg, 'error');
            addMessage({ role: 'model', text: failMsg, type: 'status' });
            this.setStatus('ERROR');
        }
    }
}