import { db } from '../indexedDBService';
import { Concept, Intent, UserContext } from '../../types';

function extractKeywords(text: string): string[] {
    // A simplified keyword extractor. In a real-world scenario, this would be more robust.
    const stopWords = new Set(['de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'com', 'não', 'uma', 'os', 'no', 'na', 'por', 'mais', 'as', 'dos', 'como', 'mas', 'foi', 'ao', 'ele', 'das', 'tem', 'à', 'seu', 'sua']);
    if (!text) return [];
    return text.toLowerCase()
        .replace(/[^\p{L}\s]/gu, '')
        .split(/\s+/)
        .filter(word => word.length > 3 && !stopWords.has(word));
}

export async function retrieveRelevantMemories(userInput: string, intent: Intent, userContext: UserContext): Promise<{ concepts: Concept[], reflections: string[] }> {
    const keywords = extractKeywords(userInput);
    const { userId } = userContext;

    if (keywords.length === 0 && intent !== 'complex_reasoning' && intent !== 'self_reflection_query') {
        return { concepts: [], reflections: [] };
    }

    const [conceptsFromKeywords, allConcepts, systemMemory] = await Promise.all([
        db.getConceptsByNames(userId, keywords),
        db.getAllConcepts(userId),
        (intent === 'complex_reasoning' || intent === 'self_reflection_query') ? db.getSystemMemory(userId) : null
    ]);
    
    const validConceptsFromKeywords = conceptsFromKeywords.filter(c => c !== undefined) as Concept[];
    const mostConfidentConcepts = allConcepts.sort((a, b) => b.confidence - a.confidence).slice(0, 5);

    const conceptMap = new Map<string, Concept>();
    [...validConceptsFromKeywords, ...mostConfidentConcepts].forEach(c => conceptMap.set(c.name, c));
    
    // FIX: reflections array contains strings, so no need to map over .text property.
    const reflections = systemMemory?.reflections?.slice(-3) || [];
    
    return {
        concepts: Array.from(conceptMap.values()),
        reflections: reflections,
    };
}
