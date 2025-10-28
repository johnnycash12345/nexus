import { CognitiveFrame } from '../../types';
import { analyzeAndEvolveEmotion } from '../emotionalEngine';
import { associativeReasoner } from '../associativeReasoner';

export class EmotionalAgent {
    constructor(private userId: string) {}

    async processInteraction(frame: CognitiveFrame): Promise<void> {
        if (!frame.llmResponse) return;

        // Run these in parallel as they don't depend on each other
        await Promise.all([
            analyzeAndEvolveEmotion(this.userId, frame.llmResponse.learningContext, frame.llmResponse.text),
            associativeReasoner.generateNewSynapses(frame)
        ]).catch(err => {
            console.warn("[EmotionalAgent] Error during post-interaction processing:", err);
        });
    }
}
