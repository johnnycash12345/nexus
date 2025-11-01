import { CognitiveFrame, ChatMessage, OrchestratorOptions } from '../../types';
import { ResearchAgent } from './researchAgent';
import { EmotionalAgent } from './emotionalAgent';
import { CodeAgent } from './codeAgent';
import * as memoryRetriever from '../cognitiveModules/memoryRetriever';
import * as contextBuilder from '../cognitiveModules/contextBuilder';
import { db } from '../indexedDBService';
import { cognitiveMonitor } from '../cognitiveMonitor';

export class AgentManager {
    private researchAgent: ResearchAgent;
    public emotionalAgent: EmotionalAgent; // Público para ser usado pelo CognitiveUpdater
    public codeAgent: CodeAgent; // Public for orchestrator

    // APRIMORAMENTO: Um Set para roteamento limpo de "ferramentas"
    private toolIntents = new Set<string>([
        'command_news',
        'web_search',
        'vision_query'
    ]);

    constructor(private opts: OrchestratorOptions) {
        this.researchAgent = new ResearchAgent(opts);
        this.emotionalAgent = new EmotionalAgent(opts.userId);
        this.codeAgent = new CodeAgent();
    }

    /**
     * Roteia a tarefa para o agente apropriado com base na intenção.
     * Este é o "cérebro" de roteamento principal.
     */
    async delegateTask(frame: CognitiveFrame): Promise<Omit<ChatMessage, 'userId' | 'timestamp'> | null> {
        const { intent, userInput, userContext } = frame;

        // 1. PRÉ-PROCESSAMENTO: Recuperar memória relevante para TODOS os agentes
        const { concepts, reflections, reasoningDepth } = await memoryRetriever.retrieveRelevantMemories(userInput, intent, userContext);
        frame.retrievedConcepts = concepts;
        frame.retrievedReflections = reflections;
        
        if (reasoningDepth > 0) {
            cognitiveMonitor.logThought(`Contexto enriquecido com ${reasoningDepth} saltos de sinapse.`);
        }

        // 2. ROTEAMENTO:
        // Se a intenção for uma ferramenta específica (Notícia, Pesquisa, Visão), delegue ao Agente de Ferramentas.
        if (this.toolIntents.has(intent)) {
            return this._delegateToToolAgent(frame);
        }

        // 3. FALLBACK: Para todas as outras intenções (conversa, raciocínio, etc.),
        // use o Agente de Conversação Principal.
        return this._handleGeneralConversation(frame);
    }

    /**
     * @private
     * Lida com intenções que exigem agentes de ferramentas específicas (ex: ResearchAgent).
     */
    private _delegateToToolAgent(frame: CognitiveFrame): Promise<Omit<ChatMessage, 'userId' | 'timestamp'> | null> {
        const { intent, userInput, imageUrl } = frame;
        
        // Atualmente, apenas o ResearchAgent lida com ferramentas
        switch (intent) {
            case 'command_news':
                return this.researchAgent.handleNewsRequest(userInput);
            case 'web_search':
                return this.researchAgent.handleWebSearchRequest(userInput);
            case 'vision_query':
                if (imageUrl) {
                    return this.researchAgent.handleVisionRequest(userInput, imageUrl);
                }
                // Tratamento de erro se a visão for chamada sem imagem
                cognitiveMonitor.logThought("Erro: Intenção 'vision_query' recebida sem uma imagem.", 'error');
                return Promise.resolve({ 
                    role: 'model', 
                    text: 'Você mencionou uma imagem, mas não consigo vê-la. Por favor, anexe a imagem.', 
                    type: 'status' 
                });
            default:
                cognitiveMonitor.logThought(`Erro de Roteamento: A intenção de ferramenta '${intent}' não possui um manipulador.`, 'error');
                return Promise.resolve(null);
        }
    }

    /**
     * @private
     * O fluxo padrão para conversação, raciocínio e geração de código.
     * Atua como o "Agente de Conversação Principal".
     */
    private async _handleGeneralConversation(frame: CognitiveFrame): Promise<Omit<ChatMessage, 'userId' | 'timestamp'> | null> {
        const { intent } = frame;

        // 1. Construir o prompt dinâmico com todo o contexto
        const contextPrompt = await contextBuilder.buildDynamicPrompt(frame);
        
        // 2. Determinar o modelo (Pro para tarefas pesadas, Flash para interações rápidas)
        const useThinking = intent === 'complex_reasoning' || intent === 'self_reflection_query';
        
        // 3. Gerar a resposta principal do LLM
        frame.llmResponse = await this.opts.generateResponse(contextPrompt, frame.history, { useThinking });
        
        // 4. Pós-processamento: Verificar se o LLM solicitou uma Function Call
        if (frame.llmResponse?.functionCalls?.length > 0) {
            // Se sim, o CodeAgent assume para executar a chamada
            // (Atualmente pega apenas a primeira chamada)
            const call = frame.llmResponse.functionCalls[0];
            return this.codeAgent.executeFunctionCall(call, frame.userContext);
        }
        
        // 5. Se for uma resposta de texto normal, formatar e retornar
        const { text, sources, learningContext } = frame.llmResponse;
        const finalText = text?.trim() || 'Estou processando...';

        return {
            role: 'model',
            text: finalText,
            type: 'message',
            sources,
            learningContext
        };
    }
}