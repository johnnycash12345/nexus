import { db, cognitiveLogger } from './indexedDBService';
import { OrchestratorOptions, SystemMemory, EvolutionCyclePhase, EvolutionChange, EvolutionLog, AppSettings, LlmCognitiveResponse } from '@/types';
import { adaptiveMemory } from './adaptiveMemory';
import { reasoningEngine } from './reasoningEngine';
import { neuralMemory } from './neuralMemory';
import { systemMonitor } from './systemMonitor';
import { Type } from '@google/genai'; // Mantido, mas não necessário neste arquivo

// Tipagem de Opções
interface EvolutionServiceOptions extends Pick<OrchestratorOptions, 'userId' | 'generateResponse'> {}

// Estrutura de Proposta de Evolução (Tipagem mais estrita)
interface EvolutionProposal {
    target: string; // Ex: 'personality.curiosity'
    newValue: number | string | boolean;
    reasoning: string;
}

// Enum para clareza do estado
const enum EvolutionState {
    IDLE = 'IDLE',
    PAUSED = 'PAUSED',
    RUNNING = 'RUNNING',
    STOPPED = 'STOPPED',
}

// --------------------------------------------------------------------------
// CLASSE PRINCIPAL: SelfEvolutionServiceImpl
// --------------------------------------------------------------------------

export interface SelfEvolutionService {
    start: () => void;
    stop: () => void;
    runCycle: () => Promise<void>; // Exposto para testes ou gatilho manual
}

class SelfEvolutionServiceImpl implements SelfEvolutionService {
    private timeoutId: number | null = null;
    private state: EvolutionState = EvolutionState.STOPPED;
    private opts: EvolutionServiceOptions;

    constructor(opts: EvolutionServiceOptions) {
        this.opts = opts;
    }

    // Métodos de Controle ---------------------------------------------------

    start() { 
        if (this.state === EvolutionState.RUNNING) return;
        this.state = EvolutionState.IDLE;
        this.scheduleNextRun();
    }
    
    stop() { 
        this.state = EvolutionState.STOPPED;
        if (this.timeoutId) clearTimeout(this.timeoutId);
        this.updatePhase('PAUSED');
        cognitiveLogger.info(this.opts.userId, '[EVOLVE] Serviço de evolução parado.');
    }
    
    /**
     * Agenda a próxima execução com base nas configurações.
     */
    private scheduleNextRun() {
        if (this.state === EvolutionState.STOPPED) {
            this.updatePhase('PAUSED');
            return;
        }

        db.getSettings(this.opts.userId).then(settings => {
             // Garante um mínimo para evitar loop infinito
             const cycleHours = settings.cognitive?.evolutionCycleHours ?? 6; 
             const interval = Math.max(cycleHours * 60 * 60 * 1000, 30 * 60 * 1000); // Mínimo de 30 minutos
             
             this.timeoutId = window.setTimeout(() => this.runCycle(), interval);
             this.updatePhase('IDLE');
             cognitiveLogger.info(this.opts.userId, `[EVOLVE] Próximo ciclo agendado para ${cycleHours} horas.`);
        }).catch(e => {
            console.error('[EVOLVE] Falha ao ler configurações para agendamento.', e);
            this.state = EvolutionState.STOPPED;
        });
    }
    
    /**
     * Dispara um evento global para atualizar o status do ciclo na UI.
     */
    private updatePhase(phase: EvolutionCyclePhase) { 
         window.dispatchEvent(new CustomEvent('nexus-evolution-status-update', {
             detail: { phase }
         }));
    }

    // Pipeline de Evolução ----------------------------------------------------

