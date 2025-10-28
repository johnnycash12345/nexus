import { Type } from '@google/genai';
import { Intent } from '@/types';
import { GenerateResponseFn } from '@/types';

const IntentValues: Intent[] = ['question', 'command_news', 'command_task', 'small_talk', 'self_reflection_query', 'vision_query', 'complex_reasoning', 'project_start', 'web_search', 'unknown'];

const intentSchema = {
    type: Type.OBJECT,
    properties: {
        intent: {
            type: Type.STRING,
            enum: IntentValues,
            description: "A intenção primária do usuário."
        },
        keywords: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
        }
    },
    required: ["intent", "keywords"],
};

export async function determineIntent(userInput: string, imageUrl: string | undefined, generateResponse: GenerateResponseFn): Promise<Intent> {
    if (imageUrl) return 'vision_query';
    
    // Quick regex checks for common, high-confidence intents
    const lowerInput = userInput.toLowerCase();
    if (/o que (você está|estiver) (pensando|processando)/i.test(lowerInput)) return 'self_reflection_query';
    if (/(notícias|novidades|manchetes) (sobre|de)/i.test(lowerInput)) return 'command_news';
    if (/(olá|oi|tudo bem|como vai)/i.test(lowerInput)) return 'small_talk';
    if (/(crie um projeto|inicie o projeto|construa|faça um plano para)/i.test(lowerInput)) return 'project_start';
    if (/(pesquise|procure|busque|o que é|quem é|quem foi|fale sobre|informações sobre)/i.test(lowerInput)) return 'web_search';

    // Fallback to LLM for more nuanced cases
    const prompt = `
        Analise o prompt do usuário e determine sua intenção principal.
        - 'web_search': O usuário está pedindo para pesquisar na web por informações gerais.
        - 'question': Pergunta direta que não requer pesquisa externa.
        - 'complex_reasoning': Pede análise, reflexão, explicação.
        - 'command_task': Pede para gerenciar uma tarefa (adicionar, listar, etc).
        - 'project_start': Pede para iniciar um projeto de múltiplos passos.
        - 'small_talk': Conversa casual.
        - 'unknown': Se não for claro.

        Prompt: "${userInput}"
        Sua resposta DEVE ser um único objeto JSON.
    `;

    try {
        const response = await generateResponse(prompt, [], { customSchema: intentSchema });
        const parsed = JSON.parse(response.text);
        return parsed.intent || 'unknown';
    } catch (error) {
        console.warn("[IntentRecognizer] LLM intent recognition failed.", error);
        return userInput.includes('?') ? 'question' : 'unknown';
    }
}
