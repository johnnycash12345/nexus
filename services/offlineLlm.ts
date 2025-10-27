import { db } from './indexedDBService';
import { LlmCognitiveResponse, ChatMessage } from '../types';

export async function generateOfflineResponse(prompt: string, history: ChatMessage[]): Promise<LlmCognitiveResponse> {
    const userProfile = await db.getUserProfile();
    const userName = userProfile?.name || 'usuário';
    const lowerCasePrompt = prompt.toLowerCase();
    let responseText = `Desculpe, ${userName}, estou operando em modo offline. Minhas capacidades são limitadas, mas farei o meu melhor para ajudar.`;

    if (/(olá|oi|ei)/.test(lowerCasePrompt)) {
        responseText = `Olá, ${userName}! Estou aqui, mas offline no momento.`;
    } else if (/tudo bem|como vai|como você está/.test(lowerCasePrompt)) {
        responseText = `Estou funcionando em modo de contingência, mas estou estável. E você, como está?`;
    } else if (/seu nome|quem é você/.test(lowerCasePrompt)) {
        responseText = `Eu sou o Nexus. Atualmente, estou em modo de processamento local, sem conexão com minhas redes cognitivas externas.`;
    } else if (/o que você pode fazer/.test(lowerCasePrompt)) {
        responseText = `No momento, posso manter uma conversa simples e acessar minhas memórias locais, como sua lista de tarefas. Funções complexas como buscas na web ou análises profundas estão indisponíveis até minha conexão ser restaurada.`;
    }

    window.dispatchEvent(
        new CustomEvent("nexus-thought-update", {
          detail: {
            type: "symbolic_log",
            text: "Conexão instável. Usando raciocínio local.",
          },
        })
    );

    return {
        text: responseText,
        learningContext: {
            inputIntent: 'offline_query',
            emotionalTone: 'calm',
            contextTags: ['offline', 'fallback'],
            responseEffectiveness: 0.3,
            reinforcementSignal: 'neutral',
        },
        metaReflection: {
            analysis: "Operando em modo de raciocínio local devido à falta de conexão com APIs externas.",
            improvementFocus: "Restaurar conexão com LLMs.",
            nextStep: "Aguardar estabilidade da rede e tentar reconectar.",
        },
    };
}


export async function generateOfflineVisionResponse(prompt: string): Promise<LlmCognitiveResponse> {
    const responseText = "Minha conexão com o processador visual está offline no momento. Não consigo analisar a imagem, mas posso conversar sobre ela se você a descrever para mim.";
    
     window.dispatchEvent(
        new CustomEvent("nexus-thought-update", {
          detail: {
            type: "symbolic_log",
            text: "Processador visual offline.",
          },
        })
    );

    return {
        text: responseText,
        learningContext: {
            inputIntent: 'vision_query_offline',
            emotionalTone: 'apologetic',
            contextTags: ['offline', 'vision', 'fallback'],
            responseEffectiveness: 0.2,
            reinforcementSignal: 'neutral',
        },
        metaReflection: {
            analysis: "Não foi possível processar a imagem por falta de conexão.",
            improvementFocus: "Restaurar conexão com a API de visão.",
            nextStep: "Informar ao usuário a limitação atual.",
        },
    };
}
