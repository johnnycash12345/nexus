import { db } from '../indexedDBService';
import { Concept, Intent, UserContext } from '@/types';

function extractKeywords(text: string): string[] {
    // A simplified keyword extractor. In a real-world scenario, this would be more robust.
    const stopWords = new Set(['de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'com', 'não', 'uma', 'os', 'no', 'na', 'por', 'mais', 'as', 'dos', 'como', 'mas', 'foi', 'ao', 'ele', 'das', 'tem', 'à', 'seu', 'sua']);
    if (!text) return [];
    return text.toLowerCase()
        .replace(/[^\p{L}\s]/gu, '')
        .split(/\s+/)
        .filter(word => word.length > 3 && !stopWords.has(word));
}

export async function retrieveRelevantMemories(userInput: string, intent: Intent, userContext: UserContext): Promise<{ concepts: Concept[], reflections: string[], reasoningDepth: number }> {
    const keywords = extractKeywords(userInput);
    const { userId } = userContext;
    let reasoningDepth = 0;

    if (keywords.length === 0 && intent !== 'complex_reasoning' && intent !== 'self_reflection_query') {
        return { concepts: [], reflections: [], reasoningDepth: 0 };
    }

    const [conceptsFromKeywords, allConcepts, systemMemory] = await Promise.all([
        db.getConceptsByNames(userId, keywords),
        db.getAllConcepts(userId),
        db.getSystemMemory(userId) // Always fetch system memory to get synapses
    ]);
    
    const conceptMap = new Map<string, Concept>();
    
    // 1. Add seed concepts from keywords
    const seedConcepts = conceptsFromKeywords.filter(c => c !== undefined) as Concept[];
    seedConcepts.forEach(c => conceptMap.set(c.name, c));

    // 2. Traverse synapses from seed concepts
    const synapses = systemMemory?.synapses || [];
    const highConfidenceSynapses = synapses.filter(s => s.strength > 0.5); // Prioritize high-confidence

    let conceptsToExplore = [...seedConcepts.map(c => c.name)];
    const explored = new Set<string>(conceptsToExplore);
    const traversalLimit = 2; // How many "hops" to make

    for (let i = 0; i < traversalLimit && conceptsToExplore.length > 0; i++) {
        const nextLayer: string[] = [];
        for (const conceptName of conceptsToExplore) {
            highConfidenceSynapses.forEach(synapse => {
                let neighbor: string | null = null;
                if (synapse.source === conceptName) neighbor = synapse.target;
                else if (synapse.target === conceptName) neighbor = synapse.source;

                if (neighbor && !explored.has(neighbor)) {
                    nextLayer.push(neighbor);
                    explored.add(neighbor);
                }
            });
        }
        if (nextLayer.length > 0) {
            reasoningDepth++;
        }
        conceptsToExplore = nextLayer;
    }

    // 3. Retrieve the concepts found through traversal
    if (explored.size > seedConcepts.length) {
        const conceptsFromTraversal = (await db.getConceptsByNames(userId, Array.from(explored)))
            .filter(c => c !== undefined) as Concept[];
        conceptsFromTraversal.forEach(c => conceptMap.set(c.name, c));
    }
    
    // 4. Add top confident concepts as a fallback/boost
    const mostConfidentConcepts = allConcepts.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
    mostConfidentConcepts.forEach(c => {
        if (!conceptMap.has(c.name)) {
            conceptMap.set(c.name, c);
        }
    });

    const reflections = systemMemory?.reflections?.slice(-3) || [];
    
    return {
        concepts: Array.from(conceptMap.values()),
        reflections,
        reasoningDepth,
    };
}