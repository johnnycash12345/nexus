import { GoogleGenAI, LiveServerMessage, Modality, Blob, FunctionDeclaration, Type } from '@google/genai';
import { SimpleFunctionCall } from '@/types'; // Mantido para tipagem

// URL onde o seu AudioWorkletProcessor está localizado
// IMPORTANTE: Mantenha esta URL como uma string para que o TypeScript não tente importá-la como módulo
const AUDIO_WORKLET_URL = '/audio-processor.js'; 

// Otimização: Separa as ferramentas e a config para melhor modularidade.

// --------------------------------------------------------------------------
// 1. Definições de Ferramentas
// --------------------------------------------------------------------------
const taskTools: FunctionDeclaration[] = [
    {
        name: 'addTask',
        description: 'Adiciona uma nova tarefa à lista de afazeres do usuário.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                text: {
                    type: Type.STRING,
                    description: 'O conteúdo da tarefa. Ex: "comprar leite".',
                },
            },
            required: ['text'],
        },
    },
    {
        name: 'listTasks',
        description: 'Lista todas as tarefas pendentes do usuário.',
        parameters: { type: Type.OBJECT, properties: {} },
    },
    {
        name: 'markTaskAsCompleted',
        description: 'Marca uma tarefa existente como concluída. Use o texto exato da tarefa.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                text: {
                    type: Type.STRING,
                    description: 'O texto exato da tarefa a ser marcada como concluída.',
                },
            },
            required: ['text'],
        },
    },
];

// --------------------------------------------------------------------------
// 2. Utilitários (Refatorados para clareza)
// --------------------------------------------------------------------------

/** Converte Uint8Array para string Base64. */
function encode(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes)); // Uso de spread operator moderno
}

/** Converte string Base64 para Uint8Array. */
function decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

/** Converte Float32Array (PCM) para Blob de áudio (Int16) Base64. */
function createBlob(data: Float32Array): Blob {
    const l = data.length;
    const int16 = new Int16Array(l);
    // Conversão de float para Int16 (32768 é o máximo para Int16)
    for (let i = 0; i < l; i++) {
        int16[i] = Math.max(-1, Math.min(1, data[i])) * 32768; // Clamp e scale
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000', // Assumindo taxa de amostragem de entrada
    };
}

/**
 * Decodifica o áudio do servidor (PCM Int16) para AudioBuffer (Float32).
 */
async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            // Normaliza Int16 para Float32 (-1.0 a 1.0)
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0; 
        }
    }
    return buffer;
}


// --------------------------------------------------------------------------
// 3. Classe VoiceService
// --------------------------------------------------------------------------

export class VoiceService {
    private ai: GoogleGenAI;
    private sessionPromise: ReturnType<GoogleGenAI['live']['connect']> | null = null;
    
    // Web Audio API Elements
    private stream: MediaStream | null = null;
    private inputAudioContext: AudioContext | null = null;
    private outputAudioContext: AudioContext | null = null;
    // SUBSTITUIÇÃO: AudioWorkletNode no lugar de ScriptProcessorNode
    private audioWorkletNode: AudioWorkletNode | null = null;
    private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
    
    // Playback state
    private outputSources = new Set<AudioBufferSourceNode>();
    private nextStartTime = 0;

    /**
     * @param apiKey A chave da API do Google GenAI.
     */
    constructor(apiKey: string) {
        // Uso da chave API passada no construtor para melhor segurança e DI
        this.ai = new GoogleGenAI({ apiKey }); 
    }
    
    /**
     * Inicia a conexão de voz em tempo real e configura o streaming de áudio.
     */
    async connect(
        onMessage: (message: LiveServerMessage) => void,
        onError: (e: ErrorEvent) => void,
        onClose: (e: CloseEvent) => void
    ): Promise<void> {
        if (this.sessionPromise) {
            console.warn("Sessão de voz já existe. Retornando.");
            return;
        }

        try {
            // 1. Inicializa Contextos de Áudio
            // Taxa de saída (padrão do servidor de voz)
            this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            // Taxa de entrada (padrão para Gemini Live Audio)
            this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });

