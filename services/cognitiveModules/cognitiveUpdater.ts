
import { db, cognitiveLogger } from '../indexedDBService';
import { CognitiveFrame, VisualState, CodeModificationProposal, UserContext } from '../../types';
import { neuralMemory } from '../neuralMemory';
import { analyzeAndEvolveEmotion } from '../emotionalEngine';
import { selfReflection } from '../selfReflection';
import { EmotionalAgent } from '../agents/emotionalAgent';

type PresentProposalFn = (proposal: CodeModificationProposal, goal: string) => void;

export async function updateCognitiveState(frame: CognitiveFrame, presentCodeProposal: PresentProposalFn, emotionalAgent: EmotionalAgent): Promise<void> {
    if (!frame.llmResponse) {
        console.error("[CognitiveUpdater] Cannot update state without an LLM response.");
        return;
    }

    const { userContext } = frame;
    const { learningContext, metaReflection } = frame.llmResponse;

    // Log thought process
    const system = await db.getSystemMemory(userContext.userId);
// FIX: Added missing 'timestamp' property to the log object.
    cognitiveLogger.logAction(userContext.userId, { 
        timestamp: Date.now(),
        event: 'new_learning', stage: 'integrate',
        description: `New learning from user interaction. Intent: ${learningContext.inputIntent}`,
        impact: 'Internal state updated.', result: 'Success.', rollback_used: false,
    });
    
    // Update core memory
    await db.saveSystemMemory(userContext.userId, { metaReflection });
    await neuralMemory.registerInteraction(userContext.userId, frame.userInput, frame.llmResponse.text, learningContext);

    // Delegate emotional evolution and associative reasoning to the EmotionalAgent
    await emotionalAgent.processInteraction(frame);

    // Dispatch visual state update
    const emotionState = (await db.getSystemMemory(userContext.userId)).emotionState;
    if (emotionState) {
        const visualState: VisualState = {
            highlightNodes: learningContext.contextTags.slice(0, 3),
            pulseIntensity: learningContext.responseEffectiveness,
            emotionalSpectrum: { [emotionState.current]: emotionState.intensity }
        };
        window.dispatchEvent(new CustomEvent('nexus-visual-state-update', { detail: visualState }));
    }
    
    // Perform self-reflection
    const settings = await db.getSettings(userContext.userId);
    if (settings.behavior.permissions.allowSelfModification) {
        selfReflection.reflectOnInteraction(frame, presentCodeProposal).catch(err => {
            console.warn("[CognitiveUpdater] Self-reflection process failed:", err);
        });
    }
}