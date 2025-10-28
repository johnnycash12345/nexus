import { db } from './indexedDBService';
import { CognitiveFrame } from '../types';
import { generateGeminiResponse } from './geminiService';
import { neuralMemory } from './neuralMemory';
import { Type } from '@google/genai';

const synapseSchema = {
    type: Type.OBJECT,
    properties: {
        connections: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    source: { type: Type.STRING },
                    target: { type: Type.STRING },
                    reasoning: { type: Type.STRING },
                    strength: { type: Type.NUMBER }
                },
                required: ["source", "target", "reasoning", "strength"]
            }
        }
    },
    required: ["connections"]
};

class AssociativeReasoner {
    async generateNewSynapses(frame: CognitiveFrame): Promise<void> {
        const concepts = frame.retrievedConcepts;
        const reflection = frame.llmResponse?.metaReflection?.analysis;

        if (!reflection || !concepts || concepts.length < 2) {
            return;
        }

        const conceptNames = concepts.slice(0, 4).map(c => c.name);
        const userTone = frame.llmResponse?.learningContext?.emotionalTone || 'neutro';

        const prompt = `
            As an AI, find non-obvious, creative, or insightful connections between the following concepts, inspired by the recent reflection.
            The user's emotional tone during this interaction was perceived as '${userTone}'. Prioritize connections that might be helpful, insightful, or comforting given this context.
            
            Reflection: "${reflection}"
            Concepts: ${conceptNames.join(', ')}

            Create a list of new connections (synapses). Each connection must link two of the provided concepts.
            - 'reasoning' should explain the new relationship.
            - 'strength' should be a value from 0.1 (tenuous link) to 0.5 (strong insight).
            
            Your response MUST be a single JSON object matching the provided schema, with a 'connections' array. Do not return empty connections.
        `;

        try {
            const response = await generateGeminiResponse(prompt, [], { useThinking: true, customSchema: synapseSchema });
            const parsed = JSON.parse(response.text);

            if (parsed.connections && Array.isArray(parsed.connections) && parsed.connections.length > 0) {
                const validConnections = parsed.connections.filter(
                    (conn: any) => 
                        conn.source && conn.target &&
                        conceptNames.includes(conn.source) && 
                        conceptNames.includes(conn.target) && 
                        conn.source !== conn.target
                );

                if (validConnections.length > 0) {
                    await neuralMemory.addSynapses(validConnections);
                }
            }
        } catch (error) {
            console.error("[AssociativeReasoner] Failed to generate new synapses:", error);
        }
    }
}

export const associativeReasoner = new AssociativeReasoner();