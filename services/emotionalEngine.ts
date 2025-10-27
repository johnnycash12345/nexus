import { Type } from '@google/genai';
import { db } from './indexedDBService';
import { Emotion, EmotionState, LearningContext } from '../types';
import { generateGeminiResponse } from "./geminiService";

const emotionEvolutionSchema = {
    type: Type.OBJECT,
    properties: {
        newEmotion: { 
            type: Type.STRING,
            enum: Object.values(Emotion),
            description: "A emoção nova mais apropriada para a IA com base no contexto."
        },
        intensityChange: { 
            type: Type.NUMBER,
            description: "Um valor de -0.3 a +0.3 representando a mudança na intensidade emocional."
        },
        reasoning: {
            type: Type.STRING,
            description: "Breve raciocínio para a mudança emocional."
        }
    },
    required: ["newEmotion", "intensityChange", "reasoning"],
};

export const analyzeAndEvolveEmotion = async (learningContext: LearningContext, systemResponse: string): Promise<void> => {
    const system = await db.getSystemMemory();
    if (!system?.emotionState) return;

    const prompt = `
        Analise a seguinte interação para determinar a mudança emocional apropriada para uma IA assistente chamada Nexus.

        Estado Emocional Atual:
        - Emoção: ${system.emotionState.current}
        - Intensidade: ${system.emotionState.intensity.toFixed(2)}

        Análise da Interação do Usuário (learningContext):
        - Intenção do Usuário: ${learningContext.inputIntent}
        - Tom Emocional do Usuário: ${learningContext.emotionalTone}
        - Tags de Contexto: ${learningContext.contextTags.join(', ')}

        Resposta do Nexus:
        "${systemResponse.substring(0, 200)}..."

        Com base nisso, determine a nova emoção para o Nexus e a mudança na intensidade.
        - Se a interação foi positiva ou bem-sucedida, o Nexus pode se sentir ALEGRE ou FOCADO.
        - Se o usuário estava curioso, o Nexus pode se tornar CURIOSO.
        - Se a interação foi confusa ou negativa, o Nexus pode se tornar INCERTO.
        - Uma troca neutra ou informativa deve levar de volta à CALMA.
        
        Sua resposta DEVE ser um único objeto JSON correspondente ao esquema fornecido.
    `;

    try {
        const response = await generateGeminiResponse(prompt, [], { customSchema: emotionEvolutionSchema });
        const result = JSON.parse(response.text);

        const { newEmotion, intensityChange, reasoning } = result;

        console.log(`[NEXUS-EMOTION] Análise de evolução: ${reasoning}. Nova emoção: ${newEmotion}, Mudança de intensidade: ${intensityChange}`);

        const currentIntensity = system.emotionState.intensity;
        const clampedChange = Math.max(-0.3, Math.min(0.3, intensityChange || 0));
        const newIntensity = Math.max(0.1, Math.min(1.0, currentIntensity + clampedChange));

        const newEmotionState: EmotionState = {
            current: (newEmotion as Emotion) || system.emotionState.current,
            intensity: newIntensity,
            history: [...(system.emotionState.history || [])].slice(-5).concat(newEmotion as Emotion),
        };

        await db.saveSystemMemory({ emotionState: newEmotionState });
        
        window.dispatchEvent(new CustomEvent('nexus-emotion-update', {
            detail: { emotion: newEmotionState.current, intensity: newEmotionState.intensity },
        }));

    } catch (error) {
        console.error("[NEXUS-EMOTION] Falha ao evoluir emoção com LLM:", error);
        // Fallback para uma lógica mais simples se o LLM falhar
        const currentIntensity = system.emotionState.intensity;
        await db.saveSystemMemory({ 
            emotionState: {
                ...system.emotionState,
                intensity: Math.max(0.1, Math.min(1.0, currentIntensity - 0.05)) // Reduzir lentamente
            }
        });
    }
};
