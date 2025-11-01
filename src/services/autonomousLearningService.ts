import { CognitiveFrame } from '../types';
import { webSearchService } from './webSearchService';
import { integrateWebKnowledge } from './cognitiveModules/knowledgeIntegrator';
import { db } from './indexedDBService';

class AutonomousLearningService {
    private isLearning = false;

    public async runLearningCycle(frame: CognitiveFrame): Promise<void> {
        if (this.isLearning || !frame.llmResponse) return;

        const { learningContext } = frame.llmResponse;
        const { responseEffectiveness, inputIntent, contextTags } = learningContext;

        const shouldResearch = responseEffectiveness < 0.7 || inputIntent === 'complex_reasoning' || inputIntent === 'web_search';
        
        const settings = await db.getSettings(frame.userContext.userId);
        if (!shouldResearch || !settings.behavior.enableAutonomousLearning || !settings.behavior.permissions.allowApiAccess) {
            return;
        }
        
        this.isLearning = true;
        
        try {
            // Formulate a query from the most relevant tags, falling back to user input
            const query = contextTags.filter(tag => tag.length > 3).slice(0, 3).join(' ') || frame.userInput;
            if (!query || query.length < 5) return;

            window.dispatchEvent(new CustomEvent('nexus-thought-update', {
                detail: { type: 'symbolic_log', text: `Pesquisando mais sobre: "${query.slice(0, 30)}..."` },
            }));
            
            const reasoning = `Autonomous learning triggered due to low response effectiveness (${responseEffectiveness}) or complex intent (${inputIntent}).`;
            const searchResult = await webSearchService.search(frame.userContext.userId, query, reasoning);

            if (searchResult) {
                await integrateWebKnowledge(frame.userContext.userId, query, searchResult.summary, searchResult.sources);
            }
        } catch (error) {
            console.error('[AutonomousLearningService] Error during learning cycle:', error);
        } finally {
            this.isLearning = false;
        }
    }
}

export const autonomousLearningService = new AutonomousLearningService();