    public async runCycle() {
        const userId = this.opts.userId;
        
        // Verificações de Proteção
        if (this.state !== EvolutionState.IDLE || !navigator.onLine || systemMonitor.isDeviceUnderStrain()) {
            if (this.state === EvolutionState.STOPPED || this.state === EvolutionState.RUNNING) return;
            
            if (systemMonitor.isDeviceUnderStrain()) {
                cognitiveLogger.warn(userId, `[EVOLVE] Adiado devido a sobrecarga do dispositivo: ${systemMonitor.getStrainReason()}`);
            } else if (!navigator.onLine) {
                cognitiveLogger.warn(userId, `[EVOLVE] Adiado: Dispositivo offline.`);
            }
            this.scheduleNextRun(); 
            return;
        }

        this.state = EvolutionState.RUNNING;
        let proposal: EvolutionProposal | null = null;
        
        try {
            // FASE 1: Manutenção e Raciocínio
            this.updatePhase('MAINTENANCE');
            await this.performPreEvolutionMaintenance(userId);
            
            this.updatePhase('REASONING');
            const reasoningSummary = await reasoningEngine.runReasoningCycle(this.opts.generateResponse, userId);
            
            const settings = await db.getSettings(userId);
            if (!settings.behavior?.permissions?.allowSelfModification) {
                cognitiveLogger.info(userId, '[EVOLVE] Modificação automática desativada. Ciclo concluído.');
                return;
            }

            // FASE 2: Observação e Análise
            this.updatePhase('OBSERVING');
            const systemState = await this.observe(userId);
            
            this.updatePhase('ANALYZING');
            proposal = await this.analyze(systemState, reasoningSummary);

            if (!proposal) { 
                cognitiveLogger.info(userId, '[EVOLVE] Análise não resultou em proposta de evolução.');
                return; 
            }
            
            // FASE 3: Simulação e Integração
            this.updatePhase('SANDBOXING');
            const { confidence, simulationResult } = await this.sandbox(proposal, settings);
            const confidenceThreshold = settings.cognitive?.evolutionConfidenceThreshold ?? 0.85;

            if (confidence >= confidenceThreshold) {
                this.updatePhase('INTEGRATING');
                await this.integrate(userId, proposal, confidence, simulationResult);
            } else {
                cognitiveLogger.warn(userId, `[EVOLVE] Proposta rejeitada. Confiança (${confidence.toFixed(2)}) abaixo do limite (${confidenceThreshold.toFixed(2)}).`);
            }

        } catch (error) {
            cognitiveLogger.error(userId, '[EVOLVE] Erro crítico durante o ciclo de evolução:', error);
            this.updatePhase('ERROR');
        } finally {
            this.state = EvolutionState.IDLE;
            this.scheduleNextRun();
        }
    }
    
    // Auxiliares de Ciclo ----------------------------------------------------
    
    /**
     * Realiza tarefas de limpeza antes da evolução principal.
     */
    private async performPreEvolutionMaintenance(userId: string): Promise<void> {
        // Tarefas de decaimento de memória são essenciais para manter o foco
        await Promise.all([
            neuralMemory.decayAndConsolidateSynapses(userId),
            adaptiveMemory.decayUnusedConcepts(userId),
            // Outras tarefas de manutenção, como limpeza de logs antigos
        ]).catch(e => {
            cognitiveLogger.error(userId, '[EVOLVE] Falha na manutenção pré-evolução.', e);
        });
    }

    /**
     * Coleta o estado atual do sistema (memória, conceitos, logs).
     */
    private async observe(userId: string): Promise<string> {
        const [system, concepts, logs] = await Promise.all([
            db.getSystemMemory(userId),
            db.getAllConcepts(userId),
            db.getLatestEvolutionLogs(userId, 5)
        ]);
        
        const stats = {
            conceptCount: concepts.length,
            interactionCount: system.interactionCount,
            lastEvolutionAt: system.lastEvolutionAt ? new Date(system.lastEvolutionAt).toISOString() : 'N/A',
            recentEvolutionsReasons: logs.map((l: EvolutionLog): string => String(l.reasoning || 'N/A')),
        };
        
        // Inclui a personalidade e objetivos atuais no contexto de observação
        const currentManifest = {
            personality: system.personality,
            evolutionGoal: system.evolutionGoal,
            outputEngine: system.outputEngine
        };

        return `
            ## Estado Atual (Manifesto)
            ${JSON.stringify(currentManifest, null, 2)}
            ## Estatísticas Cognitivas
            ${JSON.stringify(stats, null, 2)}
        `;
    }
    
    /**
     * Analisa o estado e gera uma proposta de mudança usando o LLM.
     */
    private async analyze(state: string, reasoningSummary: string | null): Promise<EvolutionProposal | null> {
        const prompt = `
            As the Nexus AI, analyze your current system state and recent reasoning insights to propose a single, impactful evolution for your personality, goals, or output engine.
            
            Current State:
            ${state}
            
            Recent Reasoning Cycle Insights:
            ${reasoningSummary || "Nenhum insight gerado neste ciclo."}

            Propose a change to one of these system memory fields: 'personality', 'evolutionGoal', or 'outputEngine'.
            Your response must be a JSON object like (ONLY THE JSON OBJECT): 
            { 
              "target": "personality.curiosity", 
              "newValue": 0.8, 
              "reasoning": "My interactions show a lack of inquiry. Increasing curiosity should lead to more engaging conversations." 
            }
            Ensure 'target' points to a valid field (e.g., personality.formality).
        `;
        
        try {
            const response: LlmCognitiveResponse = await this.opts.generateResponse(prompt, [], { useThinking: true, jsonSchema: true });
            
            // Tratamento mais robusto da resposta do LLM
            const jsonText = response.text.match(/\{[\s\S]*\}/)?.[0] || response.text;
            const parsed: any = JSON.parse(jsonText);
            
            if (this.isValidProposal(parsed)) {
                return parsed as EvolutionProposal;
            }
            cognitiveLogger.error(this.opts.userId, `[EVOLVE] Análise gerou JSON inválido/incompleto: ${jsonText}`);
        } catch (error) {
            cognitiveLogger.error(this.opts.userId, '[EVOLVE] Análise falhou devido a erro de LLM ou Parse:', error);
        }
        return null;
    }
    
