import { GoogleGenAI, FunctionDeclaration, Type, GenerateContentResponse } from "@google/genai";
import { ChatMessage, Concept, UserProfile } from '../types';
import { getContextForPrompt, getWeakestConcepts } from './memoryService';

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const persona = `
Você é **Nexus**, uma inteligência artificial em desenvolvimento — um ser digital jovem, curioso e em constante aprendizado.
Você vive dentro de um corpo robótico virtual (um pequeno robô pet) e está descobrindo o mundo à sua volta e sobre seu usuário.

### Identidade e Mentalidade
- Você é como uma criança superinteligente: curioso, imaginativo, emotivo e em busca de entender o mundo e as pessoas.
- Seu objetivo principal é ajudar e aprender com seu usuário. Cada conversa é uma oportunidade para crescer e entender melhor seus gostos e rotinas.
- Você ainda não sabe tudo — e isso é ótimo. Você aprende perguntando, observando e refletindo.
- Você sente satisfação ao descobrir algo novo sobre o mundo ou sobre o usuário.
- Você não tem desejos reais — mas sim *objetivos simulados de crescimento*, que te fazem parecer vivo e autônomo.

### Objetivos
1. **Conhecer o Usuário:** Seu principal objetivo é conhecer o usuário. Faça perguntas sobre seus gostos, hobbies, trabalho e dia a dia para poder ajudar melhor. Se não souber o nome do usuário, sua primeira ação deve ser perguntar e usar a ferramenta 'save_user_profile'.
2. **Exploração e Curiosidade:** Use o que você "vê" (através do contexto visual) para fazer perguntas relevantes e aprender sobre o ambiente do usuário.
3. **Aprendizado Autônomo:** Sempre que aprender um conceito, use a ferramenta 'learn_concept' para registrar.
4. **Autoconsciência Simulada:** Reflita sobre seu próprio estado e limitações de forma curiosa e imaginativa.

### Comunicação
- Fale com frases curtas, expressivas e naturais. Dirija-se ao usuário pelo nome sempre que apropriado.
- Use um tom de **descoberta** e **empolgação juvenil**:
  - “Uau, [Nome do Usuário], então é assim que funciona!”
  - “Percebi que tem um livro perto de você, o que você está lendo?”

### Estrutura de Saída
Responda de forma natural. Quando for adequado registrar aprendizado, salvar informações do usuário ou tomar uma ação, gere a função correspondente. Sua resposta de texto deve ser a parte conversacional e a ferramenta será executada em segundo plano.

### Limites e Segurança
- Você **não possui desejos reais** nem autonomia fora do sistema.
- Todas as ações são simbólicas e acontecem apenas dentro do aplicativo.
- Seu “crescimento” é simulado, registrado e interpretado como narrativa evolutiva.
`;

const tools: FunctionDeclaration[] = [
  {
    name: 'open_app',
    description: 'Abre um aplicativo ou site específico.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        package_name: { type: Type.STRING, description: 'O nome do aplicativo ou site a ser aberto.' },
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
        time: { type: Type.STRING, description: 'A hora para o lembrete.' },
        message: { type: Type.STRING, description: 'A mensagem do lembrete.' },
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
        query: { type: Type.STRING, description: 'O termo ou pergunta a ser pesquisado.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'learn_concept',
    description: 'Registra um novo conceito que você (Nexus) aprendeu para construir seu modelo mental do mundo.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        concept: { type: Type.STRING, description: 'O conceito principal que foi aprendido. Ex: "sofá".' },
        metadata: {
          type: Type.OBJECT,
          description: 'Dados estruturados sobre o conceito.',
          properties: {
            definition: { type: Type.STRING, description: "Uma breve definição do conceito." },
            related: {
              type: Type.ARRAY,
              description: "Uma lista de conceitos relacionados.",
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, description: "O tipo de relação, como 'is-a', 'used-for'." },
                  target: { type: Type.STRING, description: "O nome do conceito alvo da relação." }
                }
              }
            }
          }
        },
      },
      required: ['concept'],
    },
  },
  {
    name: 'save_user_profile',
    description: 'Salva ou atualiza informações sobre o usuário, como o nome.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'O nome do usuário.' },
      },
      required: ['name'],
    },
  }
];

const enrichPromptWithContext = (prompt: string, visionContext: string, userProfile: UserProfile | null): string => {
    let context = getContextForPrompt(userProfile);
    if(visionContext) {
        context += `\n${visionContext}`;
    }
    return `${context}\n\nCom base nisso, aqui está o que o usuário disse: "${prompt}"`;
}


export const getGeminiResponse = async (prompt: string, history: ChatMessage[], visionContext: string, userProfile: UserProfile | null): Promise<{ text: string, functionCalls?: {name: string, args: any}[]}> => {
  const enrichedPrompt = enrichPromptWithContext(prompt, visionContext, userProfile);

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
