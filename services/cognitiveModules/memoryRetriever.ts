
import { db } from '../indexedDBService';
import { Concept, Intent } from '../../types';

// Simple keyword extraction (can be improved with NLP libraries in the future)
function extractKeywords(text: string): string[] {
    if (!text) return [];
    const stopWords = new Set(['de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'com', 'não', 'uma', 'os', 'no', 'na', 'por', 'mais', 'as', 'dos', 'como', 'mas', 'foi', 'ao', 'ele', 'das', 'tem', 'à', 'seu', 'sua']);
    return text
        .toLowerCase()
        .replace(/[^\p{L}\s]/gu, '') // Remove punctuation
        .split(/\s+/)
        .filter(word => word.length > 3 && !stopWords.has(word));
}


export async function retrieveRelevantMemories(userInput: string, intent: Intent): Promise<{ concepts: Concept[], reflections: string[] }> {
    const keywords = extractKeywords(userInput);
    
    if (keywords.length === 0 && intent !== 'complex_reasoning') {
        return { concepts: [], reflections: [] };
    }

    // 1. Retrieve concepts directly related to keywords
    const conceptsFromKeywords = (await db.getConceptsByNames(keywords)).filter(c => c !== undefined) as Concept[];
    
    // 2. Retrieve most confident concepts for general context
    const allConcepts = await db.getAllConcepts();
    const mostConfidentConcepts = allConcepts
        .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
        .slice(0, 5);

    // 3. Combine and deduplicate concepts
    const conceptMap = new Map<string, Concept>();
    [...conceptsFromKeywords, ...mostConfidentConcepts].forEach(c => conceptMap.set(c.name, c));
    const finalConcepts = Array.from(conceptMap.values());

    // 4. Retrieve reflections for complex reasoning
    let reflections: string[] = [];
    if (intent === 'complex_reasoning' || intent === 'self_reflection_query') {
        const systemMemory = await db.getSystemMemory();
        reflections = systemMemory.reflections?.slice(-3) || [];
    }
    
    return {
        concepts: finalConcepts,
        reflections: reflections,
    };
}
