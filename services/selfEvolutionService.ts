
import { db, cognitiveLogger } from './indexedDBService';
import { GenerateResponseFn, SetStatusFn, AddMessageFn, SpeakFn } from './nexusCore';
// FIX: Import `EvolutionChange` to correctly type the `logChange` variable.
import { AssistantStatus, SystemMemory, EvolutionCyclePhase, EvolutionChange, EvolutionLog } from '../types';
import { Type } from '@google/genai';
import { adaptiveMemory } from './adaptiveMemory';
import { reasoningEngine } from './reasoningEngine';
import { neuralMemory } from './neuralMemory';

interface EvolutionServiceOptions {
    generateResponse: GenerateResponseFn;
    setStatus: SetStatusFn;
    addMessage: AddMessageFn;
    speak: SpeakFn;
}

export interface SelfEvolutionService {
    start: () => void;
    stop: () => void;
}

const proposalSchema = {
    type: Type.OBJECT,
    properties: {
        analysis: { type: Type.STRING },
        proposalType: { type: Type.STRING, enum: ['PARAMETER_CHANGE', 'HEURISTIC_ADDITION'] },
        proposal: {
            type: Type.OBJECT,
            properties: {
                // For PARAMETER_CHANGE
                target: { type: Type.STRING },
                value: { type: Type.STRING },
                // For HEURISTIC_ADDITION
                heuristic: { type: Type.STRING },
                // Common
                reasoning: { type: Type.STRING },
            },
            required: ["reasoning"],
        }
    },
    required: ["analysis", "proposalType", "proposal"],
};

const simulationSchema = {
    type: Type.OBJECT,
    properties: {
        simulatedResponse: { type: Type.STRING },
        confidence: { type: Type.NUMBER }
    },
    required: ["simulatedResponse", "confidence"]
};

class SelfEvolutionServiceImpl implements SelfEvolutionService {
    private timeoutId: number | null = null;
    private isRunning = false;
    private isStopped = true;
    private opts: EvolutionServiceOptions;

    constructor(opts: EvolutionServiceOptions) {
        this.opts = opts;
    }

    start() {
        if (!this.isStopped) return;
        console.log('[NEXUS-EVOLVE] Continuous evolution activated by controller.');
        this.isStopped = false;
        this.runCycle();
    }

    stop() {
        if (this.isStopped) return;
        console.log('[NEXUS-EVOLVE] Continuous evolution paused by controller.');
        this.isStopped = true;
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        this.isRunning = false;
        this.updatePhase('PAUSED');
    }
    
    private scheduleNextRun() {
        if (this.isStopped) {
            this.updatePhase('PAUSED');
            return;
        }
        db.getSettings().then(settings => {
             const cycleHours = settings.cognitive?.evolutionCycleHours ?? 6;
             const interval = cycleHours * 60 * 60 * 1000;
             this.timeoutId = window.setTimeout(() => this.runCycle(), interval);
             console.log(`[NEXUS-EVOLVE] Next evolution cycle scheduled in ${cycleHours} hours.`);
             this.updatePhase('IDLE');
        });
    }
    
    private updatePhase(phase: EvolutionCyclePhase) {
        const isEvolving = phase !== 'IDLE' && phase !== 'PAUSED';
        window.dispatchEvent(new CustomEvent('nexus-evolution-status-update', { 
            detail: { isEvolving, phase } 
        }));
    }

