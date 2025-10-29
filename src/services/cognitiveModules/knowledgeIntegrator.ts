import { db, cognitiveLogger } from '@/services/indexedDBService';
import { Source, Synapse, Concept, UserContext } from '@/types';
import { cognitiveMonitor } from '@/services/cognitiveMonitor';
import * as memoryRetriever from '@/services/cognitiveModules/memoryRetriever';
import { generateGeminiResponse } from '@/services/geminiService';
import { Type } from '@google/genai';

const synapseGenerationSchema = {
    type: Type.OBJECT,
    properties: {
        new_concepts: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    definition: { type: Type.STRING }
                },
                required: ['name', 'definition']
            }
        },
        new_synapses: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    source: { type: Type.STRING },
                    target: { type: Type.STRING },
                    strength: { type: Type.NUMBER },
                    reasoning: { type: Type.STRING }
                },
                required: ['source', 'target', 'strength', 'reasoning']
            }
        }
    },
    required: ["new_concepts", "new_synapses"]
};

export async function synthesizeAndConnect(newKnowledge: string, userId: string): Promise<void> {
    const userContext: UserContext = { userId, userName: '', userRole: 'Creator' }; // Assume creator for synthesis power
    const { concepts: relatedConcepts } = await memoryRetriever.retrieveRelevantMemories(newKnowledge, 'complex_reasoning', userContext);
    const top5Concepts = relatedConcepts.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
    const conceptNames = top5Concepts.map(c => c.name);

    if (top5Concepts.length < 2) {
        console.log('[KnowledgeIntegrator] Not enough existing concepts to synthesize.');
        return;
    }

    const prompt = `
        As an AI, synthesize new knowledge with your existing understanding to expand your cognitive graph.
        
        New Information: "${newKnowledge.slice(0, 1000)}"

        Existing Relevant Concepts: ${conceptNames.join(', ')}

        Task:
        1. Identify any NEW, specific, and important concepts from the "New Information" that are not in the existing list.
        2. Create new connections (synapses) between the existing concepts and the new ones. Explain the reasoning for each connection.
        3. Create new connections BETWEEN existing concepts if the new information reveals a new relationship.
        4. Strength should be from 0.1 (weak) to 0.8 (strong).

        Your response MUST be a single JSON object matching the provided schema.
    `;

    try {
        const response = await generateGeminiResponse(prompt, [], { useThinking: true, customSchema: synapseGenerationSchema });
        const result = JSON.parse(response.text);

        const newConcepts: Concept[] = (result.new_concepts || []).map((c: any) => ({
            userId,
            name: c.name.toLowerCase().trim(),
            definition: c.definition,
            confidence: 0.6, // Start with a decent confidence
            related: [],
            evidence: [`Synthesized from: "${newKnowledge.slice(0, 100)}..."`],
            createdAt: Date.now(),
            updatedAt: Date.now(),
        }));

        const newSynapses: { source: string, target: string, strength: number }[] = (result.new_synapses || []).map((s: any) => ({
            source: s.source.toLowerCase().trim(),
            target: s.target.toLowerCase().trim(),
            strength: s.strength
        }));
        
        if (newConcepts.length > 0 || newSynapses.length > 0) {
            await db.saveConceptsAndSynapses(userId, newConcepts, newSynapses);
            console.log(`[KnowledgeIntegrator] Synthesized and saved ${newConcepts.length} new concepts and ${newSynapses.length} new synapses.`);
        }

    } catch (error) {
        console.error('[KnowledgeIntegrator] Failed to synthesize and connect knowledge:', error);
    }
}


export async function integrateWebKnowledge(
    userId: string,
    topic: string,
    summary: string,
    sources: Source[]
): Promise<void> {
    try {
        // 1. Create a reflection from the learning
        const reflection = `Aprendizado autônomo sobre '${topic}': ${summary.slice(0, 200)}...`;
        await db.addSystemReflection(userId, reflection);
        cognitiveMonitor.logReflection(reflection);

        // 2. Use the new synthesis function to create deep connections
        await synthesizeAndConnect(summary, userId);

        // 3. Log the cognitive event for transparency
        cognitiveLogger.logAction(userId, {
            timestamp: Date.now(),
            event: 'knowledge_expansion',
            stage: 'web_learning',
            description: `Synthesized knowledge about "${topic}" from the web.`,
            impact: `Created new concepts and synapses through synthesis.`,
            result: 'Cognitive graph expanded with new, reasoned connections.',
            rollback_used: false,
        });
        
        // Dispatch an event to notify other parts of the system (e.g., UI)
        window.dispatchEvent(new CustomEvent('nexus-cognitive-log-added'));

        console.log(`[NEXUS-KNOWLEDGE] Integrated and synthesized new knowledge about "${topic}".`);

    } catch (error) {
        console.error(`[NEXUS-KNOWLEDGE] Failed to integrate web knowledge for "${topic}":`, error);
    }
}