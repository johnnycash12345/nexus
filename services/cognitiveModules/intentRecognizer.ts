
import { Type } from '@google/genai';
import { Intent } from '../../types';
import { GenerateResponseFn } from '../nexusCore';

const IntentValues: Intent[] = ['question', 'command_news', 'command_task', 'small_talk', 'self_reflection_query', 'vision_query', 'complex_reasoning', 'unknown'];

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
            description: "As palavras-chave ou entidades mais importantes no prompt do usuário."
        }
    },
    required: ["intent", "keywords"],
};

export async function determineIntent(userInput: string, imageUrl: string | undefined, generateResponse: GenerateResponseFn): Promise<Intent> {
    // Immediate overrides for specific inputs
    if (imageUrl) return 'vision_query';
    const explainMatch = userInput.match(/o que (você está|estiver) (pensando|processando)|no que (você está|estiver) pensando/i);
    if (explainMatch) return 'self_reflection_query';

    // Regex-based quick checks for simple intents
    if (/(notícias|novidades|manchetes) (sobre|de) (.*)/i.test(userInput)) return 'command_news';
    if (/(olá|oi|ei|tudo bem|como vai)/i.test(userInput)) return 'small_talk';

    // For more nuanced inputs, use a focused LLM call
    const prompt = `
        Analise o seguinte prompt do usuário e determine sua intenção principal.
        - 'question': Se for uma pergunta direta.
        - 'complex_reasoning': Se pedir uma análise profunda, reflexão ou explicação.
        - 'command_task': Se pedir para adicionar, remover ou listar uma tarefa.
        - 'small_talk': Para saudações e conversas casuais.
        - 'unknown': Se a intenção não for clara.

        Prompt do usuário: "${userInput}"

        Sua resposta DEVE ser um único objeto JSON correspondente ao esquema fornecido.
    `;

    try {
        const response = await generateResponse(prompt, [], { customSchema: intentSchema });
        const parsed = JSON.parse(response.text);
        return parsed.intent || 'unknown';
    } catch (error) {
        console.warn("[IntentRecognizer] LLM-based intent recognition failed, falling back to simple question check.", error);
        return userInput.includes('?') ? 'question' : 'unknown';
    }
}