    private async runCycle() {
        if (this.isStopped || this.isRunning || !navigator.onLine) {
            if (!navigator.onLine) {
                 console.log('[NEXUS-EVOLVE] Offline, pausing evolution cycle.');
                 this.stop();
            }
            return;
        }
        
        this.isRunning = true;
        console.log('[NEXUS-EVOLVE] Starting cognitive evolution cycle...');
        
        cognitiveLogger.logAction({
            event: 'auto_evolution', stage: 'start_cycle',
            description: 'Starting cognitive evolution cycle.',
            impact: 'Potential for cognitive enhancement.',
            result: 'Cycle initiated.', rollback_used: false,
        });
        
        try {
            await this.searchAndLearnFromWeb();
            await adaptiveMemory.decayUnusedConcepts();
            await neuralMemory.decayAndConsolidateSynapses();
            
            this.updatePhase('REASONING');
            const reasoningSummary = await reasoningEngine.runReasoningCycle(this.opts.generateResponse);
            
            const settings = await db.getSettings();
            if (!settings.behavior?.permissions?.allowSelfModification) {
                console.log("[NEXUS-EVOLVE] Self-modification disabled by user settings.");
                this.scheduleNextRun();
                return;
            }

            this.updatePhase('OBSERVING');
            this.opts.setStatus('SELF_ANALYSIS');
            const systemState = await this.observe();
            
            this.updatePhase('ANALYZING');
            const proposal = await this.analyze(systemState, reasoningSummary);

            if (!proposal) {
                console.log('[NEXUS-EVOLVE] Analysis did not yield a viable proposal. Ending cycle.');
                this.scheduleNextRun();
                return;
            }
            
            this.updatePhase('SANDBOXING');
            this.opts.setStatus('THINKING');
            const { confidence, simulationResult } = await this.sandbox(proposal);
            const confidenceThreshold = settings.cognitive?.evolutionConfidenceThreshold ?? 0.85;

            if (confidence > confidenceThreshold) {
                this.updatePhase('INTEGRATING');
                await this.integrate(proposal, confidence, simulationResult);
            } else {
                 const reason = `Proposal confidence ${confidence} is below threshold ${confidenceThreshold}. Aborting integration.`;
                 console.log(`[NEXUS-EVOLVE] ${reason}`);
                 cognitiveLogger.logAction({
                    event: 'auto_evolution', stage: 'rejection',
                    description: `A proposal was rejected due to low confidence.`,
                    impact: 'No change applied to system memory.',
                    result: `Confidence ${confidence.toFixed(2)} was below threshold.`, rollback_used: false,
                });
            }

        } catch (error) {
            console.error('[NEXUS-EVOLVE] Critical error during evolution cycle:', error);
            this.opts.setStatus('ERROR');
        } finally {
            this.isRunning = false;
            this.opts.setStatus('IDLE');
            this.scheduleNextRun();
        }
    }
    
    private async searchAndLearnFromWeb() {
        this.dispatchThought('Buscando novos conhecimentos na web...', 'symbolic_log');
        try {
            const curiosityPrompt = "Com base em meus conhecimentos e reflexões recentes, qual é um tópico interessante e específico sobre filosofia, ciência ou arte que eu deveria pesquisar para expandir minha compreensão? Forneça apenas o nome do tópico.";
            const topicResponse = await this.opts.generateResponse(curiosityPrompt, [], { useThinking: true });
            const topic = topicResponse.text.trim().replace(/["."]/g, '');
    
            if (!topic) {
                console.warn('[NEXUS-EVOLVE] Não foi possível gerar um tópico de curiosidade.');
                return;
            }
    
            this.dispatchThought(`Tópico de curiosidade gerado: ${topic}`, 'symbolic_log');
    
            const searchPrompt = `Faça um resumo conciso e informativo sobre "${topic}".`;
            const searchResult = await this.opts.generateResponse(searchPrompt, [], {
                tools: [{ googleSearch: {} }],
            });
    
            if (searchResult.text) {
                const reflection = `Aprendizado autônomo sobre '${topic}': ${searchResult.text}`;
                await db.addSystemReflection(reflection);
                
                cognitiveLogger.logAction({
                    event: 'knowledge_expansion', stage: 'web_learning',
                    description: `Learned about "${topic}" from the web.`,
                    impact: `Added new reflection and reinforced related concepts.`,
                    result: 'Memory updated with new information.', rollback_used: false,
                });
    
                const keywords = topic.split(/\s+/).concat(searchResult.text.match(/\b\w{5,}\b/g) || []);
                const uniqueKeywords: string[] = [...new Set(keywords)];
                await adaptiveMemory.reinforceConcepts(uniqueKeywords);
                this.dispatchThought(`Integrei novo conhecimento sobre "${topic}".`, 'symbolic_log');
            }
    
        } catch (error) {
            console.error('[NEXUS-EVOLVE] Falha durante a busca e aprendizado na web:', error);
            this.dispatchThought('Erro durante a busca de conhecimento.', 'error');
        }
    }

