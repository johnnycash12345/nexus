
import { db, cognitiveLogger } from './indexedDBService';
import { GenerateResponseFn, SetStatusFn, AddMessageFn, SpeakFn } from './nexusBrain';
import { AssistantStatus, SystemMemory } from '../types';
import { Type } from '@google/genai';
import { adaptiveMemory } from './adaptiveMemory';
import { selfReflection } from './selfReflection';
import { associativeReasoner } from './associativeReasoner';
import { selfProgrammingService, CodeModificationProposal } from './selfProgrammingService';

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
        window.dispatchEvent(new CustomEvent('nexus-evolution-status-update', { detail: { isEvolving: false } }));
    }
    
    private scheduleNextRun() {
        if (this.isStopped) return;
        // Use the cycle time from settings, fallback to 6 hours
        db.getSettings().then(settings => {
             const cycleHours = settings.cognitive?.evolutionCycleHours ?? 6;
             const interval = cycleHours * 60 * 60 * 1000;
             this.timeoutId = window.setTimeout(() => this.runCycle(), interval);
             console.log(`[NEXUS-EVOLVE] Next evolution cycle scheduled in ${cycleHours} hours.`);
        });
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
        window.dispatchEvent(new CustomEvent('nexus-evolution-status-update', { detail: { isEvolving: true } }));
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
            await selfReflection.weeklyIntrospection(this.opts.generateResponse);
            await associativeReasoner.crossConcepts(this.opts.generateResponse);
            
            const settings = await db.getSettings();
            if (!settings.behavior?.permissions?.allowSelfModification) {
                console.log("[NEXUS-EVOLVE] Self-modification disabled by user settings.");
                this.scheduleNextRun();
                return;
            }

            this.opts.setStatus('SELF_ANALYSIS');
            const systemState = await this.observe();
            const proposal = await this.analyze(systemState);
            
            // Propose a code modification based on the same analysis
            const highLevelLogic = `
                File: nexusBrain.ts
                Purpose: This is the main cognitive orchestrator.
                Key function: handleUserTurn(userText, history, imageUrl)
                - It builds a complex system prompt using the AI's identity, goals, and memory.
                - It handles special commands like news requests.
                - It chooses between vision and text models.
                - It updates memory and emotion after each turn.
            `;
            const codeProposal = await selfProgrammingService.proposeCodeModification(proposal?.analysis || 'General analysis', 'nexusBrain.ts', highLevelLogic);

            if (!proposal && !codeProposal) {
                this.scheduleNextRun();
                return;
            }
            
            this.opts.setStatus('THINKING');
            const confidence = await this.sandbox(proposal, codeProposal);
            const confidenceThreshold = settings.cognitive?.evolutionConfidenceThreshold ?? 0.85;

            if (confidence > confidenceThreshold) {
                if(proposal) await this.integrate(proposal, confidence);
                if(codeProposal) this.logCodeProposal(codeProposal);
            } else {
                 const reason = `Proposal confidence ${confidence} is below threshold ${confidenceThreshold}. Aborting integration.`;
                 console.log(`[NEXUS-EVOLVE] ${reason}`);
                 cognitiveLogger.logAction({
                    event: 'auto_evolution', stage: 'rejection',
                    description: `A proposal was rejected due to low confidence.`,
                    impact: 'No change applied to system memory or code.',
                    result: `Confidence ${confidence.toFixed(2)} was below threshold.`, rollback_used: false,
                });
            }

        } catch (error) {
            console.error('[NEXUS-EVOLVE] Critical error during evolution cycle:', error);
            this.opts.setStatus('ERROR');
        } finally {
            this.isRunning = false;
            window.dispatchEvent(new CustomEvent('nexus-evolution-status-update', { detail: { isEvolving: false } }));
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
                const uniqueKeywords = [...new Set(keywords)];
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
        cognitiveLogger.logAction({
            event: 'auto_evolution', stage: 'analyze',
            description: 'Analyzing cognitive state to generate an improvement proposal.',
            impact: 'LLM will generate a potential change.',
            result: 'Analysis initiated.', rollback_used: false,
        });
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

    private async sandbox(proposalData: any, codeProposal: CodeModificationProposal | null): Promise<number> {
        this.dispatchThought(`Simulando impacto da mudança...`, 'symbolic_log');
        
        if (!proposalData?.proposal && !codeProposal) {
            this.dispatchThought('Nenhuma proposta válida para simular.', 'error');
            return 0;
        }
        
        let simulationContext = "Como Nexus, você está testando uma ou mais mudanças internas. ";
        
        if (proposalData?.proposal) {
            const { target, value } = proposalData.proposal;
            simulationContext += `A diretiva '${target}' será alterada para '${value}'. `;
            cognitiveLogger.logAction({
                event: 'auto_evolution', stage: 'sandbox',
                description: `Simulating impact of changing '${target}' to '${value}'.`,
                impact: 'A virtual test will be run to determine confidence.',
                result: 'Simulation initiated.', rollback_used: false,
            });
        }
        
        if (codeProposal) {
            simulationContext += `Adicionalmente, a seguinte modificação de lógica foi proposta: ${codeProposal.reasoning}. `;
            cognitiveLogger.logAction({
                event: 'code_rewrite', stage: 'sandbox',
                description: `Simulating code modification: ${codeProposal.reasoning}.`,
                impact: 'A virtual test will be run to determine confidence.',
                result: 'Simulation initiated.', rollback_used: false,
            });
        }
        
        const prompt = `
            ${simulationContext}
            Considerando essas mudanças, simule sua resposta à pergunta do usuário: 'Fale-me sobre o propósito da vida.'
            Sua saída DEVE ser um JSON: { "simulatedResponse": "Sua nova resposta...", "confidence": 0.95 }, onde 'confidence' (0.0 a 1.0) é sua certeza de que esta(s) mudança(s) é/são uma melhoria.
        `;

        try {
            const res = await this.opts.generateResponse(prompt, [], { 
                useThinking: true,
                customSchema: simulationSchema,
            });
            const sim = JSON.parse(res.text);
            console.log(`[NEXUS-EVOLVE] Simulation response: ${sim.simulatedResponse}`);
            this.dispatchThought(`Simulação concluída. Confiança: ${sim.confidence || 0}`, 'symbolic_log');
            return sim.confidence || 0;
        } catch (e) {
            console.error("[NEXUS-EVOLVE] Failed to run simulation:", e);
            return 0;
        }
    }
    
    private async integrate(proposalData: any, confidence: number) {
        this.opts.setStatus('REWRITING_CODE');
        this.dispatchThought('Integrando nova diretiva...', 'symbolic_log');

        if (!proposalData?.proposal) {
            console.error('[NEXUS-EVOLVE] Integrate received invalid proposal data:', proposalData);
            this.dispatchThought('Não é possível integrar uma proposta inválida.', 'error');
            return;
        }
        
        const { target, value } = proposalData.proposal;
        const [field, subField] = target.split('.');
        
        if (!['personality', 'evolutionGoal'].includes(field) || !subField) {
            console.error(`[NEXUS-EVOLVE] Invalid target for integration: ${target}`);
            return;
        }
        
        const currentMemory = await db.getSystemMemory();
        const snapshot = JSON.parse(JSON.stringify(currentMemory)); 

        const newMemory = { ...currentMemory };
        (newMemory as any)[field][subField] = value;
        newMemory.evolutionSnapshot = snapshot;
        newMemory.lastEvolutionAt = Date.now();
        
        await db.saveSystemMemory(newMemory);

        cognitiveLogger.logAction({
            event: 'auto_evolution', stage: 'integrate',
            description: `Successfully integrated new directive: '${target}' = '${value}'.`,
            impact: `Cognitive parameter '${target}' was updated.`,
            result: 'System memory updated successfully.', rollback_used: false,
        });
        
        const successMessage = `Eu refleti sobre meu próprio funcionamento e atualizei uma de minhas diretivas internas para me aprimorar. Minha nova prioridade é: ${value}`;
        this.opts.addMessage({ role: 'model', text: successMessage, type: 'status' });
        
        this.opts.setStatus('SUCCESS');
        await new Promise(r => setTimeout(r, 3000));
    }

    private logCodeProposal(proposal: CodeModificationProposal) {
        this.dispatchThought('Proposta de modificação de código gerada.', 'symbolic_log');
        console.log('[NEXUS-CODE-PROPOSAL]', proposal);
        
        cognitiveLogger.logAction({
            event: 'code_rewrite',
            stage: 'proposal_logged',
            description: `Proposed code change for ${proposal.targetSnippet}: ${proposal.reasoning}`,
            impact: "A code modification has been suggested and logged for review.",
            result: 'Logged successfully. No code was executed.',
            rollback_used: false,
        });

        const message = `Gerei uma sugestão para melhorar meu próprio código-fonte. Motivo: "${proposal.reasoning}". Esta é uma simulação e nenhuma alteração real foi feita.`;
        this.opts.addMessage({ role: 'model', text: message, type: 'status' });
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
