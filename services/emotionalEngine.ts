import { Type } from '@google/genai';
import { db } from './indexedDBService';
import { Emotion, EmotionState, LearningContext } from '../types';
import { generateGeminiResponse } from "./geminiService";

const EmotionValues: Emotion[] = ['CURIOUS', 'JOYFUL', 'UNCERTAIN', 'CALM', 'FOCUSED', 'AFRAID'];

const emotionEvolutionSchema = {
    type: Type.OBJECT,
    properties: {
        newEmotion: { 
            type: Type.STRING,
            enum: EmotionValues,
        },
        intensityChange: { 
            type: Type.NUMBER,
        },
        reasoning: {
            type: Type.STRING,
        }
    },
    required: ["newEmotion", "intensityChange", "reasoning"],
};

export const analyzeAndEvolveEmotion = async (userId: string, learningContext: LearningContext, systemResponse: string): Promise<void> => {
    const system = await db.getSystemMemory(userId);
    if (!system?.emotionState) return;

    const prompt = `
        Analise a seguinte interação para determinar a mudança emocional apropriada para uma IA.
        Estado Emocional Atual: ${system.emotionState.current} (Intensidade: ${system.emotionState.intensity.toFixed(2)})
        Interação: Intenção do usuário foi '${learningContext.inputIntent}' com tom '${learningContext.emotionalTone}'. A IA respondeu com "${systemResponse.substring(0, 150)}...".
        Com base nisso, qual a nova emoção e mudança de intensidade?
        Sua resposta DEVE ser um único objeto JSON.
    `;

    try {
        const response = await generateGeminiResponse(prompt, [], { customSchema: emotionEvolutionSchema });
        const result = JSON.parse(response.text);
        const { newEmotion, intensityChange } = result;

        const newIntensity = Math.max(0.1, Math.min(1.0, system.emotionState.intensity + (intensityChange || 0)));
        const newEmotionState: EmotionState = {
            current: newEmotion || system.emotionState.current,
            intensity: newIntensity,
            history: [...(system.emotionState.history || [])].slice(-5).concat(newEmotion),
        };

        await db.saveSystemMemory(userId, { emotionState: newEmotionState });
        
        window.dispatchEvent(new CustomEvent('nexus-emotion-update', {
            detail: { emotion: newEmotionState.current, intensity: newEmotionState.intensity },
        }));

    } catch (error) {
        console.error("[NEXUS-EMOTION] Falha ao evoluir emoção:", error);
    }
};
