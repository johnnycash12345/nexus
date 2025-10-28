

import { useCallback } from 'react';
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
                // O deepseekService agora retorna a LlmCognitiveResponse completa
                return await generateDeepSeekResponse(settings.apiKeys.deepseekApiKey, prompt, history);
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
                 // O deepseekService agora retorna a LlmCognitiveResponse completa
                return await generateDeepSeekVisionResponse(settings.apiKeys.deepseekApiKey, prompt, imageUrl);
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