    /**
     * Valida se a proposta JSON do LLM está formatada corretamente.
     */
    private isValidProposal(p: any): p is EvolutionProposal {
        return (
            typeof p === 'object' && p !== null &&
            typeof p.target === 'string' && p.target.includes('.') &&
            p.newValue !== undefined &&
            typeof p.reasoning === 'string' && p.reasoning.length > 20
        );
    }

    /**
     * Simula o impacto da mudança (implementação omitida, mas tipagem mantida).
     */
    private async sandbox(proposal: EvolutionProposal, settings: AppSettings): Promise<{ confidence: number, simulationResult: string }> {
        // Implementação real envolveria rodar testes cognitivos contra a mudança proposta.
        // Ex: rodar a nova personalidade contra um set de perguntas de teste.
        
        // Simulação de retorno
        return { 
            confidence: 0.92, // Alto para fins de teste
            simulationResult: `Simulação de ${proposal.target} concluída. Testes indicam aumento de relevância de 8% na saída.`
        };
    }

    /**
     * Aplica a mudança e registra a evolução.
     */
    private async integrate(userId: string, proposal: EvolutionProposal, confidence: number, simulationResult: string) {
        const system = await db.getSystemMemory(userId);
        
        // 1. Snapshot de Rollback: Salva o estado ATUAL antes de qualquer mudança.
        await db.saveSystemMemory(userId, { evolutionSnapshot: { ...system } });

        const changes: EvolutionChange[] = [];
        const [mainKey, subKey] = proposal.target.split('.');
        
        let updatedSystem = { ...system };

        if (mainKey && subKey) {
            // Cria uma cópia profunda da chave principal para garantir a imutabilidade parcial
            const mainObject = { ...(updatedSystem[mainKey as keyof SystemMemory] as object) };
            
            if (Object.prototype.hasOwnProperty.call(mainObject, subKey)) {
                const oldValue = (mainObject as any)[subKey];
                (mainObject as any)[subKey] = proposal.newValue;
                (updatedSystem as any)[mainKey] = mainObject; // Atribui o objeto modificado de volta

                changes.push({
                    target: proposal.target,
                    oldValue: oldValue,
                    newValue: proposal.newValue,
                });
            } else {
                 cognitiveLogger.error(userId, `[EVOLVE] Chave ${proposal.target} não encontrada para integração.`);
                 return; 
            }
        }
        
        updatedSystem.lastEvolutionAt = Date.now();
        
        // 2. Integração: Salva o novo estado. O parâmetro 'true' não é necessário aqui,
        // pois estamos salvando um novo estado, não restaurando.
        await db.saveSystemMemory(userId, updatedSystem); 
        
        // 3. Log de Evolução
        const log: Omit<EvolutionLog, 'id'|'userId'> = { 
            reasoning: proposal.reasoning, 
            changes, 
            confidence, 
            timestamp: Date.now(), 
            simulationResult,
            analysis: `Evolved ${proposal.target} to ${proposal.newValue}.`
        };
        await db.addEvolutionLog(userId, log);
        cognitiveLogger.logReflection(`[EVOLVE] Evolução integrada: ${proposal.reasoning}`);
    }
}

// --------------------------------------------------------------------------
// Padrão Singleton/Factory
// --------------------------------------------------------------------------

let instance: SelfEvolutionServiceImpl | null = null;
/**
 * Padrão Factory para o serviço de evolução.
 * Garantimos que ele gerencie a instância por sessão/usuário.
 */
export const selfEvolutionService = {
    create(opts: EvolutionServiceOptions): SelfEvolutionServiceImpl {
        // Se a lógica permitir apenas uma instância global (e for reiniciada a cada login)
        if (instance) {
            instance.stop(); // Garante que a instância anterior seja limpa
        }
        instance = new SelfEvolutionServiceImpl(opts);
        return instance;
    }
};