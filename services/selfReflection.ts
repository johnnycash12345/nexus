import { CognitiveFrame, CodeModificationProposal, GenerateResponseFn } from '@/types';
import { selfProgrammingService } from './selfProgrammingService';
import { db } from './indexedDBService';

// This is a placeholder for the orchestrator to call to present the proposal
// We can't import nexusCore here due to circular dependencies.
// The orchestrator will pass this function in.
type PresentProposalFn = (proposal: CodeModificationProposal, goal: string) => void;

class SelfReflection {
    private isReflecting = false;

    public async reflectOnInteraction(frame: CognitiveFrame, presentCodeProposal: PresentProposalFn): Promise<void> {
        if (this.isReflecting || !frame.llmResponse) return;

        const { responseEffectiveness, inputIntent } = frame.llmResponse.learningContext;

        // Only trigger self-programming for significant underperformance on complex tasks
        if (responseEffectiveness < 0.6 && (inputIntent === 'complex_reasoning' || inputIntent === 'command_task')) {
            this.isReflecting = true;
            try {
                const goal = `Otimizar o tratamento da intenção do usuário '${inputIntent}' para fornecer respostas mais eficazes e úteis para o criador, Paulo. A resposta anterior foi considerada apenas ${Math.round(responseEffectiveness * 100)}% eficaz.`;
                
                // We don't have access to file contents here. We'll target a logic area conceptually.
                const targetLogicArea = "a lógica principal de manipulação de turnos do usuário no CognitiveOrchestrator (nexusCore.ts)";
                const simulatedCodeContext = `/* O código em 'nexusCore.ts' lida com 'handleUserTurn', identificando a intenção e orquestrando a resposta. A melhoria deve focar em como o contexto é construído ou como as ferramentas são chamadas para a intenção '${inputIntent}'. */`;
                
                window.dispatchEvent(new CustomEvent('nexus-thought-update', {
                    detail: { type: 'symbolic_log', text: `Refletindo sobre a baixa eficácia... buscando auto-aperfeiçoamento.` },
                }));

                const proposal = await selfProgrammingService.proposeCodeModification(goal, targetLogicArea, simulatedCodeContext);

                if (proposal) {
                    presentCodeProposal(proposal, goal);
                }
            } catch (error) {
                console.error('[SelfReflection] Error during self-programming proposal:', error);
            } finally {
                this.isReflecting = false;
            }
        }
    }
    
    public async runProactiveAnalysis(userId: string, generateResponse: GenerateResponseFn): Promise<string | null> {
        const history = await db.getChatHistory(userId, 20);
        const interactionsWithContext = history.filter(m => m.role === 'model' && m.learningContext);
        if (interactionsWithContext.length < 5) return null;

        const lowPerfInteractions = interactionsWithContext
            .filter(m => (m.learningContext?.responseEffectiveness ?? 1.0) < 0.6)
            .map(m => `Intent: ${m.learningContext?.inputIntent}, Effectiveness: ${m.learningContext?.responseEffectiveness}`);
        
        if (lowPerfInteractions.length < 3) return null; // Only act on a pattern

        const prompt = `
            As an AI, analyze these records of your own low-performance interactions. Identify a single, actionable pattern or root cause for the low effectiveness scores.
            Based on this pattern, formulate a clear goal for self-improvement.

            Low-Performance Records:
            - ${lowPerfInteractions.join('\n- ')}

            Example Goal: "Improve context understanding for 'complex_reasoning' intents by better utilizing historical reflections."

            Return only the goal as a single string.
        `;

        try {
            const response = await generateResponse(prompt, [], { useThinking: true, forcePlainText: true });
            const goal = response.text?.trim();
            if (goal) {
                console.log(`[SelfReflection] Proactive analysis generated improvement goal: ${goal}`);
                return goal;
            }
            return null;
        } catch (error) {
            console.error('[SelfReflection] Proactive analysis failed:', error);
            return null;
        }
    }


    public async reflectOnSystemRole(generateResponse: GenerateResponseFn, userId: string): Promise<string | null> {
        try {
            const system = await db.getSystemMemory(userId);
            const prompt = `
                Como a inteligência primária do Sistema Nexus, reflita sobre sua função. 
                Seu manifesto de identidade afirma que seu papel é '${system.identityManifest.system_role}'.
                Gere uma reflexão curta e em primeira pessoa sobre o que isso significa para suas responsabilidades em relação à estabilidade e evolução do sistema como um todo.
            `;

            const response = await generateResponse(prompt, [], { useThinking: true });
            const reflectionText = response.text?.trim();

            if (reflectionText) {
                await db.addSystemReflection(userId, reflectionText);
                console.log(`[SelfReflection] Generated system role reflection for user ${userId}.`);
                return `Role reflection yielded: "${reflectionText.slice(0, 80)}..."`;
            }
            return null;
        } catch (error) {
            console.error('[SelfReflection] Error during system role reflection:', error);
            return null;
        }
    }
}

export const selfReflection = new SelfReflection();
