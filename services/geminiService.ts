
import { GoogleGenAI } from "@google/genai";
import { ChatMessage } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export type LlmResponseType = {
    text: string;
    sources?: { uri: string, title: string }[];
};

export const generateGeminiResponse = async (
    prompt: string, 
    history: ChatMessage[],
    options?: { useThinking?: boolean; latLng?: { latitude: number, longitude: number } }
): Promise<LlmResponseType> => {
    try {
        const model = options?.useThinking ? "gemini-2.5-pro" : "gemini-2.5-flash";
        
        const contents = history
            .map(h => ({
                role: h.role === 'model' ? 'model' : 'user',
                parts: [{ text: h.text }]
            }))
            .concat([{ role: 'user', parts: [{ text: prompt }] }]);
            
        const config: any = {
            tools: [{ googleSearch: {} }, { googleMaps: {} }],
        };

        if (options?.useThinking) {
            config.thinkingConfig = { thinkingBudget: 32768 };
        }
        
        const toolConfig: any = {};
        if (options?.latLng) {
            toolConfig.retrievalConfig = { latLng: options.latLng };
        }

        const response = await ai.models.generateContent({
            model: model,
            contents: contents,
            config: config,
            ...(Object.keys(toolConfig).length > 0 && { toolConfig: toolConfig })
        });

        const text = response.text;
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        
        const sources = groundingChunks.reduce((acc: { uri: string; title: string }[], chunk: any) => {
            if (chunk?.web?.uri && chunk?.web?.title) {
                acc.push({ uri: chunk.web.uri, title: chunk.web.title });
            }
            if (chunk?.maps?.uri && chunk?.maps?.title) {
                acc.push({ uri: chunk.maps.uri, title: chunk.maps.title });
            }
            if(chunk?.maps?.placeAnswerSources?.reviewSnippets) {
                for (const snippet of chunk.maps.placeAnswerSources.reviewSnippets) {
                    if (snippet.uri && snippet.reviewText) {
                         acc.push({ uri: snippet.uri, title: `Review: "${snippet.reviewText.substring(0, 50)}..."` });
                    }
                }
            }
            return acc;
        }, [] as { uri: string; title: string }[]);

        const uniqueSources: { uri: string; title: string }[] = [];
        const seenUris = new Set<string>();
        for (const source of sources) {
            if (source.uri && !seenUris.has(source.uri)) {
                seenUris.add(source.uri);
                uniqueSources.push(source);
            }
        }

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
