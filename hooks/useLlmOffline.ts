import { useCallback } from 'react';
import { ChatMessage } from '../types';
import { generateDeepSeekResponse, generateDeepSeekVisionResponse } from '../services/deepseekService';

type LlmResponse = {
    text: string;
    functionCalls?: { name: string, args: any }[];
};

export const useLlmOffline = (apiKey?: string) => {

  const generateResponse = useCallback(async (prompt: string, history: ChatMessage[]): Promise<LlmResponse> => {
    if (!apiKey) {
      return {
        text: 'Por favor, configure sua chave de API da DeepSeek na aba "Integrações" das configurações para que eu possa funcionar.'
      };
    }
    return generateDeepSeekResponse(apiKey, prompt, history);
  }, [apiKey]);

  const generateVisionResponse = useCallback(async (prompt: string, imageUrl: string): Promise<LlmResponse> => {
    if (!apiKey) {
      return {
        text: 'A chave de API da DeepSeek é necessária para analisar imagens. Por favor, configure-a nas configurações.'
      };
    }
    return generateDeepSeekVisionResponse(apiKey, prompt, imageUrl);
  }, [apiKey]);


  return { generateResponse, generateVisionResponse };
};