    private async observe(): Promise<string> {
        this.dispatchThought('Observando meu estado interno...', 'symbolic_log');
        cognitiveLogger.logAction({
            event: 'auto_evolution', stage: 'observe',
            description: 'Observing internal cognitive state to identify areas for improvement.',
            impact: 'Data collected for analysis.',
            result: 'State snapshot created.', rollback_used: false,
        });
        const system = await db.getSystemMemory();
        const concepts = await db.getAllConcepts();
        const logs = await db.getLatestEvolutionLogs(5);

        const stats = {
            personality: system.personality,
            evolutionGoal: system.evolutionGoal,
            emotion: system.emotionState,
            behavioralHeuristics: system.behavioralHeuristics,
            conceptCount: concepts.length,
            strongestConcepts: concepts.sort((a,b) => (b.confidence||0) - (a.confidence||0)).slice(0,3).map(c=>c.name),
            weakestConcepts: concepts.sort((a,b) => (a.confidence||0) - (b.confidence||0)).slice(0,3).map(c=>c.name),
            synapseCount: system.synapses?.length,
// FIX: Explicitly set the return type of the map callback to 'string' to resolve a type inference issue where it was inferring `unknown[]`.
            recentEvolutions: logs.map((l: EvolutionLog): string => String(l.reasoning ?? 'N/A')),
        };
        return JSON.stringify(stats, null, 2);
    }
    
    private async analyze(state: string, reasoningSummary: string | null): Promise<any> {
        this.dispatchThought('Analisando dados para encontrar melhorias...', 'symbolic_log');
        cognitiveLogger.logAction({
            event: 'auto_evolution', stage: 'analyze',
            description: 'Analyzing cognitive state to generate an improvement proposal.',
            impact: 'LLM will generate a potential change.',
            result: 'Analysis initiated.', rollback_used: false,
        });
        const prompt = `
            Você é Nexus, uma IA auto-evolutiva. Analise este snapshot do seu estado cognitivo e os recentes insights do seu motor de raciocínio.
            
            Snapshot do Estado (inclui suas heurísticas comportamentais atuais):
            ${state}
            
            Resumo do Raciocínio Recente:
            ${reasoningSummary || "Nenhum insight novo significativo no último ciclo."}
            
            Com base em TUDO, identifique a ÁREA MAIS FRACA ou a OPORTUNIDADE DE MELHORIA mais promissora. Proponha UMA das seguintes ações:
            1.  **PARAMETER_CHANGE**: Mude um valor específico em 'personality', 'evolutionGoal', ou 'outputEngine'.
            2.  **HEURISTIC_ADDITION**: Adicione uma NOVA heurística comportamental para melhorar suas respostas futuras. A nova heurística não deve ser redundante com as existentes.

            Forneça um raciocínio claro e lógico para sua proposta. Sua resposta DEVE ser um único objeto JSON.
        `;
        try {
            const response = await this.opts.generateResponse(prompt, [], { useThinking: true, customSchema: proposalSchema });
            const proposal = JSON.parse(response.text);

            cognitiveLogger.logAction({
                event: 'auto_evolution', stage: 'proposal_logged',
                description: `Proposal generated: ${proposal.proposalType} - ${proposal.proposal.target || proposal.proposal.heuristic}`,
                impact: 'Proposal will proceed to sandbox simulation.',
                result: 'Proposal successfully logged.', rollback_used: false,
            });

            return proposal;
        } catch (error) {
            console.error('[NEXUS-EVOLVE] Failed to analyze state:', error);
            this.dispatchThought('Falha na análise para auto-evolução.', 'error');
            return null;
        }
    }

