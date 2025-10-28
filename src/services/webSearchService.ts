import { generateGeminiResponse } from './geminiService';
import { Source } from '@/types';

interface WebSearchResult {
    summary: string;
    sources: Source[];
}

class WebSearchService {
    public async search(query: string): Promise<WebSearchResult | null> {
        console.log(`[NEXUS-SEARCH] Performing autonomous search for: "${query}"`);
        try {
            // Rephrase the query as a direct instruction to the search-grounded model
            const prompt = `Faça uma pesquisa aprofundada na web e forneça um resumo conciso e informativo sobre "${query}". A resposta deve ser direta, factual e em português.`;
            
            const response = await generateGeminiResponse(prompt, [], {
                tools: [{ googleSearch: {} }],
                useThinking: true, // Use Pro for better summarization
            });

            // Check if the response and sources are valid
            if (response.text && response.text.trim().length > 10 && response.sources && response.sources.length > 0) {
                return {
                    summary: response.text,
                    sources: response.sources,
                };
            }
            console.warn(`[NEXUS-SEARCH] Search for "${query}" returned insufficient results or sources.`);
            return null;

        } catch (error) {
            console.error(`[NEXUS-SEARCH] Error during web search for "${query}":`, error);
            return null;
        }
    }
}

export const webSearchService = new WebSearchService();
