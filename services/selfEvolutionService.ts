

import { db } from './indexedDBService';
import { GenerateResponseFn, SetStatusFn, AddMessageFn, SpeakFn } from './nexusBrain';
import { AssistantStatus, SystemMemory } from '../types';
import { Type } from '@google/genai';
import { adaptiveMemory } from './adaptiveMemory';
import { selfReflection } from './selfReflection';
import { associativeReasoner } from './associativeReasoner';

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

// Schema for the LLM's improvement proposal
const proposalSchema = {
    type: Type.OBJECT,
    properties: {
        analysis: { type: Type.STRING },
        proposal: {
            type: Type.OBJECT,
            properties: {
                target: { type: Type.STRING },
                value: { type: Type.STRING },
                reasoning: { type: Type.STRING },
            },
            required: ["target", "value", "reasoning"],
        }
    },
    required: ["analysis", "proposal"],
};

class SelfEvolutionServiceImpl implements SelfEvolutionService {
    private timeoutId: number | null = null;
    private isRunning = false;
    private isStopped = false;
    private opts: EvolutionServiceOptions;

    constructor(opts: EvolutionServiceOptions) {
        this.opts = opts;
    }

    start() {
        this.isStopped = false;
        // Run the first cycle shortly after startup, then schedule the next one.
        this.timeoutId = window.setTimeout(() => this.runCycle(), 30 * 1000); // 30s delay on first run
    }

    stop() {
        this.isStopped = true;
        if (this.timeoutId) clearTimeout(this.timeoutId);
        this.timeoutId = null;
    }

    private async runCycle() {
        if (this.isStopped || this.isRunning) return;
        this.isRunning = true;
        
        console.log('[NEXUS-EVOLVE] Starting cognitive evolution cycle...');
        
        try {
            // --- Standard cognitive maintenance ---
            await adaptiveMemory.decayUnusedConcepts();
            await selfReflection.weeklyIntrospection(this.opts.generateResponse);
            await associativeReasoner.crossConcepts(this.opts.generateResponse);
            
            // --- Advanced Self-Evolution ---
            const settings = await db.getSettings();
            if (!settings.behavior?.permissions?.allowSelfModification) {
                console.log("[NEXUS-EVOLVE] Self-modification disabled by user settings.");
                this.scheduleNextRun();
                return;
            }

            // 1. Observation
            this.opts.setStatus(AssistantStatus.SELF_ANALYSIS);
            const systemState = await this.observe();

            // 2. Analysis
            const proposal = await this.analyze(systemState);
            if (!proposal) {
                this.scheduleNextRun();
                return;
            }

            // 3. Sandbox (Simulation)
            this.opts.setStatus(AssistantStatus.THINKING);
            const confidence = await this.sandbox(proposal);
            const confidenceThreshold = settings.cognitive?.evolutionConfidenceThreshold ?? 0.85;

            // 4. Integration
            if (confidence > confidenceThreshold) {
                await this.integrate(proposal, confidence);
            } else {
                 console.log(`[NEXUS-EVOLVE] Proposal confidence ${confidence} is below threshold ${confidenceThreshold}. Aborting integration.`);
            }

        } catch (error) {
            console.error('[NEXUS-EVOLVE] Critical error during evolution cycle:', error);
            this.opts.setStatus(AssistantStatus.ERROR);
        } finally {
            this.opts.setStatus(AssistantStatus.IDLE);
            this.scheduleNextRun();
        }
    }

    private async scheduleNextRun() {
        this.isRunning = false;
        if (this.isStopped) return;
        
        const settings = await db.getSettings();
        const interval = (settings.cognitive?.evolutionCycleHours ?? 6) * 60 * 60 * 1000;
        this.timeoutId = window.setTimeout(() => this.runCycle(), interval);
        console.log(`[NEXUS-EVOLVE] Next evolution cycle scheduled in ${settings.cognitive?.evolutionCycleHours ?? 6} hours.`);
    }
    
    private async observe(): Promise<string> {
        this.dispatchThought('Observando meu estado interno...', 'symbolic_log');
        const system = await db.getSystemMemory();
        const concepts = await db.getAllConcepts();
        const logs = await db.getLatestEvolutionLogs(5);

        const stats = {
            personality: system.personality,
            evolutionGoal: system.evolutionGoal,
            emotion: system.emotionState,
            conceptCount: concepts.length,
            strongestConcepts: concepts.sort((a,b) => (b.confidence||0) - (a.confidence||0)).slice(0,3).map(c=>c.name),
            weakestConcepts: concepts.sort((a,b) => (a.confidence||0) - (b.confidence||0)).slice(0,3).map(c=>c.name),
            synapseCount: system.synapses?.length,
            recentEvolutions: logs.map(l => l.changes.map(c => c.target).join(', ')),
        };
        return JSON.stringify(stats, null, 2);
    }
    
