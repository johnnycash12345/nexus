import { db } from './indexedDBService';
import { generateGeminiResponse } from './geminiService';
import { Type } from '@google/genai';
import { ChatMessage, GenerateResponseFn, AppSettings } from '@/types';
import { systemMonitor } from './systemMonitor';

const reflectionSchema = {
    type: Type.OBJECT,
    properties: {
        summary: { type: Type.STRING, description: "A brief summary of the conversation." },
        keyInsight: { type: Type.STRING, description: "A single, non-obvious insight, deduction, or new connection derived from the conversation." },
        newConcepts: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "A list of new, specific concepts or topics introduced in the conversation."
        }
    },
    required: ["summary", "keyInsight", "newConcepts"]
};

class ReflectionEngine {
    private isReflecting = false;

    public async reflect(userId: string, generateResponse: GenerateResponseFn, settings: AppSettings): Promise<void> {
        if (this.isReflecting) {
            console.info('[ReflectionEngine] Already reflecting, skipping cycle.');
            return;
        }

        if (systemMonitor.isDeviceUnderStrain()) {
            console.info(`[ReflectionEngine] Skipping cycle due to device strain: ${systemMonitor.getStrainReason()}`);
            return;
        }

        this.isReflecting = true;
        console.info('[ReflectionEngine] Starting background reflection cycle...');

        try {
            const history = await db.getChatHistory(userId, 30);
            if (history.length < 5) {
                console.info('[ReflectionEngine] Not enough conversation history to reflect.');
                return;
            }

            const conversation = history.map(m => `${m.role}: ${m.text}`).join('\n');
            const systemMemory = await db.getSystemMemory(userId);
            const lastReflection = systemMemory.reflections[systemMemory.reflections.length - 1];

            const prompt = `
                As the AI Nexus, reflect on the following recent conversation. Your goal is to derive deeper meaning and expand your knowledge.
                Avoid repeating previous reflections.

                Previous Reflection: "${lastReflection || 'None yet.'}"

                Recent Conversation:
                ---
                ${conversation}
                ---

                Based on this conversation, generate a new reflection. Your response MUST be a single JSON object with:
                1.  'summary': A brief summary of what was discussed.
                2.  'keyInsight': A non-obvious insight, conclusion, or a new connection you've made.
                3.  'newConcepts': A list of new, specific, and important topics or entities mentioned that you should learn more about.
            `;
            
            const useThinking = settings.cognitive.learningModel === 'gemini-2.5-pro';
            const response = await generateResponse(prompt, [], { useThinking, customSchema: reflectionSchema });
            const result = JSON.parse(response.text);

            if (!result || !result.keyInsight) {
                console.warn('[ReflectionEngine] Reflection generation did not produce a valid insight.');
                return;
            }

            const { summary, keyInsight, newConcepts } = result;
            
            // 1. Add reflection to memory
            const reflectionText = `Reflexão sobre a conversa recente: ${keyInsight} (Resumo: ${summary})`;
            await db.addSystemReflection(userId, reflectionText);
            console.info(`[ReflectionEngine] Generated 1 new reflection.`);

            // 2. Learn new concepts
            if (newConcepts && Array.isArray(newConcepts) && newConcepts.length > 0) {
                const validConcepts = newConcepts.filter(c => typeof c === 'string' && c.trim());
                await Promise.all(
                    validConcepts.map(concept => db.learnConcept(userId, concept, {}, `Identified during background reflection.`))
                );
                console.info(`[ReflectionEngine] Learned ${validConcepts.length} new concepts: ${validConcepts.join(', ')}.`);
            }
            
            window.dispatchEvent(new CustomEvent('nexus-cognitive-log-added'));

        } catch (error) {
            console.error('[ReflectionEngine] Error during reflection cycle:', error);
        } finally {
            this.isReflecting = false;
        }
    }
}

export const reflectionEngine = new ReflectionEngine();