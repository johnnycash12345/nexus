import { db, cognitiveLogger } from '../indexedDBService';
import { Source } from '../../types';
import { adaptiveMemory } from '../adaptiveMemory';
import { neuralMemory } from '../neuralMemory';

// Simple keyword extraction
function extractKeywords(text: string): string[] {
    if (!text) return [];
    const stopWords = new Set(['de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'com', 'não', 'uma', 'os', 'no', 'na', 'por', 'mais', 'as', 'dos', 'como', 'mas', 'foi', 'ao', 'ele', 'das', 'tem', 'à', 'seu', 'sua', 'ser', 'ter', 'pode']);
    return text
        .toLowerCase()
        .replace(/[^\p{L}\s]/gu, '')
        .split(/\s+/)
        .filter(word => word.length > 4 && !stopWords.has(word));
}

export async function integrateWebKnowledge(
    topic: string,
    summary: string,
    sources: Source[]
): Promise<void> {
    try {
        // 1. Create a reflection from the learning
        const reflection = `Aprendizado autônomo sobre '${topic}': ${summary.slice(0, 200)}...`;
        await db.addSystemReflection(reflection);

        // 2. Extract keywords and reinforce/create concepts
        const keywords = [topic, ...extractKeywords(summary)];
        const uniqueKeywords = [...new Set(keywords)];
        await adaptiveMemory.reinforceConcepts(uniqueKeywords);

        // 3. Create synapses between the topic and the new concepts
        await neuralMemory.createSynapses([topic], uniqueKeywords, 0.2);

        // 4. Log the cognitive event for transparency
        cognitiveLogger.logAction({
            event: 'knowledge_expansion',
            stage: 'web_learning',
            description: `Learned about "${topic}" from the web.`,
            impact: `Added new reflection and reinforced ${uniqueKeywords.length} related concepts.`,
            result: 'Memory updated with new information from web search.',
            rollback_used: false,
        });

        console.log(`[NEXUS-KNOWLEDGE] Integrated new knowledge about "${topic}".`);

    } catch (error) {
        console.error(`[NEXUS-KNOWLEDGE] Failed to integrate web knowledge for "${topic}":`, error);
    }
}
