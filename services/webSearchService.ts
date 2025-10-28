import { generateGeminiResponse } from './geminiService';
import { Source } from '../types';

interface WebSearchResult {
    summary: string;
    sources: Source[];
}

class WebSearchService {
    public async search(query: string): Promise<WebSearchResult | null> {
        console.log(`[NEXUS-SEARCH] Performing autonomous search for: "${query}"`);
        try {
            const prompt = `Faça uma pesquisa aprofundada na web e forneça um resumo conciso e informativo sobre "${query}". A resposta deve ser direta e factual.`;
            const response = await generateGeminiResponse(prompt, [], {
                tools: [{ googleSearch: {} }],
                useThinking: true,
            });

            if (response.text && response.text.trim().length > 10) {
                return {
                    summary: response.text,
                    sources: response.sources || [],
                };
            }
            return null;
        } catch (error) {
            console.error(`[NEXUS-SEARCH] Error during web search for "${query}":`, error);
            return null;
        }
    }
}

export const webSearchService = new WebSearchService();
