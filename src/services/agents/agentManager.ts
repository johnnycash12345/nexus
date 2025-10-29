import { CognitiveFrame, ChatMessage, OrchestratorOptions } from '@/types';
import { ResearchAgent } from './researchAgent';
import { EmotionalAgent } from './emotionalAgent';
import { CodeAgent } from './codeAgent';
import * as memoryRetriever from '../cognitiveModules/memoryRetriever';
import * as contextBuilder from '../cognitiveModules/contextBuilder';
import { db } from '../indexedDBService';
import { cognitiveMonitor } from '../cognitiveMonitor';

export class AgentManager {
    private researchAgent: ResearchAgent;
    public emotionalAgent: EmotionalAgent;
    public codeAgent: CodeAgent;

    constructor(private opts: OrchestratorOptions) {
        this.researchAgent = new ResearchAgent(opts);
        this.emotionalAgent = new EmotionalAgent(opts.userId);
        this.codeAgent = new CodeAgent();
    }

    async delegateTask(frame: CognitiveFrame): Promise<Omit<ChatMessage, 'userId' | 'timestamp'> | null> {
        const { intent, userInput, userContext } = frame;

        // Retrieve memories needed for context building, now including reasoning depth
        const { concepts, reflections, reasoningDepth } = await memoryRetriever.retrieveRelevantMemories(userInput, intent, userContext);
        frame.retrievedConcepts = concepts;
        frame.retrievedReflections = reflections;
        
        // Log the reasoning depth
        if (reasoningDepth > 0) {
            cognitiveMonitor.logThought(`Utilizei ${reasoningDepth} saltos de sinapse para contextualizar a resposta.`);
        }

        // Let specific agents handle their tasks
        if (intent === 'command_news') {
            return this.researchAgent.handleNewsRequest(userInput);
        }
        if (intent === 'web_search') {
            return this.researchAgent.handleWebSearchRequest(userInput);
        }
        if (intent === 'vision_query' && frame.imageUrl) {
            return this.researchAgent.handleVisionRequest(userInput, frame.imageUrl);
        }
        
        // For general conversation, build context and use the core LLM
        const contextPrompt = await contextBuilder.buildDynamicPrompt(frame);
        // Use Pro model only for complex tasks, Flash for everything else interactive.
        const useThinking = intent === 'complex_reasoning' || intent === 'self_reflection_query';
        
        frame.llmResponse = await this.opts.generateResponse(contextPrompt, frame.history, { useThinking });
        
        // Check for function calls after the main response generation
        if (frame.llmResponse?.functionCalls?.length > 0) {
            // Function calls are handled by the code agent
            return this.codeAgent.executeFunctionCall(frame.llmResponse.functionCalls[0], frame.userContext);
        }
        
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