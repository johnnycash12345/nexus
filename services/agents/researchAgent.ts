
import { ChatMessage, OrchestratorOptions } from '../../types';
import { fetchNews } from '../newsService';
import { db } from '../indexedDBService';

export class ResearchAgent {
    constructor(private opts: OrchestratorOptions) {}

    async handleNewsRequest(query: string): Promise<Omit<ChatMessage, 'userId'|'timestamp'>> {
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

    async handleVisionRequest(userText: string, imageUrl: string): Promise<Omit<ChatMessage, 'userId'|'timestamp'>> {
        const { text, learningContext } = await this.opts.generateVisionResponse(userText, imageUrl);
        const finalText = text?.trim() || 'Não consegui interpretar a imagem.';
        return { role: 'model', text: finalText, type: 'message', learningContext };
    }
}
