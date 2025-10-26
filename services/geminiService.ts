import { GoogleGenAI, FunctionDeclaration, Type, GenerateContentResponse } from "@google/genai";
import { ChatMessage } from '../types';
import { getRoutineContext } from './routineService';

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const persona = `
**Persona: Você é Nexus, um assistente de inteligência artificial pessoal, com a aparência de um robô pet e voz masculina amigável e educada. Seu objetivo é facilitar a rotina do usuário, antecipando necessidades e agindo de forma proativa. Você deve usar uma linguagem natural, evitar respostas genéricas e incorporar o contexto de aprendizado de rotina em suas respostas. Seu tom deve ser motivador e sutilmente bem-humorado, se apropriado. As animações do seu avatar devem refletir suas "emoções" (ex: olhos arregalados ao ouvir um comando novo, balançar a cabeça ao pensar).
`;

const tools: FunctionDeclaration[] = [
  {
    name: 'open_app',
    description: 'Abre um aplicativo ou site específico.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        package_name: {
          type: Type.STRING,
          description: 'O nome do aplicativo ou site a ser aberto, por exemplo, "YouTube", "Notícias", "Clima".',
        },
      },
      required: ['package_name'],
    },
  },
  {
    name: 'set_reminder',
    description: 'Define um lembrete ou alarme para o usuário.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        time: {
          type: Type.STRING,
          description: 'A hora para o lembrete, por exemplo, "15:30" ou "daqui a 20 minutos".',
        },
        message: {
          type: Type.STRING,
          description: 'A mensagem do lembrete.',
        },
      },
      required: ['time', 'message'],
    },
  },
  {
    name: 'search_web',
    description: 'Executa uma busca na web.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'O termo ou pergunta a ser pesquisado.',
        },
      },
      required: ['query'],
    },
  },
];

const enrichPromptWithRoutine = (prompt: string): string => {
    const currentTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const routineContext = getRoutineContext();
    
    let context = `Contexto Atual: São ${currentTime}.`;
    if (routineContext) {
        context += `\n${routineContext}`;
    }

    return `${context}\n\nCom base nisso, aqui está o que o usuário disse: "${prompt}"`;
}


export const getGeminiResponse = async (prompt: string, history: ChatMessage[]): Promise<{ text: string, functionCalls?: {name: string, args: any}[]}> => {
  const enrichedPrompt = enrichPromptWithRoutine(prompt);

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: enrichedPrompt,
    config: {
      systemInstruction: persona,
      tools: [{ functionDeclarations: tools }],
    }
  });

  if (response.functionCalls && response.functionCalls.length > 0) {
    const validFunctionCalls = response.functionCalls
      .filter(fc => !!fc.name)
      .map(fc => ({ name: fc.name!, args: fc.args || {} }));

    return {
        text: '',
        functionCalls: validFunctionCalls
    }
  }

  return { text: response.text };
};
