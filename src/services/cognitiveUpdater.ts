import { db, cognitiveLogger } from './indexedDBService';
import { CognitiveFrame, VisualState, CodeModificationProposal } from '@/types';
import { neuralMemory } from '../neuralMemory';
import { selfReflection } from './selfReflection';
import { EmotionalAgent } from './agents/emotionalAgent';
import { analyzeAndStoreConcepts } from '../conceptEngine';

type PresentProposalFn = (proposal: CodeModificationProposal, goal: string) => void;

export async function updateCognitiveState(frame: CognitiveFrame, presentCodeProposal: PresentProposalFn, emotionalAgent: EmotionalAgent): Promise<void> {
    if (!frame.llmResponse) {
        console.error("[CognitiveUpdater] Cannot update state without an LLM response.");
        return;
    }

    const { userContext } = frame;
    const { text, learningContext, metaReflection } = frame.llmResponse;

    // Log the cognitive action
    cognitiveLogger.logAction(userContext.userId, { 
        timestamp: Date.now(),
        event: 'new_learning', stage: 'integrate',
        description: `New learning from user interaction. Intent: ${learningContext.inputIntent}`,
        impact: 'Internal state updated.', result: 'Success.', rollback_used: false,
    });
    
    // Update core memory with the latest reflection
    await db.saveSystemMemory(userContext.userId, { metaReflection });

    // Run various learning and state update processes in parallel for efficiency
    const postInteractionPromises = [
        neuralMemory.registerInteraction(userContext.userId, frame.userInput, text, learningContext),
        emotionalAgent.processInteraction(frame),
        analyzeAndStoreConcepts(userContext.userId, text) // New: Learn concepts from own response
    ];

    await Promise.all(postInteractionPromises).catch(error => {
        console.warn("[CognitiveUpdater] An error occurred during post-interaction processing:", error);
    });

    // Dispatch visual state update (can run after emotion has likely been updated)
    const updatedSystem = await db.getSystemMemory(userContext.userId);
    const emotionState = updatedSystem.emotionState;
    if (emotionState) {
        const visualState: VisualState = {
            highlightNodes: learningContext.contextTags.slice(0, 3),
            pulseIntensity: learningContext.responseEffectiveness,
            emotionalSpectrum: { [emotionState.current]: emotionState.intensity }
        };
        window.dispatchEvent(new CustomEvent('nexus-visual-state-update', { detail: visualState }));
    }
    
    // Perform self-reflection (can be fire-and-forget as it's a background meta-task)
    const settings = await db.getSettings(userContext.userId);
    if (settings.behavior.permissions.allowSelfModification) {
        selfReflection.reflectOnInteraction(frame, presentCodeProposal).catch(err => {
            console.warn("[CognitiveUpdater] Self-reflection process failed:", err);
        });
    }
}