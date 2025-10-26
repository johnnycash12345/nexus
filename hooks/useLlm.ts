
import { useCallback } from 'react';
import { ChatMessage, AppSettings } from '../types';
import { generateGeminiResponse, generateGeminiVisionResponse } from '../services/geminiService';
import { generateDeepSeekResponse, generateDeepSeekVisionResponse } from '../services/deepseekService';

export const useLlm = (settings: AppSettings | null) => {
  const generateResponse = useCallback(async (prompt: string, history: ChatMessage[], options?: any) => {
    if (!settings) {
        return generateGeminiResponse(prompt, history, options);
    }
      
    if (settings.llmProvider === 'deepseek' && settings.apiKeys?.deepseekApiKey) {
        return generateDeepSeekResponse(settings.apiKeys.deepseekApiKey, prompt, history);
    }
    return generateGeminiResponse(prompt, history, options);
  }, [settings]);

  const generateVisionResponse = useCallback(async (prompt: string, imageUrl: string) => {
    if (!settings) {
        return generateGeminiVisionResponse(prompt, imageUrl);
    }

    if (settings.llmProvider === 'deepseek' && settings.apiKeys?.deepseekApiKey) {
        return generateDeepSeekVisionResponse(settings.apiKeys.deepseekApiKey, prompt, imageUrl);
    }
    return generateGeminiVisionResponse(prompt, imageUrl);
  }, [settings]);


  return { generateResponse, generateVisionResponse };
};
