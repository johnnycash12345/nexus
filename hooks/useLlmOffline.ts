
import { useCallback } from 'react';
import { ChatMessage } from '../types';
import { generateGeminiResponse, generateGeminiVisionResponse } from '../services/geminiService';

export const useLlm = () => {
  const generateResponse = useCallback(async (prompt: string, history: ChatMessage[]) => {
    return generateGeminiResponse(prompt, history);
  }, []);

  const generateVisionResponse = useCallback(async (prompt: string, imageUrl: string) => {
    return generateGeminiVisionResponse(prompt, imageUrl);
  }, []);


  return { generateResponse, generateVisionResponse };
};
