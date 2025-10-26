import { ChatMessage } from '../types';

type LlmResponse = {
    text: string;
    functionCalls?: { name: string, args: any }[];
};

const API_URL = 'https://api.deepseek.com/v1/chat/completions';

export const generateDeepSeekResponse = async (apiKey: string, prompt: string, history: ChatMessage[]): Promise<LlmResponse> => {
    const messages = [
        ...history.map(h => ({ role: h.role, content: h.text })),
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
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('DeepSeek API Error:', errorData);
            const errorMessage = errorData.error?.message || response.statusText;
            return {
               text: `Desculpe, ocorreu um erro com a API: ${errorMessage}. Verifique se sua chave de API é válida.`
            };
        }

        const data = await response.json();
        const text = data.choices[0]?.message?.content || 'Não consegui gerar uma resposta.';
        
        return { text, functionCalls: [] };

    } catch (error) {
        console.error('Falha ao buscar da API DeepSeek:', error);
        return {
            text: 'Desculpe, tive um problema ao me conectar com meu cérebro. Por favor, verifique sua conexão com a internet e a chave de API.'
        };
    }
};


export const generateDeepSeekVisionResponse = async (apiKey: string, prompt: string, base64ImageUrl: string): Promise<LlmResponse> => {
    const messages = [
        {
            role: 'user',
            content: [
                {
                    type: 'text',
                    text: prompt,
                },
                {
                    type: 'image_url',
                    image_url: {
                        url: base64ImageUrl,
                    },
                },
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
            const errorMessage = errorData.error?.message || response.statusText;
            return {
               text: `Desculpe, ocorreu um erro ao analisar a imagem: ${errorMessage}.`
            };
        }

        const data = await response.json();
        const text = data.choices[0]?.message?.content || 'Não consegui processar a imagem.';
        
        return { text };

    } catch (error) {
        console.error('Falha ao buscar da API DeepSeek Vision:', error);
        return {
            text: 'Desculpe, tive um problema ao me conectar com meu cérebro visual. Verifique sua conexão.'
        };
    }
};