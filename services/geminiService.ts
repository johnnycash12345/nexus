

import { GoogleGenAI } from "@google/genai";
import { ChatMessage } from '../types';

// Assumes process.env.API_KEY is available and configured in the environment
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export type LlmResponseType = {
    text: string;
    sources?: { uri: string, title: string }[];
};

export const generateGeminiResponse = async (prompt: string, history: ChatMessage[]): Promise<LlmResponseType> => {
    try {
        const model = "gemini-2.5-pro";
        
        // Gemini API expects 'model' and 'user' roles.
        const contents = history
            .map(h => ({
                role: h.role === 'model' ? 'model' : 'user',
                parts: [{ text: h.text }]
            }))
            .concat([{ role: 'user', parts: [{ text: prompt }] }]);
            

        const response = await ai.models.generateContent({
            model: model,
            contents: contents,
            config: {
                tools: [{ googleSearch: {} }],
            },
        });

        const text = response.text;
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        
        const sources = groundingChunks
            .map((chunk: any) => chunk.web)
            .filter(Boolean)
            .map((web: any) => ({ uri: web.uri, title: web.title }))
            .filter((source: any) => source.uri && source.title);

        // Deduplicate sources by URI
        // FIX: Explicitly type uniqueSources to prevent TypeScript from inferring it as unknown[].
        const uniqueSources: { uri: string; title: string }[] = Array.from(new Map(sources.map(item => [item.uri, item])).values());

        return { text, sources: uniqueSources };
    } catch (error: any) {
        console.error("Gemini API Error:", error);
        let errorMessage = "Desculpe, tive um problema ao me conectar com a internet. Por favor, tente novamente mais tarde.";
        if (error.message.includes('API key not valid')) {
            errorMessage = "A chave de API do Google Gemini não é válida. Verifique a configuração.";
        } else if (error.message.includes('fetch')) {
            errorMessage = "Não foi possível conectar aos servidores do Google. Verifique sua conexão com a internet.";
        }
        return { text: errorMessage };
    }
};

export const generateGeminiVisionResponse = async (prompt: string, base64ImageUrl: string): Promise<LlmResponseType> => {
    try {
        const model = 'gemini-2.5-flash';
        const mimeType = base64ImageUrl.substring(base64ImageUrl.indexOf(":") + 1, base64ImageUrl.indexOf(";"));
        const base64Data = base64ImageUrl.split(',')[1];
        
        const imagePart = {
            inlineData: {
                mimeType: mimeType,
                data: base64Data,
            },
        };
        const textPart = {
            text: prompt
        };
        
        const response = await ai.models.generateContent({
            model: model,
            contents: { parts: [textPart, imagePart] },
        });

        const text = response.text;
        return { text };
    } catch (error) {
        console.error("Gemini Vision API Error:", error);
        return { text: "Desculpe, tive um problema ao analisar a imagem. Tente novamente mais tarde." };
    }
};
