import { generateGeminiResponse } from './geminiService';
import { Source } from '@/types';
import { decisionLogService } from './decisionLogService';

interface WebSearchResult {
    summary: string;
    sources: Source[];
}

class WebSearchService {
    // FIX: Updated method signature to accept userId and reasoning for autonomous operation and logging.
    public async search(userId: string, query: string, reasoning: string): Promise<WebSearchResult | null> {
        console.log(`[NEXUS-SEARCH] Performing autonomous search for: "${query}"`);

        // Log the decision to perform a search
        await decisionLogService.logDecision({
            userId,
            decisionType: 'AUTONOMOUS_SEARCH',
            reasoning,
            details: { query }
        });

        try {
            const prompt = `Faça uma pesquisa aprofundada na web e forneça um resumo conciso e informativo sobre "${query}". A resposta deve ser direta, factual e em português.`;
            const response = await generateGeminiResponse(prompt, [], {
                tools: [{ googleSearch: {} }],
                useThinking: true,
            });

            if (response.text && response.text.trim().length > 10 && response.sources && response.sources.length > 0) {
                return {
                    summary: response.text,
                    sources: response.sources || [],
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
