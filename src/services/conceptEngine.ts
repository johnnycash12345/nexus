import { GoogleGenAI, Type } from '@google/genai';
import { db } from './indexedDBService';
import { Concept } from '../types';
import { cognitiveMonitor } from './cognitiveMonitor';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const conceptExtractionSchema = {
    type: Type.OBJECT,
    properties: {
        concepts: {
            type: Type.ARRAY,
            items: {
                type: Type.STRING,
                description: "A single, significant concept, keyword, or named entity from the text. Should be 1-3 words."
            },
            description: "An array of key concepts extracted from the text."
        }
    },
    required: ["concepts"]
};

/**
 * Extracts key concepts from a text using a combination of simple regex and a Gemini model call.
 * @param text The text to analyze.
 * @returns A promise that resolves to an array of unique concept strings.
 */
export async function extractConcepts(text: string): Promise<string[]> {
    const geminiConcepts: string[] = [];
    const regexConcepts: string[] = [];
    
    // Simple regex for capitalized words or phrases (potential proper nouns)
    const regex = /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\b/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
        // Avoid adding very short "proper nouns" that are likely just start of sentences.
        if (match[0].length > 3) {
            regexConcepts.push(match[0]);
        }
    }
    
    // Gemini call for more nuanced extraction
    const prompt = `
        Analyze the following text and extract up to 5 of the most important and unique concepts, keywords, or named entities.
        Each concept should be concise (1-3 words).
        Do not extract generic words. Focus on specific topics.

        Text to analyze: "${text}"

        Your response MUST be a single JSON object matching the provided schema, with a "concepts" array.
    `;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', // Flash is sufficient for this background task
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: conceptExtractionSchema,
            }
        });

        const parsed = JSON.parse(response.text);
        if (parsed.concepts && Array.isArray(parsed.concepts)) {
            const conceptsFromAI = parsed.concepts.filter((c: any) => typeof c === 'string' && c.trim().length > 0);
            geminiConcepts.push(...conceptsFromAI);
        }
    } catch (error) {
        console.warn('[ConceptEngine] Gemini concept extraction failed:', error);
    }
    
    // Combine, normalize, and deduplicate
    const allConcepts = [...regexConcepts, ...geminiConcepts].map(c => c.toLowerCase().trim().replace(/[.,]$/, ''));
    return [...new Set(allConcepts)];
}

/**
 * Saves a list of new concepts to the database, avoiding duplicates.
 * @param userId The ID of the user.
 * @param newConcepts An array of concept strings to save.
 * @param source A string describing the source of these concepts.
 * @returns The number of concepts that were newly added (not just updated).
 */
export async function saveConcepts(userId: string, newConcepts: string[], source: string): Promise<number> {
    if (!newConcepts || newConcepts.length === 0) {
        return 0;
    }
    
    const conceptsFromDb = await db.getConceptsByNames(userId, newConcepts);
    const conceptsToCreate: string[] = [];

    newConcepts.forEach((conceptName, index) => {
        if (!conceptsFromDb[index]) {
            conceptsToCreate.push(conceptName);
            cognitiveMonitor.logConcept(conceptName);
        }
        // Always call learnConcept to reinforce existing concepts
        db.learnConcept(userId, conceptName, {}, source);
    });

    return conceptsToCreate.length;
}

/**
 * Retrieves concepts for a user from the database.
 * @param userId The ID of the user.
 * @param limit Optional limit on the number of concepts to return.
 * @returns An object containing the total count and the items.
 */
export async function getConcepts(userId: string, limit?: number): Promise<{ total: number; items: Concept[] }> {
    const allConcepts = await db.getAllConcepts(userId);
    allConcepts.sort((a, b) => b.confidence - a.confidence);
    
    const items = limit ? allConcepts.slice(0, limit) : allConcepts;
    
    return {
        total: allConcepts.length,
        items: items
    };
}


/**
 * High-level function to analyze text, extract concepts, and store them.
 * This is the primary function to be used by other parts of the application.
 * @param userId The user's ID.
 * @param text The text to analyze.
 * @param source An optional string describing where the text came from.
 * @returns A promise that resolves to the number of NEW concepts added to memory.
 */
export async function analyzeAndStoreConcepts(userId: string, text: string, source?: string): Promise<number> {
    if (!text || text.trim().length < 20) {
        return 0; // Not enough text to be worth analyzing
    }

    try {
        const extracted = await extractConcepts(text);
        if (extracted.length === 0) return 0;

        const evidence = source || `Extracted from text: "${text.slice(0, 100)}..."`;
        const newCount = await saveConcepts(userId, extracted, evidence);
        
        if (newCount > 0) {
            console.log(`[ConceptEngine] Stored ${newCount} new concepts: ${extracted.join(', ')}.`);
        }
        
        return newCount;
    } catch (error) {
        console.error('[ConceptEngine] Failed to analyze and store concepts:', error);
        return 0;
    }
}