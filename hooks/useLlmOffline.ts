import { useState, useCallback, useEffect } from 'react';
import { ChatMessage, Mood, UserProfile } from '../types';

type LlmResponse = {
    text: string;
    functionCalls?: { name: string, args: any }[];
};

const llmWorker = {
  postMessage: (message: any, callback: (response: LlmResponse) => void) => {
    const fullPrompt: string = message.prompt;

    const userPromptMatch = fullPrompt.match(/💬 Usuário disse: "(.*)"/s);
    const userPrompt = userPromptMatch ? userPromptMatch[1].toLowerCase() : "";
    const moodMatch = fullPrompt.match(/- Emoção atual: (\w+)/);
    const currentMood = moodMatch ? (moodMatch[1].toUpperCase() as Mood) : Mood.CURIOUS;

    let mockResponseText = '';
    let mockFunctionCalls: any[] = [];

    if (userPrompt.startsWith("por favor, resuma os seguintes resultados")) {
        const resultsMatch = userPrompt.match(/resultados da busca por "(.*?)": (.*)/s);
        if (resultsMatch) {
            const query = resultsMatch[1];
            const content = resultsMatch[2];
            mockResponseText = `Claro! Sobre "${query}", o que encontrei foi: ${content}`;
        } else {
            mockResponseText = "Aqui está um resumo do que encontrei.";
        }
    } else if (userPrompt.includes("f1") || userPrompt.includes("fórmula 1")) {
         mockResponseText = `A F1 está emocionante!`;
    } else if (userPrompt.includes("quem é você")) {
      mockResponseText = "Eu sou o Nexus, seu assistente pessoal. Estou aqui para te ajudar e aprender com você.";
    } else if (userPrompt.includes("aprenda sobre") || userPrompt.includes("o que é um")) {
      const conceptMatch = userPrompt.match(/(?:aprenda sobre|o que é um) (.*)/);
      const concept = conceptMatch ? conceptMatch[1].trim() : "algo novo";
      mockResponseText = `Interessante! Aprendendo sobre "${concept}".`;
      mockFunctionCalls.push({
        name: 'learn_concept',
        args: { concept: concept, metadata: { definition: `Definição de ${concept} aprendida com o usuário.` } }
      });
    } else {
      switch (currentMood) {
        case Mood.CURIOUS:
          mockResponseText = `Isso é interessante. Você pode me falar mais sobre "${userPrompt}"?`;
          break;
        case Mood.BORED:
          mockResponseText = `Certo, "${userPrompt}". Podemos fazer algo mais divertido?`;
          break;
        default:
          mockResponseText = `Entendido. Processando sua solicitação sobre "${userPrompt}".`;
      }
    }
    
    setTimeout(() => {
        callback({ text: mockResponseText, functionCalls: mockFunctionCalls });
    }, 1500);
  },
};

export const useLlmOffline = () => {

  const generateResponse = useCallback((prompt: string, history: ChatMessage[]): Promise<LlmResponse> => {
    return new Promise((resolve) => {
        llmWorker.postMessage({ type: 'generate', prompt }, (response) => {
            resolve(response);
        });
    });
  }, []);

  return { generateResponse };
};