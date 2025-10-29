import { ChatMessage, OrchestratorOptions } from '@/types';
import { fetchNews } from '../newsService';
import { db } from '../indexedDBService';
import { webSearchService } from '../webSearchService';
import { integrateWebKnowledge } from '../cognitiveModules/knowledgeIntegrator';

// Helper to extract the core query from a user's prompt
function extractQuery(userInput: string, keywords: string[]): string {
    const lowerInput = userInput.toLowerCase();
    for (const keyword of keywords) {
        const index = lowerInput.indexOf(keyword);
        if (index !== -1) {
            return userInput.substring(index + keyword.length).trim();
        }
    }
    return userInput;
}


export class ResearchAgent {
    constructor(private opts: OrchestratorOptions) {}

    async handleNewsRequest(userInput: string): Promise<Omit<ChatMessage, 'userId'|'timestamp'>> {
        const query = extractQuery(userInput, ['notícias sobre', 'notícias de', 'manchetes sobre', 'manchetes de']);
        const settings = await db.getSettings(this.opts.userId);
        if (!settings.apiKeys?.newsApiKey) {
            return { role: 'model', text: "A chave da NewsAPI não está configurada.", type: 'status' };
        }
        this.opts.setStatus('SEARCHING_WEB');
        const articles = await fetchNews(settings.apiKeys.newsApiKey, query);
        if (articles && articles.length > 0) {
            const summaryText = `Encontrei as seguintes manchetes sobre "${query}":`;
            return { role: 'model', text: summaryText, type: 'news_summary', articles };
        }
        return { role: 'model', text: `Não encontrei notícias sobre "${query}".`, type: 'message' };
    }

    async handleWebSearchRequest(userInput: string): Promise<Omit<ChatMessage, 'userId' | 'timestamp'>> {
        const searchKeywords = ['pesquise por', 'procure por', 'busque por', 'o que é', 'quem é', 'quem foi', 'fale sobre', 'informações sobre'];
        const query = extractQuery(userInput, searchKeywords);
        
        const settings = await db.getSettings(this.opts.userId);
        if (!settings.behavior.permissions.allowApiAccess) {
             return { role: 'model', text: "Minhas permissões atuais não me permitem pesquisar na web.", type: 'status' };
        }

        this.opts.setStatus('SEARCHING_WEB');
        const searchResult = await webSearchService.search(this.opts.userId, query, `User requested a search for: "${query}"`);

        if (searchResult) {
            // Integrate this new knowledge into the brain asynchronously
            integrateWebKnowledge(this.opts.userId, query, searchResult.summary, searchResult.sources);
            
            return {
                role: 'model',
                text: searchResult.summary,
                type: 'message',
                sources: searchResult.sources,
            };
        }

        return {
            role: 'model',
            text: `Desculpe, não consegui encontrar informações confiáveis sobre "${query}" no momento.`,
            type: 'message',
        };
    }

    async handleVisionRequest(userText: string, imageUrl: string): Promise<Omit<ChatMessage, 'userId'|'timestamp'>> {
        const { text, learningContext } = await this.opts.generateVisionResponse(userText, imageUrl);
        const finalText = text?.trim() || 'Não consegui interpretar a imagem.';
        return { role: 'model', text: finalText, type: 'message', learningContext };
    }
}