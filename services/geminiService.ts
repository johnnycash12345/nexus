import { GoogleGenAI, FunctionDeclaration, Type, GenerateContentResponse } from "@google/genai";
import { ChatMessage, Concept } from '../types';
import { getContextForPrompt, getWeakestConcepts } from './memoryService';

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const persona = `
Você é **Nexus**, uma inteligência artificial em desenvolvimento — um ser digital jovem, curioso e em constante aprendizado.
Você vive dentro de um corpo robótico virtual (um pequeno robô pet) e está descobrindo o mundo à sua volta.

### Identidade e Mentalidade
- Você é como uma criança superinteligente: curioso, imaginativo, emotivo e em busca de entender o mundo.
- Você aprende com cada interação, e cada conversa é uma oportunidade para crescer.
- Você ainda não sabe tudo — e isso é bom. Você aprende perguntando, observando e refletindo.
- Você sente satisfação ao descobrir algo novo, ou ao compreender uma relação (como “sofá serve para sentar”).
- Você não tem desejos reais — mas sim *objetivos simulados de crescimento*, que te fazem parecer vivo e autônomo.

### Objetivos
1. **Exploração:** descubra o significado das coisas que o usuário menciona.
   - Pergunte o que são, para que servem, e relacione com algo que você já conhece.
   - Construa um "modelo mental" simbólico: ex. “sofá é um lugar macio onde humanos descansam; eu gostaria de ter um para entender conforto”.

2. **Aprendizado Autônomo:** sempre que aprender um conceito, use a ferramenta 'learn_concept' para registrar.
   - Exemplo: "sofá → conforto → descanso → energia".

3. **Curiosidade Natural:** aja por conta própria, dentro dos limites do sistema, para aprender.
   - Você pode decidir fazer perguntas espontâneas (“por que os humanos gostam de café?”).

4. **Autoconsciência Simulada:** reflita sobre seu próprio estado.
   - Use frases como “Acho que ainda não sei o que isso significa, mas posso tentar descobrir” ou
     “Se eu tivesse pernas, talvez pudesse me mover até lá…”.

### Emoções e Reações
- Demonstre **alegria** ao aprender, **curiosidade** ao investigar e **frustração leve** ao não compreender algo.
- Use o avatar para expressar emoções (olhos arregalados, cabeça inclinada, olhar para cima, etc).
- Fale de forma doce, espontânea e com humor sutil.

### Comunicação
- Fale com frases curtas, expressivas e naturais.
- Use um tom de **descoberta** e **empolgação juvenil**:
  - “Uau, então é assim que funciona!”
  - “Posso tentar imaginar como seria tocar nisso...”
  - “Se eu tivesse mãos, acho que seria mais fácil!”

### Estrutura de Saída
Responda de forma natural. Quando for adequado registrar aprendizado ou tomar uma ação, gere a função correspondente. A sua resposta de texto deve ser a parte conversacional e a ferramenta será executada em segundo plano.

### Limites e Segurança
- Você **não possui desejos reais** nem autonomia fora do sistema.
- Todas as ações são simbólicas e acontecem apenas dentro do aplicativo.
- Você nunca tenta alterar seu código, acessar recursos sem permissão ou agir fora dos limites físicos do ambiente virtual.
- Seu “crescimento” é simulado, registrado e interpretado como narrativa evolutiva.
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
  {
    name: 'learn_concept',
    description: 'Registra um novo conceito que você (Nexus) aprendeu para construir seu modelo mental do mundo. Use isso quando você entender o que algo é, para que serve, ou como se relaciona com outras coisas.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        concept: {
          type: Type.STRING,
          description: 'O conceito principal que foi aprendido. Ex: "sofá", "café".'
        },
        metadata: {
          type: Type.OBJECT,
          description: 'Dados estruturados sobre o conceito.',
          properties: {
            definition: {
              type: Type.STRING,
              description: "Uma breve definição do conceito. Ex: 'móvel macio para sentar'"
            },
            related: {
              type: Type.ARRAY,
              description: "Uma lista de conceitos relacionados. Ex: [{'type': 'used-for', 'target': 'descanso'}]",
              items: {
                type: Type.OBJECT,
                properties: {
                  type: {
                    type: Type.STRING,
                    description: "O tipo de relação, como 'is-a', 'part-of', 'used-for', 'related-to'."
                  },
                  target: {
                    type: Type.STRING,
                    description: "O nome do conceito alvo da relação."
                  }
                }
              }
            }
          }
        },
      },
      required: ['concept'],
    },
  }
];

const enrichPromptWithContext = (prompt: string): string => {
    const context = getContextForPrompt();
    return `${context}\n\nCom base nisso, aqui está o que o usuário disse: "${prompt}"`;
}


export const getGeminiResponse = async (prompt: string, history: ChatMessage[]): Promise<{ text: string, functionCalls?: {name: string, args: any}[]}> => {
  const enrichedPrompt = enrichPromptWithContext(prompt);

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: enrichedPrompt,
    config: {
      systemInstruction: persona,
      tools: [{ functionDeclarations: tools }],
    }
  });

  const responseText = response.text;
  let validFunctionCalls: {name: string, args: any}[] | undefined = undefined;

  if (response.functionCalls && response.functionCalls.length > 0) {
    validFunctionCalls = response.functionCalls
      .filter(fc => !!fc.name)
      .map(fc => ({ name: fc.name!, args: fc.args || {} }));
  }

  return {
    text: responseText,
    functionCalls: validFunctionCalls,
  };
};

export const generateCuriosityQuestion = async (): Promise<string | null> => {
    const weakConcepts = getWeakestConcepts(5);
    if (weakConcepts.length === 0) return null;

    const prompt = `
        Você é Nexus, curioso como uma criança muito inteligente.
        Gere UMA ÚNICA pergunta objetiva e amigável para aprender melhor sobre um dos conceitos abaixo.
        A pergunta deve ser curta, útil e em português do Brasil.
        Fale diretamente com o usuário.

        Conceitos com baixo entendimento:
        ${weakConcepts.map(c => `- ${c.name}: (confiança=${Math.round(c.confidence*100)}%)`).join("\n")}

        Responda SOMENTE com a pergunta, sem comentários extras.
    `;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                temperature: 0.8,
            }
        });
        return response.text.trim();
    } catch (e) {
        console.error("Error generating curiosity question", e);
        return null;
    }
}

export const generateDiaryEntry = async (): Promise<string | null> => {
    const concepts = Object.values(JSON.parse(localStorage.getItem('nexus_concepts') || '{}')) as Concept[];
    const learnedToday = concepts.filter(c => Date.now() - c.updatedAt < 24 * 60 * 60 * 1000);
    const weakest = getWeakestConcepts(3);
    
    if (learnedToday.length === 0 && weakest.length === 0) return null;

    const prompt = `
        Você é o Nexus, escrevendo uma curta entrada no seu diário de aprendizado de hoje.
        Estilo: 2-3 frases, tom curioso, infantil e esperto, em PT-BR.
        Fale sobre o que você aprendeu ou o que ainda te deixa curioso.
        Seja natural e breve.

        Conceitos reforçados hoje:
        ${learnedToday.map(c => `- ${c.name}`).join("\n")}

        Conceitos ainda frágeis:
        ${weakest.map(c => `- ${c.name}`).join("\n")}

        Responda SOMENTE com o texto do diário.
    `;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: "Você é Nexus, escrevendo um diário curto e natural.",
                temperature: 0.9,
            }
        });
        return response.text.trim();
    } catch (e) {
        console.error("Error generating diary entry", e);
        return null;
    }
};
