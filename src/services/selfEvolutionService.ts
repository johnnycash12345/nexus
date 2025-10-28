import { db, cognitiveLogger } from './indexedDBService';
import { OrchestratorOptions, SystemMemory, EvolutionCyclePhase, EvolutionChange, EvolutionLog } from '@/types';
import { Type } from '@google/genai';
import { adaptiveMemory } from './adaptiveMemory';
import { reasoningEngine } from './reasoningEngine';
import { neuralMemory } from './neuralMemory';

// This is a placeholder since the full options aren't needed for this service's current implementation
interface EvolutionServiceOptions extends Pick<OrchestratorOptions, 'userId' | 'generateResponse'> {}

export interface SelfEvolutionService {
    start: () => void;
    stop: () => void;
}

// ... (schemas remain the same)

class SelfEvolutionServiceImpl implements SelfEvolutionService {
    private timeoutId: number | null = null;
    private isRunning = false;
    private isStopped = true;
    private opts: EvolutionServiceOptions;

    constructor(opts: EvolutionServiceOptions) {
        this.opts = opts;
    }

    start() { 
        this.isStopped = false;
        this.scheduleNextRun();
    }
    stop() { 
        this.isStopped = true;
        if(this.timeoutId) clearTimeout(this.timeoutId);
    }
    
    private scheduleNextRun() {
        if (this.isStopped) { this.updatePhase('PAUSED'); return; }
        db.getSettings(this.opts.userId).then(settings => {
             const cycleHours = settings.cognitive?.evolutionCycleHours ?? 6;
             const interval = cycleHours * 60 * 60 * 1000;
             this.timeoutId = window.setTimeout(() => this.runCycle(), interval);
             this.updatePhase('IDLE');
        });
    }
    
    private updatePhase(phase: EvolutionCyclePhase) { 
         window.dispatchEvent(new CustomEvent('nexus-evolution-status-update', {
            detail: { phase }
        }));
    }

    private async runCycle() {
        if (this.isStopped || this.isRunning || !navigator.onLine) return;
        this.isRunning = true;
        
        try {
            await neuralMemory.decayAndConsolidateSynapses(this.opts.userId);
            
            this.updatePhase('REASONING');
            const reasoningSummary = await reasoningEngine.runReasoningCycle(this.opts.generateResponse, this.opts.userId);
            
            const settings = await db.getSettings(this.opts.userId);
            if (!settings.behavior?.permissions?.allowSelfModification) {
                this.isRunning = false;
                this.scheduleNextRun();
                return;
            }

            this.updatePhase('OBSERVING');
            const systemState = await this.observe();
            
            this.updatePhase('ANALYZING');
            const proposal = await this.analyze(systemState, reasoningSummary);

            if (!proposal) { 
                this.isRunning = false;
                this.scheduleNextRun(); 
                return; 
            }
            
            this.updatePhase('SANDBOXING');
            const { confidence, simulationResult } = await this.sandbox(proposal);
            const confidenceThreshold = settings.cognitive?.evolutionConfidenceThreshold ?? 0.85;

            if (confidence > confidenceThreshold) {
                this.updatePhase('INTEGRATING');
                await this.integrate(proposal, confidence, simulationResult);
            }

        } catch (error) {
            console.error('[NEXUS-EVOLVE] Critical error during evolution cycle:', error);
        } finally {
            this.isRunning = false;
            this.scheduleNextRun();
        }
    }
    
    private async searchAndLearnFromWeb() {
        // ... uses this.opts.userId for DB calls
    }

    private async observe(): Promise<string> {
        const userId = this.opts.userId;
        const [system, concepts, logs] = await Promise.all([
            db.getSystemMemory(userId),
            db.getAllConcepts(userId),
            db.getLatestEvolutionLogs(userId, 5)
        ]);
        
        const stats = {
            conceptCount: concepts.length,
            interactionCount: system.interactionCount,
            recentEvolutions: logs.map((l: EvolutionLog): string => String(l.reasoning ?? 'N/A')),
        };
        return JSON.stringify(stats, null, 2);
    }
    
    private async analyze(state: string, reasoningSummary: string | null): Promise<any> {
        const prompt = `
            As the Nexus AI, analyze your current system state and recent reasoning insights to propose a single, impactful evolution for your personality or behavior.

            Current State Summary:
            ${state}

            Recent Reasoning Cycle Insights:
            ${reasoningSummary || "Nenhum insight gerado neste ciclo."}

            Propose a change to one of these system memory fields: 'personality', 'evolutionGoal', or 'outputEngine'.
            Your response must be a JSON object like: 
            { "target": "personality.curiosity", "newValue": 0.8, "reasoning": "My interactions show a lack of inquiry. Increasing curiosity should lead to more engaging conversations." }
        `;
        
        try {
            const response = await this.opts.generateResponse(prompt, [], { useThinking: true });
            const parsed = JSON.parse(response.text);
            if (parsed.target && parsed.newValue !== undefined && parsed.reasoning) {
                return parsed;
            }
        } catch (error) {
            console.error('[NEXUS-EVOLVE] Analysis phase failed:', error);
        }
        return null;
    }

    private async sandbox(proposal: any): Promise<{ confidence: number, simulationResult: string }> {
        const system = await db.getSystemMemory(this.opts.userId);
        // ... rest of implementation
        return { confidence: 0, simulationResult: "" };
    }

    private async integrate(proposal: any, confidence: number, simulationResult: string) {
        const userId = this.opts.userId;
        const system = await db.getSystemMemory(userId);
        await db.saveSystemMemory(userId, { evolutionSnapshot: { ...system } });

        const changes: EvolutionChange[] = [];
        let updatedSystem = { ...system };

        const [mainKey, subKey] = proposal.target.split('.');
        if (mainKey && subKey && updatedSystem[mainKey as keyof SystemMemory]) {
            const oldValue = (updatedSystem[mainKey as keyof SystemMemory] as any)[subKey];
            (updatedSystem[mainKey as keyof SystemMemory] as any)[subKey] = proposal.newValue;
            
            changes.push({
                target: proposal.target,
                oldValue: oldValue,
                newValue: proposal.newValue,
            });
        }
        
        updatedSystem.lastEvolutionAt = Date.now();
        
        await db.saveSystemMemory(userId, updatedSystem, true);
        
        const log: Omit<EvolutionLog, 'id'|'userId'> = { 
            reasoning: proposal.reasoning, 
            changes, 
            confidence, 
            timestamp: Date.now(), 
            simulationResult,
            analysis: `Evolved ${proposal.target} to ${proposal.newValue}.`
        };
        await db.addEvolutionLog(userId, log);
    }

    private dispatchThought(text: string, type: 'symbolic_log' | 'error') { /* ... */ }
}

let instance: SelfEvolutionServiceImpl | null = null;
export const selfEvolutionService = {
    create(opts: EvolutionServiceOptions): SelfEvolutionServiceImpl {
        // This should ideally manage instances per user, but for this app, we re-create it.
        instance = new SelfEvolutionServiceImpl(opts);
        return instance;
    }
};