import { db, cognitiveLogger } from '../indexedDBService';
import { CognitiveFrame, VisualState, CodeModificationProposal } from '../../types';
import { neuralMemory } from '../neuralMemory';
import { analyzeAndEvolveEmotion } from '../emotionalEngine';
import { associativeReasoner } from '../associativeReasoner';
import { selfReflection } from '../selfReflection';

type PresentProposalFn = (proposal: CodeModificationProposal, goal: string) => void;

export async function updateCognitiveState(frame: CognitiveFrame, presentCodeProposal: PresentProposalFn): Promise<void> {
    if (!frame.llmResponse) {
        console.error("[CognitiveUpdater] Cannot update state without an LLM response in the frame.");
        return;
    }

    const { learningContext, metaReflection } = frame.llmResponse;
    const system = await db.getSystemMemory();

    // 1. Log the core thought process for transparency
    cognitiveLogger.logThought({
        category: 'decision-making',
        context: `Respondendo ao usuário: "${frame.userInput.slice(0, 50)}"`,
        summary: metaReflection.analysis,
        emotion: system.emotionState?.current ?? 'CALM',
        confidence: learningContext.responseEffectiveness
    });

    // 2. Update core system memory with the latest meta-reflection
    await db.saveSystemMemory({ metaReflection });

    // 3. Update neural memory (concepts and synapses) based on the interaction
    await neuralMemory.registerInteraction(frame.userInput, frame.llmResponse.text, learningContext);

    // 4. Evolve emotional state based on the interaction's outcome
    await analyzeAndEvolveEmotion(learningContext, frame.llmResponse.text);

    // 5. Dispatch visual state update for the UI
    const emotionState = (await db.getSystemMemory()).emotionState;
    if (emotionState) {
        const visualState: VisualState = {
            highlightNodes: learningContext.contextTags.slice(0, 3),
            pulseIntensity: learningContext.responseEffectiveness,
            emotionalSpectrum: { [emotionState.current]: emotionState.intensity }
        };
        window.dispatchEvent(new CustomEvent('nexus-visual-state-update', { detail: visualState }));
    }
    
    // 6. Trigger associative reasoning to form new connections (don't await, let it run in background)
    associativeReasoner.generateNewSynapses(frame).catch(err => {
        console.warn("[CognitiveUpdater] Associative reasoning process failed:", err);
    });

    // 7. Perform self-reflection on the interaction's effectiveness
    const settings = await db.getSettings();
    if (settings.behavior.permissions.allowSelfModification) {
        selfReflection.reflectOnInteraction(frame, presentCodeProposal).catch(err => {
            console.warn("[CognitiveUpdater] Self-reflection process failed:", err);
        });
    }
}