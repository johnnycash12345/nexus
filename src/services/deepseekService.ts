import { ChatMessage, LlmCognitiveResponse } from '../types';

const API_URL = 'https://api.deepseek.com/v1/chat/completions';

const systemPrompt = `
Sua resposta DEVE ser um único objeto JSON válido, sem nenhum texto adicional antes ou depois do objeto JSON.
O objeto JSON deve ter a seguinte estrutura:
{
  "responseText": "Sua resposta textual para o usuário aqui.",
  "learningContext": {
    "inputIntent": "string, ex: 'pergunta', 'comando', 'declaração'",
    "emotionalTone": "string, ex: 'curioso', 'feliz', 'urgente'",
    "contextTags": ["string", "array", "de", "tags", "relevantes"],
    "responseEffectiveness": "number, sua autoavaliação de 0.0 a 1.0",
    "reinforcementSignal": "'positive' | 'neutral' | 'negative'"
  },
  "metaReflection": {
    "analysis": "Sua análise sobre como você chegou a esta resposta.",
    "improvementFocus": "Uma área específica que você pode melhorar no futuro.",
    "nextStep": "Uma ação concreta para seu próximo ciclo de aprendizado."
  }
}
O 'prompt' do usuário contém diretivas de sistema e o prompt real do usuário. Siga-as para gerar o 'responseText' e preencha os outros campos com sua análise cognitiva.
`;

export const generateDeepSeekResponse = async (apiKey: string, prompt: string, history: ChatMessage[]): Promise<LlmCognitiveResponse> => {
    const messages = [
        { role: 'system', content: systemPrompt },
        ...history.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.text })),
        { role: 'user', content: prompt } 
    ];

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: messages,
                max_tokens: 1024,
                temperature: 0.7,
                response_format: { type: 'json_object' }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('DeepSeek API Error:', errorData);
            throw new Error(`DeepSeek API Error: ${errorData.error?.message || response.status}`);
        }

        const data = await response.json();
        const rawResponse = data.choices[0]?.message?.content || '{}';
        
        let parsedJson: any;
        try {
            parsedJson = JSON.parse(rawResponse);
        } catch (e) {
            console.error("DeepSeek response is not valid JSON:", rawResponse);
            parsedJson = { responseText: rawResponse }; // Fallback to raw text
        }

        return {
            text: parsedJson.responseText || "Não consegui formular uma resposta no momento.",
            learningContext: parsedJson.learningContext || {
                inputIntent: "generic_deepseek", emotionalTone: "neutral",
                contextTags: ["general", "deepseek"], responseEffectiveness: 0.5,
                reinforcementSignal: "neutral",
            },
            metaReflection: parsedJson.metaReflection || {
                analysis: "Sem análise adicional (resposta de fallback DeepSeek).",
                improvementFocus: "coerência", nextStep: "continuar aprendendo.",
            },
            sources: [], // DeepSeek não suporta grounding
        };

    } catch (error) {
        console.error('Falha ao buscar da API DeepSeek:', error);
        throw error; // Re-throw para ser tratado pelo orquestrador
    }
};


export const generateDeepSeekVisionResponse = async (apiKey: string, prompt: string, base64ImageUrl: string): Promise<LlmCognitiveResponse> => {
    const messages = [
        {
            role: 'user',
            content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: base64ImageUrl } },
            ],
        },
    ];

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-vl-chat',
                messages: messages,
                max_tokens: 1024,
                temperature: 0.7,
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('DeepSeek Vision API Error:', errorData);
            throw new Error(`DeepSeek Vision API Error: ${errorData.error?.message || response.status}`);
        }

        const data = await response.json();
        const text = data.choices[0]?.message?.content || 'Não consegui processar a imagem.';
        
        // Retorna a estrutura cognitiva completa com valores padrão
        return {
            text: text,
            learningContext: {
                inputIntent: 'vision_deepseek_fallback', emotionalTone: 'curious',
                contextTags: ['image', 'fallback', 'deepseek'], responseEffectiveness: 0.6,
                reinforcementSignal: 'neutral'
            },
            metaReflection: {
                analysis: 'Resposta de visão gerada via modelo DeepSeek (fallback).',
                improvementFocus: 'n/a', nextStep: 'n/a'
            }
        };

    } catch (error) {
        console.error('Falha ao buscar da API DeepSeek Vision:', error);
        throw error;
    }
};