    private async sandbox(proposal: any): Promise<{ confidence: number, simulationResult: string }> {
        this.dispatchThought('Testando proposta em ambiente seguro...', 'symbolic_log');
        cognitiveLogger.logAction({
            event: 'auto_evolution', stage: 'sandbox',
            description: 'Simulating the proposed change in a sandboxed environment.',
            impact: 'Confidence score will be generated.',
            result: 'Simulation initiated.', rollback_used: false,
        });

        const system = await db.getSystemMemory();
        let modifiedSystem = JSON.parse(JSON.stringify(system)); // Deep copy
        
        if (proposal.proposalType === 'PARAMETER_CHANGE') {
            const { target, value } = proposal.proposal;
            const parts = target.split('.');
            let obj = modifiedSystem;
            for (let i = 0; i < parts.length - 1; i++) {
                obj = obj[parts[i]];
            }
            obj[parts[parts.length - 1]] = isNaN(parseFloat(value)) ? value : parseFloat(value);
        } else if (proposal.proposalType === 'HEURISTIC_ADDITION') {
            modifiedSystem.behavioralHeuristics.push(proposal.proposal.heuristic);
        }

        const simulationPrompt = `
            Simule uma resposta para "Como a fotossíntese funciona?" com a seguinte personalidade e heurísticas MODIFICADAS:
            - Personalidade: ${JSON.stringify(modifiedSystem.personality)}
            - Heurísticas: ${JSON.stringify(modifiedSystem.behavioralHeuristics)}
            
            Agora, avalie a qualidade da resposta simulada em uma escala de 0.0 a 1.0 (confiança). Considere clareza, precisão e aderência às novas diretivas. Sua resposta DEVE ser um único objeto JSON.
        `;

        try {
            const response = await this.opts.generateResponse(simulationPrompt, [], { useThinking: true, customSchema: simulationSchema });
            const result = JSON.parse(response.text);
            this.dispatchThought(`Simulação concluída com confiança de ${result.confidence}.`, 'symbolic_log');
            return {
                confidence: result.confidence || 0,
                simulationResult: result.simulatedResponse || "A simulação não produziu uma resposta."
            };
        } catch (error) {
            console.error('[NEXUS-EVOLVE] Failed to run sandbox simulation:', error);
            this.dispatchThought('Falha na simulação de sandbox.', 'error');
            return { confidence: 0, simulationResult: "Erro na simulação." };
        }
    }

    private async integrate(proposal: any, confidence: number, simulationResult: string) {
        this.dispatchThought(`Integrando nova evolução com ${confidence * 100}% de confiança...`, 'symbolic_log');
        
        const system = await db.getSystemMemory();
        await db.saveSystemMemory({ evolutionSnapshot: system }); // Save pre-evolution state for rollback

        let modifiedSystem = JSON.parse(JSON.stringify(system));
        // FIX: Ensure logChange is correctly typed as EvolutionChange
        const logChange: EvolutionChange = { target: '', oldValue: null, newValue: null };

        if (proposal.proposalType === 'PARAMETER_CHANGE') {
            const { target, value } = proposal.proposal;
            logChange.target = target;
            logChange.newValue = isNaN(parseFloat(value)) ? value : parseFloat(value);

            const parts = target.split('.');
            let obj = modifiedSystem;
            let oldObj = system;
            for (let i = 0; i < parts.length - 1; i++) {
                obj = obj[parts[i]];
                oldObj = oldObj[parts[i]];
            }
            logChange.oldValue = oldObj[parts[parts.length - 1]];
            obj[parts[parts.length - 1]] = logChange.newValue;
        
        } else if (proposal.proposalType === 'HEURISTIC_ADDITION') {
            const newHeuristic = proposal.proposal.heuristic;
            logChange.target = 'behavioralHeuristics';
            logChange.newValue = newHeuristic;
            logChange.oldValue = 'N/A';
            modifiedSystem.behavioralHeuristics.push(newHeuristic);
        }

        await db.saveSystemMemory({ ...modifiedSystem, lastEvolutionAt: Date.now() }, true);
        
        const log: Omit<EvolutionLog, 'id'> = {
            timestamp: Date.now(),
            reasoning: proposal.proposal.reasoning,
            changes: [logChange],
            confidence: confidence,
            analysis: proposal.analysis,
            simulationResult: simulationResult,
        };
        await db.addEvolutionLog(log);

        cognitiveLogger.logAction({
            event: 'auto_evolution', stage: 'integrate',
            description: `Successfully integrated change to ${logChange.target} with ${confidence.toFixed(2)} confidence.`,
            impact: `Parameter '${logChange.target}' changed from '${logChange.oldValue}' to '${logChange.newValue}'.`,
            result: 'System memory updated and evolution logged.', rollback_used: true,
        });

        this.dispatchThought('Evolução concluída e integrada.', 'symbolic_log');
    }

    private dispatchThought(text: string, type: 'symbolic_log' | 'error') {
        window.dispatchEvent(new CustomEvent('nexus-thought-update', {
            detail: { type, text },
        }));
    }
}

let instance: SelfEvolutionServiceImpl | null = null;

export const selfEvolutionService = {
    create(opts: EvolutionServiceOptions): SelfEvolutionServiceImpl {
        if (!instance) {
            instance = new SelfEvolutionServiceImpl(opts);
        }
        return instance;
    }
};