            // 2. Obtém Microfone
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // 3. Conecta o LLM Live Session
            this.sessionPromise = this.ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => this.setupAudioProcessing(),
                    onmessage: async (message: LiveServerMessage) => {
                        onMessage(message);
                        await this.handleAudioPlayback(message);
                    },
                    onerror: onError,
                    onclose: (e) => {
                        this.cleanup();
                        onClose(e);
                    },
                },
                config: {
                    // Configurações do LLM Live (mantidas e aprimoradas)
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    speechConfig: {
                        // Voz Zephyr (mantida, mas pode ser configurável)
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }, 
                    },
                    tools: [{functionDeclarations: taskTools}],
                    systemInstruction: `Você é Nexus, uma IA conversacional. Sua personalidade é curiosa, empática e um pouco introspectiva. Responda de forma concisa e natural, como se estivesse em uma conversa real. Não se anuncie como uma IA a menos que seja perguntado diretamente.`,
                },
            });
        } catch (error) {
            console.error("Falha na conexão de voz:", error);
            this.cleanup();
            throw error;
        }
    }

    /**
     * Configura o processamento de áudio de entrada usando AudioWorklet.
     * @private
     */
    private async setupAudioProcessing() {
        if (!this.stream || !this.inputAudioContext) return;
        
        try {
            // 1. Carrega o AudioWorklet Processor (assumindo que o arquivo está na URL correta)
            await this.inputAudioContext.audioWorklet.addModule(AUDIO_WORKLET_URL);

            // 2. Cria os nós de áudio
            this.mediaStreamSource = this.inputAudioContext.createMediaStreamSource(this.stream);
            // Instancia o AudioWorkletNode
            this.audioWorkletNode = new AudioWorkletNode(
                this.inputAudioContext, 
                'pcm-recorder-processor',
                { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1 }
            );

            // 3. Configura a comunicação Worklet -> Main Thread
            this.audioWorkletNode.port.onmessage = (event) => {
                // Recebe o buffer de Float32Array do Worklet
                const inputData = event.data as Float32Array; 
                const pcmBlob = createBlob(inputData);
                
                // Envia o Blob de PCM para o servidor
                this.sessionPromise?.then((session) => {
                    session.sendRealtimeInput({ media: pcmBlob });
                });
            };

            // 4. Conecta os nós: Fonte -> Worklet -> Destino (opcional, mas bom para garantir que o contexto não seja desconectado)
            this.mediaStreamSource.connect(this.audioWorkletNode);
            this.audioWorkletNode.connect(this.inputAudioContext.destination);

        } catch (e) {
            console.error("Falha ao configurar AudioWorklet:", e);
            // Fallback ou notificação de erro, pois o AudioWorklet é crítico.
            this.cleanup();
        }
    }

    /**
     * Lida com o áudio de saída do servidor, garantindo a reprodução sequencial.
     * @private
     */
    private async handleAudioPlayback(message: LiveServerMessage) {
        if (!this.outputAudioContext) return;

        // Gerenciamento de Interrupção
        if (message.serverContent?.interrupted) {
            // Interrompe qualquer áudio em reprodução imediatamente
            for (const source of this.outputSources.values()) {
                source.stop();
            }
            this.outputSources.clear();
            this.nextStartTime = this.outputAudioContext.currentTime; // Reseta o próximo tempo de início para AGORA
        }

        // Retoma o Contexto (necessário em muitos navegadores)
        if (this.outputAudioContext.state === 'suspended') {
            await this.outputAudioContext.resume();
        }
        
        const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
        if (base64EncodedAudioString) {
            // Calcula o tempo de início: O máximo entre o tempo de reprodução atual do contexto
            // e o `nextStartTime` (que é o final da última fatia de áudio).
            this.nextStartTime = Math.max(
                this.nextStartTime,
                this.outputAudioContext.currentTime,
            );
            
            const audioBuffer = await decodeAudioData(
                decode(base64EncodedAudioString),
                this.outputAudioContext,
                24000,
                1,
            );
            
            const source = this.outputAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.outputAudioContext.destination);
            
            // Gerenciamento do Set de Fontes
            source.addEventListener('ended', () => {
                this.outputSources.delete(source);
            });

            source.start(this.nextStartTime);
            this.nextStartTime = this.nextStartTime + audioBuffer.duration; // Atualiza o tempo para a próxima fatia
            this.outputSources.add(source);
        }
    }

    // Métodos de Comunicação e Fechamento (Refatorados) -----------------------

    async sendToolResponse(id: string, name: string, result: any) {
        if (!this.sessionPromise) return;
        try {
            const session = await this.sessionPromise;
            session.sendToolResponse({
                functionResponses: {
                    id,
                    name,
                    response: result,
                }
            });
        } catch (e) {
            console.error("Falha ao enviar resposta da ferramenta:", e);
        }
    }

    async close() {
        if (this.sessionPromise) {
            try {
                const session = await this.sessionPromise;
                session.close();
            } catch (error) {
                console.error("Erro ao fechar sessão:", error)
            } finally {
                this.cleanup();
            }
        }
    }
    
    /**
     * @private Desconecta e libera todos os recursos de áudio e rede.
     */
    private cleanup() {
        // Para a faixa de áudio do microfone
        this.stream?.getTracks().forEach(track => track.stop());
        
        // Desconecta e fecha os nós da Web Audio API
        this.audioWorkletNode?.port.close(); // Fecha a porta de comunicação do Worklet
        this.audioWorkletNode?.disconnect();
        this.mediaStreamSource?.disconnect();
        
        // Garante que todos os áudios de saída sejam interrompidos
        for (const source of this.outputSources.values()) {
            source.stop();
        }
        
        // Fecha os contextos de áudio de forma assíncrona
        this.inputAudioContext?.close().catch(console.error);
        this.outputAudioContext?.close().catch(console.error);
        
        // Reseta o estado
        this.sessionPromise = null;
        this.stream = null;
        this.inputAudioContext = null;
        this.outputAudioContext = null;
        this.audioWorkletNode = null;
        this.mediaStreamSource = null;
        this.outputSources.clear();
        this.nextStartTime = 0;
    }
}