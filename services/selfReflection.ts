import { CognitiveFrame, CodeModificationProposal } from '../types';
import { selfProgrammingService } from './selfProgrammingService';

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
}

export const selfReflection = new SelfReflection();
