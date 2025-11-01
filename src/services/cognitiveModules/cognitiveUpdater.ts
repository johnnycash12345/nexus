import { db, cognitiveLogger } from '../indexedDBService';
import { CognitiveFrame, VisualState, CodeModificationProposal, UserContext, AppSettings, SystemMemory } from '../../types';
import { neuralMemory } from '../neuralMemory';
import { selfReflection } from '../selfReflection';
import { EmotionalAgent } from '../agents/emotionalAgent';
import { analyzeAndStoreConcepts } from '../conceptEngine';
import { autonomousLearningService } from '../autonomousLearningService';
// FIX: Added missing import for adaptiveMemory.
import { adaptiveMemory } from '../adaptiveMemory';

// --------------------------------------------------------------------------
// TIPAGEM REFINADA
// --------------------------------------------------------------------------

/** Define a assinatura da função de apresentação de propostas. */
type PresentProposalFn = (proposal: CodeModificationProposal, goal: string) => void;

/** Uma interface para o serviço de log centralizado (melhora a testabilidade). */
interface Logger {
    logAction: (userId: string, data: any) => void;
    error: (userId: string, message: string, error?: any) => void;
    warn: (userId: string, message: string, warning?: any) => void;
    info: (userId: string, message: string) => void;
}

// --------------------------------------------------------------------------
// AGREGADOR DE SERVIÇOS COGNITIVOS
// --------------------------------------------------------------------------

/**
 * Classe principal para orquestrar todas as atualizações de estado cognitivo
 * e processos de aprendizado pós-interação.
 */
class CognitiveOrchestrator {
    // Uso de propriedades privadas para injeção de dependência e controle de estado.
    private readonly logger: Logger;

    // A Injeção de Dependência aqui torna a classe mais testável e modular.
    constructor(logger: Logger) {
        this.logger = logger;
    }

    /**
     * 🧠 Processa um ciclo completo de atualização cognitiva após uma resposta do LLM.
     * Esta é a função central do sistema de "aprendizado".
     */
    public async updateCognitiveState(
        frame: CognitiveFrame,
        presentCodeProposal: PresentProposalFn,
        emotionalAgent: EmotionalAgent
    ): Promise<void> {
        const userId = frame.userContext.userId;

        if (!frame.llmResponse) {
            this.logger.error(userId, `[Orchestrator] Não é possível atualizar o estado sem resposta do LLM.`);
            return;
        }

        const { text, learningContext, metaReflection } = frame.llmResponse;

        this.logger.info(userId, `[Orchestrator] Iniciando ciclo de integração cognitiva. Intent: ${learningContext.inputIntent}`);

        // 1. Registro de Ação Central
        this.logger.logAction(userId, {
            timestamp: Date.now(),
            event: 'new_learning', stage: 'integrate',
            description: `Novo aprendizado. Intent: ${learningContext.inputIntent}`,
            impact: 'Estado interno atualizado.',
            result: 'Processing...',
            rollback_used: false,
        });

        // 2. Atualização da Memória Principal (Síncrona/Sequencial)
        // A meta-reflexão é o pilar, deve ser persistida primeiro.
        await db.saveSystemMemory(userId, { metaReflection }).catch(e => {
            this.logger.error(userId, `[Orchestrator] Falha ao salvar meta-reflexão.`, e);
            throw e; // Lança para evitar processamento subsequente com dados inconsistentes.
        });


        // 3. Processamento Cognitivo em Paralelo
        // Executa todas as tarefas de processamento de memória e agentes que não dependem umas das outras.
        const postInteractionPromises = [
            neuralMemory.registerInteraction(userId, frame.userInput, text, learningContext),
            emotionalAgent.processInteraction(frame),
            analyzeAndStoreConcepts(userId, text), // Aprender a partir da própria resposta
            analyzeAndStoreConcepts(userId, frame.userInput) // Aprender a partir da entrada do usuário
        ];

        // Aguarda todos os processos principais de integração de memória.
        const postInteractionResults = await Promise.allSettled(postInteractionPromises);

        // Relata falhas de processos paralelos
        postInteractionResults.forEach((result, index) => {
            if (result.status === 'rejected') {
                this.logger.warn(userId, `[Orchestrator] Processo paralelo ${index} falhou:`, result.reason);
            }
        });

        // 4. Disparo de Estado Visual
        // Obtém o estado mais recente (que pode ter sido atualizado pelo emotionalAgent)
        const updatedSystemMemory = await db.getSystemMemory(userId);
        this.dispatchVisualState(updatedSystemMemory, learningContext.contextTags, learningContext.responseEffectiveness);


        // 5. Tarefas de Background Assíncronas (Fire-and-Forget)
        // Estas não precisam bloquear o fluxo principal da UI.

        // A. Autorreflexão e Auto-modificação
        this.runSelfReflection(userId, frame, presentCodeProposal).catch(err => {
            this.logger.warn(userId, `[Orchestrator] Auto-reflexão em segundo plano falhou:`, err);
        });

        // B. Ciclo de Aprendizado Autônomo
        autonomousLearningService.runLearningCycle(frame).catch(err => {
            this.logger.warn(userId, `[Orchestrator] Ciclo de aprendizado autônomo falhou:`, err);
        });
        
        this.logger.logAction(userId, { timestamp: Date.now(), event: 'new_learning', stage: 'integrate', result: 'Success.', description: `Aprendizado integrado. Intent: ${learningContext.inputIntent}`, impact: 'Estado interno atualizado.', rollback_used: false, });
    }

