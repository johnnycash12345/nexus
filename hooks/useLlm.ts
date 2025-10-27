

import { useCallback } from 'react';
// FIX: LlmCognitiveResponse is now imported from types.ts.
import { ChatMessage, AppSettings, LlmCognitiveResponse } from '../types';
import { generateGeminiResponse, generateGeminiVisionResponse } from '../services/geminiService';
import { generateDeepSeekResponse, generateDeepSeekVisionResponse } from '../services/deepseekService';
import { generateOfflineResponse, generateOfflineVisionResponse } from '../services/offlineLlm';

export const useLlm = (settings: AppSettings | null) => {

  const generateResponse = useCallback(async (prompt: string, history: ChatMessage[], options?: any): Promise<LlmCognitiveResponse> => {
    // --- 1. Tentar Gemini (provedor primário) ---
    try {
        console.log('[NEXUS-LLM] Tentando provedor primário: Gemini');
        return await generateGeminiResponse(prompt, history, options);
    } catch (geminiError) {
        console.warn('[NEXUS-FALLBACK] Gemini falhou. Tentando provedor secundário: DeepSeek.', geminiError);

        // --- 2. Tentar DeepSeek como fallback se a chave existir ---
        if (settings?.apiKeys?.deepseekApiKey) {
            try {
                console.log('[NEXUS-LLM] Tentando provedor secundário: DeepSeek');
                const deepseekResponse = await generateDeepSeekResponse(settings.apiKeys.deepseekApiKey, prompt, history);
                // Adaptar a resposta simples do DeepSeek para a estrutura cognitiva
                return {
                    text: deepseekResponse.text,
                    learningContext: { inputIntent: 'deepseek_fallback', emotionalTone: 'neutral', contextTags: ['fallback', 'deepseek'], responseEffectiveness: 0.6, reinforcementSignal: 'neutral' },
                    metaReflection: { analysis: 'Resposta gerada via modelo DeepSeek (fallback).', improvementFocus: 'n/a', nextStep: 'n/a' }
                };
            } catch (deepseekError) {
                console.error('[NEXUS-FALLBACK] DeepSeek também falhou. Ativando modo de resposta offline.', deepseekError);
                // --- 3. Ambos falharam, ativar modo offline ---
                return await generateOfflineResponse(prompt, history);
            }
        } else {
            console.warn('[NEXUS-FALLBACK] Chave da API DeepSeek não encontrada. Ativando modo de resposta offline diretamente.');
            // --- 3. Sem chave DeepSeek, ativar modo offline ---
            return await generateOfflineResponse(prompt, history);
        }
    }
  }, [settings]);

  const generateVisionResponse = useCallback(async (prompt: string, imageUrl: string): Promise<LlmCognitiveResponse> => {
    // --- 1. Tentar Gemini Vision (primário) ---
    try {
        console.log('[NEXUS-LLM] Tentando provedor de visão primário: Gemini');
        return await generateGeminiVisionResponse(prompt, imageUrl);
    } catch (geminiError) {
        console.warn('[NEXUS-FALLBACK] Gemini Vision falhou. Tentando provedor secundário: DeepSeek.', geminiError);
        
        // --- 2. Tentar DeepSeek Vision como fallback ---
        if (settings?.apiKeys?.deepseekApiKey) {
            try {
                console.log('[NEXUS-LLM] Tentando provedor de visão secundário: DeepSeek');
                const deepseekResponse = await generateDeepSeekVisionResponse(settings.apiKeys.deepseekApiKey, prompt, imageUrl);
                 // Adaptar a resposta simples do DeepSeek para a estrutura cognitiva
                return {
                    text: deepseekResponse.text,
                    learningContext: { inputIntent: 'vision_deepseek_fallback', emotionalTone: 'curious', contextTags: ['image', 'fallback', 'deepseek'], responseEffectiveness: 0.6, reinforcementSignal: 'neutral' },
                    metaReflection: { analysis: 'Resposta de visão gerada via modelo DeepSeek (fallback).', improvementFocus: 'n/a', nextStep: 'n/a' }
                };
            } catch (deepseekError) {
                 console.error('[NEXUS-FALLBACK] DeepSeek Vision também falhou. Ativando modo de resposta offline.', deepseekError);
                // --- 3. Ambos falharam, ativar modo offline ---
                return await generateOfflineVisionResponse(prompt);
            }
        } else {
             console.warn('[NEXUS-FALLBACK] Chave da API DeepSeek não encontrada. Ativando modo de resposta de visão offline.');
            // --- 3. Sem chave DeepSeek, ativar modo offline ---
            return await generateOfflineVisionResponse(prompt);
        }
    }
  }, [settings]);


  return { generateResponse, generateVisionResponse };
};
