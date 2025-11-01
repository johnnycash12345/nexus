import { ChatMessage, OrchestratorOptions } from '../../types';
import { fetchNews } from '../newsService';
import { db } from '../indexedDBService';
import { webSearchService } from '../webSearchService';
import { integrateWebKnowledge } from '../cognitiveModules/knowledgeIntegrator';
import { cognitiveMonitor } from '../cognitiveMonitor'; // APRIMORAMENTO: Importado para log

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

    /**
     * @private
     * Cria uma resposta de erro padronizada e a registra no monitor cognitivo.
     */
    private _createErrorResponse(text: string): Omit<ChatMessage, 'userId'|'timestamp'> {
        cognitiveMonitor.logThought(`[ResearchAgent] Erro: ${text}`, 'error');
        this.opts.setStatus('ERROR'); // Define o status global como erro
        return { role: 'model', text: text, type: 'status' };
    }

    /**
     * Manipula uma solicitação de notícias.
     * Busca a chave da NewsAPI e chama o serviço fetchNews.
     */
    async handleNewsRequest(userInput: string): Promise<Omit<ChatMessage, 'userId'|'timestamp'>> {
        const query = extractQuery(userInput, ['notícias sobre', 'notícias de', 'manchetes sobre', 'manchetes de']);
        cognitiveMonitor.logThought(`[ResearchAgent] Iniciando busca de notícias para: "${query}"`);
        
        try {
            const settings = await db.getSettings(this.opts.userId);
            const apiKey = settings.apiKeys?.newsApiKey;

            if (!apiKey) {
                return this._createErrorResponse("A chave da NewsAPI não está configurada nas Configurações > Integrações.");
            }

            this.opts.setStatus('SEARCHING_WEB');
            const articles = await fetchNews(apiKey, query);

            if (articles && articles.length > 0) {
                const summaryText = `Encontrei as seguintes manchetes sobre "${query}":`;
                return { role: 'model', text: summaryText, type: 'news_summary', articles: articles.map(a => ({...a})) };
            }

            return { role: 'model', text: `Não encontrei notícias recentes sobre "${query}".`, type: 'message' };

        } catch (error) {
            console.error("[ResearchAgent] Erro ao buscar notícias:", error);
            return this._createErrorResponse(`Ocorreu um erro ao buscar notícias. A API pode estar offline ou a chave é inválida.`);
        }
    }

    /**
     * Manipula uma solicitação de pesquisa na web (ainda não implementado no original).
     * Esta é uma estrutura de como seria.
     */
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

    /**
     * Manipula uma solicitação de visão (análise de imagem).
     */
    async handleVisionRequest(userText: string, imageUrl: string): Promise<Omit<ChatMessage, 'userId'|'timestamp'>> {
        cognitiveMonitor.logThought(`[ResearchAgent] Iniciando análise de visão.`);
        // APRIMORAMENTO: Define o status, que estava faltando
        this.opts.setStatus('THINKING'); 
        
        try {
            const { text, learningContext } = await this.opts.generateVisionResponse(userText, imageUrl);
            const finalText = text?.trim() || 'Não consegui interpretar a imagem.';
            
            return { role: 'model', text: finalText, type: 'message', learningContext };

        } catch (error) {
            console.error("[ResearchAgent] Erro na análise de visão:", error);
            return this._createErrorResponse(`Ocorreu um erro ao analisar a imagem. O modelo de visão pode estar indisponível.`);
        }
    }
}