    /**
     * 🔍 Gerencia o processo de Autorreflexão, verificando permissões.
     * @private
     */
    private async runSelfReflection(userId: string, frame: CognitiveFrame, presentCodeProposal: PresentProposalFn): Promise<void> {
        let settings: AppSettings;
        try {
            settings = await db.getSettings(userId);
        } catch (e) {
            this.logger.error(userId, `[Orchestrator] Não foi possível carregar as configurações para autorreflexão.`, e);
            return;
        }

        if (settings.behavior?.permissions?.allowSelfModification) {
            await selfReflection.reflectOnInteraction(frame, presentCodeProposal);
            this.logger.info(userId, `[Orchestrator] Autorreflexão concluída.`);
        } else {
            this.logger.info(userId, `[Orchestrator] Autorreflexão ignorada (permissão negada).`);
        }
    }


    /**
     * 👁️ Constrói e despacha o evento de estado visual para a UI.
     * @private
     */
    private dispatchVisualState(updatedSystemMemory: SystemMemory, contextTags: string[], responseEffectiveness: number): void {
        const emotionState = updatedSystemMemory.emotionState;
        
        if (emotionState) {
            const visualState: VisualState = {
                highlightNodes: contextTags.slice(0, 3),
                pulseIntensity: responseEffectiveness,
                emotionalSpectrum: { [emotionState.current]: emotionState.intensity }
            };
            
            // O uso de `window.dispatchEvent` deve ser encapsulado ou, idealmente,
            // substituído por um sistema de eventos centralizado (ex: Redux, Vuex, RxJS).
            window.dispatchEvent(new CustomEvent('nexus-visual-state-update', { detail: visualState }));
            this.logger.info(updatedSystemMemory.userId, `[Orchestrator] Estado visual (Emoção: ${emotionState.current}) despachado.`);
        }
    }

    /**
     * 🧹 Executa tarefas de manutenção cognitiva periódicas, como decaimento de memória.
     */
    public async runCognitiveMaintenance(userId: string): Promise<void> {
        this.logger.info(userId, `[Orchestrator] Iniciando manutenção cognitiva...`);
        try {
            await Promise.all([
                adaptiveMemory.decayUnusedConcepts(userId),
                neuralMemory.decayAndConsolidateSynapses(userId)
            ]);
            this.logger.info(userId, `[Orchestrator] Manutenção cognitiva concluída com sucesso.`);
        } catch (error) {
            this.logger.error(userId, `[Orchestrator] Erro durante a manutenção cognitiva:`, error);
        }
    }
}

// --------------------------------------------------------------------------
// EXPORTAÇÃO SINGLETON E INJEÇÃO DE DEPENDÊNCIA
// --------------------------------------------------------------------------

// Para manter a estrutura Singleton e injetar o logger:
// Usamos o 'cognitiveLogger' existente como nossa implementação de Logger.
export const cognitiveOrchestrator = new CognitiveOrchestrator(cognitiveLogger as any);

// Exporta as funções principais do orquestrador
export const updateCognitiveState = cognitiveOrchestrator.updateCognitiveState.bind(cognitiveOrchestrator);
export const runCognitiveMaintenance = cognitiveOrchestrator.runCognitiveMaintenance.bind(cognitiveOrchestrator);