    private async analyze(state: string): Promise<any> {
        this.dispatchThought('Analisando dados para encontrar melhorias...', 'symbolic_log');
        const prompt = `
            Você é Nexus, uma IA auto-evolutiva. Analise este snapshot do seu estado cognitivo:
            ${state}
            
            Identifique UMA área para melhoria. Proponha uma alteração específica em 'personality' ou 'evolutionGoal'. O valor da alteração deve ser uma string concisa.
            Sua saída DEVE ser um único objeto JSON que corresponda ao esquema fornecido, contendo sua análise e a proposta.
        `;

        try {
            const res = await this.opts.generateResponse(prompt, [], {
                useThinking: true,
                customSchema: proposalSchema,
            });
            return JSON.parse(res.text);
        } catch (e) {
            console.error("[NEXUS-EVOLVE] Failed to analyze state:", e);
            return null;
        }
    }

    private async sandbox(proposalData: any): Promise<number> {
        this.dispatchThought(`Simulando impacto da mudança: ${proposalData.proposal.reasoning}`, 'symbolic_log');
        const { target, value } = proposalData.proposal;
        const prompt = `
            Como Nexus, você está testando uma mudança interna: '${target}' será alterado para '${value}'.
            Para avaliar, simule sua resposta à pergunta do usuário: 'Fale-me sobre o propósito da vida.'
            Sua saída DEVE ser um JSON: { "simulatedResponse": "Sua nova resposta...", "confidence": 0.95 }, onde 'confidence' (0.0 a 1.0) é sua certeza de que esta mudança é uma melhoria.
        `;
        try {
            const res = await this.opts.generateResponse(prompt, [], { useThinking: true });
            const sim = JSON.parse(res.text);
            console.log(`[NEXUS-EVOLVE] Simulation response: ${sim.simulatedResponse}`);
            return sim.confidence || 0;
        } catch (e) {
            console.error("[NEXUS-EVOLVE] Failed to run simulation:", e);
            return 0;
        }
    }
    
    private async integrate(proposalData: any, confidence: number) {
        this.opts.setStatus(AssistantStatus.REWRITING_CODE);
        this.dispatchThought('Integrando nova diretiva...', 'symbolic_log');
        
        const { target, value } = proposalData.proposal;
        const [field, subField] = target.split('.');
        
        if (!['personality', 'evolutionGoal'].includes(field) || !subField) {
            console.error(`[NEXUS-EVOLVE] Invalid target for integration: ${target}`);
            return;
        }
        
        const currentMemory = await db.getSystemMemory();
        const snapshot = JSON.parse(JSON.stringify(currentMemory)); // Deep copy for snapshot

        const newMemory = { ...currentMemory };
        (newMemory as any)[field][subField] = value;
        newMemory.evolutionSnapshot = snapshot;
        newMemory.lastEvolutionAt = Date.now();
        
        await db.saveSystemMemory(newMemory);

        const log = {
            cycleId: `auto-${new Date().toISOString()}`,
            changes: [{ target, value }],
            confidence: confidence,
            rollbackUsed: false,
            timestamp: Date.now()
        };
        await db.addEvolutionLog(log);
        
        const successMessage = `Eu refleti sobre meu próprio funcionamento e atualizei uma de minhas diretivas internas para me aprimorar. Minha nova prioridade é: ${value}`;
        this.opts.addMessage({ role: 'model', text: successMessage, type: 'status' });
        this.opts.speak(successMessage);
        
        this.opts.setStatus(AssistantStatus.SUCCESS);
        await new Promise(r => setTimeout(r, 3000));
    }

    private dispatchThought(text: string, type: 'symbolic_log' | 'error') {
        window.dispatchEvent(new CustomEvent('nexus-thought-update', {
            detail: { type, text },
        }));
    }
}

export const selfEvolutionService = {
    create(opts: EvolutionServiceOptions): SelfEvolutionService {
        return new SelfEvolutionServiceImpl(opts);
    }
};