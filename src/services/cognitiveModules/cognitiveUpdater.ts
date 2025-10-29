import { db, cognitiveLogger } from '@/services/indexedDBService';
import { CognitiveFrame, VisualState, CodeModificationProposal, UserContext } from '@/types';
import { neuralMemory } from '@/services/neuralMemory';
import { selfReflection } from '@/services/selfReflection';
import { EmotionalAgent } from '@/services/agents/emotionalAgent';
import { analyzeAndStoreConcepts } from '@/services/conceptEngine';
import { autonomousLearningService } from '@/services/autonomousLearningService';
import { adaptiveMemory } from '@/services/adaptiveMemory';

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
        analyzeAndStoreConcepts(userContext.userId, text), // Learn concepts from own response
        analyzeAndStoreConcepts(userContext.userId, frame.userInput) // Learn concepts from user input
    ];

    await Promise.all(postInteractionPromises).catch(error => {
        console.warn("[CognitiveUpdater] An error occurred during post-interaction processing:", error);
    });

    // Dispatch visual state update (can run after emotion has likely been updated)
    const updatedSystem = await db.getSystemMemory(userContext.userId);
    const emotionState = updatedSystem?.emotionState;
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

    // Trigger autonomous learning cycle in the background
    // This runs after the main response flow and does not block the UI
    autonomousLearningService.runLearningCycle(frame).catch(err => {
        console.warn('[CognitiveUpdater] Autonomous learning cycle failed in background:', err);
    });
}

// FIX: Added 'runCognitiveMaintenance' function to handle background memory optimization tasks.
export async function runCognitiveMaintenance(userId: string): Promise<void> {
    try {
        await Promise.all([
            adaptiveMemory.decayUnusedConcepts(userId),
            neuralMemory.decayAndConsolidateSynapses(userId)
        ]);
        console.log(`[CognitiveUpdater] Performed cognitive maintenance for user ${userId}.`);
    } catch (error) {
        console.error(`[CognitiveUpdater] Error during cognitive maintenance for user ${userId}:`, error);
    }
}
