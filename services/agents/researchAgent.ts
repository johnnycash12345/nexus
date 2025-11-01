import { ChatMessage, OrchestratorOptions, AppSettings } from '../../types';
import { fetchNews } from '../newsService';
import { db } from '../indexedDBService';
import { cognitiveMonitor } from '../cognitiveMonitor'; // APRIMORAMENTO: Importado para log

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
    async handleNewsRequest(query: string): Promise<Omit<ChatMessage, 'userId'|'timestamp'>> {
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
                return { role: 'model', text: summaryText, type: 'news_summary', articles };
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
    async handleWebSearchRequest(query: string): Promise<Omit<ChatMessage, 'userId'|'timestamp'>> {
        cognitiveMonitor.logThought(`[ResearchAgent] Iniciando pesquisa na web para: "${query}"`);
        this.opts.setStatus('SEARCHING_WEB');

        try {
            // Este prompt força o LLM (se for Gemini 1.5 Pro) a usar a ferramenta de busca interna
            const contextPrompt = `Pesquise na web o seguinte termo: "${query}". Responda com base nos resultados da pesquisa e forneça as fontes.`;
            
            // Usamos generateResponse, que agora tratará isso como uma busca
            const llmResponse = await this.opts.generateResponse(contextPrompt, [], { useThinking: true });
            
            const { text, sources, learningContext } = llmResponse;
            const finalText = text?.trim() || `Não consegui encontrar resultados para "${query}".`;

            return {
                role: 'model',
                text: finalText,
                type: 'message',
                sources,
                learningContext
            };
        } catch (error) {
            console.error("[ResearchAgent] Erro ao pesquisar na web:", error);
            return this._createErrorResponse(`Ocorreu um erro ao tentar pesquisar na web.`);
        }
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