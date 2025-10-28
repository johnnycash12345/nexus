import { CognitiveFrame, ChatMessage, OrchestratorOptions } from '@/types';
import { ResearchAgent } from './researchAgent';
import { EmotionalAgent } from './emotionalAgent';
import { CodeAgent } from './codeAgent';
import * as memoryRetriever from '../cognitiveModules/memoryRetriever';
import * as contextBuilder from '../cognitiveModules/contextBuilder';
import { db } from '../indexedDBService';

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

        // Retrieve memories needed for context building
        const { concepts, reflections } = await memoryRetriever.retrieveRelevantMemories(userInput, intent, userContext);
        frame.retrievedConcepts = concepts;
        frame.retrievedReflections = reflections;
        
        // Let specific agents handle their tasks
        if (intent === 'command_news') {
            return this.researchAgent.handleNewsRequest(userInput);
        }
        if (intent === 'vision_query' && frame.imageUrl) {
            return this.researchAgent.handleVisionRequest(userInput, frame.imageUrl);
        }
        
        // For general conversation, build context and use the core LLM
        const contextPrompt = await contextBuilder.buildDynamicPrompt(frame);
        const useThinking = /complex|question/.test(intent);
        
        frame.llmResponse = await this.opts.generateResponse(contextPrompt, frame.history, { useThinking });

        if (frame.llmResponse?.functionCalls?.length > 0) {
            // Function calls are handled by the code agent for now
            // We only need to add the result to chat, the orchestrator handles sending the result back
            const response = await this.codeAgent.executeFunctionCall(frame.llmResponse.functionCalls[0], userContext);
            this.opts.addMessage(response);
            // Returning null because the primary response will be handled by the voice service flow
            return null;
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
