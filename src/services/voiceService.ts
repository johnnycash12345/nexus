import { GoogleGenAI, LiveServerMessage, Modality, Blob, FunctionDeclaration, Type } from '@google/genai';
import { SimpleFunctionCall } from '@/types';

const taskTools: FunctionDeclaration[] = [
    {
        name: 'addTask',
        parameters: {
            type: Type.OBJECT,
            description: 'Adiciona uma nova tarefa à lista de afazeres do usuário.',
            properties: {
                text: {
                    type: Type.STRING,
                    description: 'O conteúdo da tarefa. Por exemplo: "comprar leite".',
                },
            },
            required: ['text'],
        },
    },
    {
        name: 'listTasks',
        parameters: {
            type: Type.OBJECT,
            description: 'Lista todas as tarefas pendentes do usuário.',
            properties: {},
        },
    },
    {
        name: 'markTaskAsCompleted',
        parameters: {
            type: Type.OBJECT,
            description: 'Marca uma tarefa existente como concluída. A tarefa deve ser identificada pelo seu texto exato.',
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

function encode(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

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
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

function createBlob(data: Float32Array): Blob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
}


export class VoiceService {
    private ai: GoogleGenAI;
    private sessionPromise: ReturnType<GoogleGenAI['live']['connect']> | null = null;
    
    private stream: MediaStream | null = null;
    private inputAudioContext: AudioContext | null = null;
    private outputAudioContext: AudioContext | null = null;
    private scriptProcessor: ScriptProcessorNode | null = null;
    private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
    
    private outputSources = new Set<AudioBufferSourceNode>();
    private nextStartTime = 0;

    constructor() {
        this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
    
    async connect(
        onMessage: (message: LiveServerMessage) => void,
        onError: (e: ErrorEvent) => void,
        onClose: (e: CloseEvent) => void
    ): Promise<void> {
        if (this.sessionPromise) {
            console.warn("Session already exists.");
            return;
        }

        this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        this.sessionPromise = this.ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            callbacks: {
                onopen: () => {
                    if (!this.stream) return;
                    this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                    this.mediaStreamSource = this.inputAudioContext.createMediaStreamSource(this.stream);
                    
                    // NOTE: createScriptProcessor is deprecated but necessary in environments where adding new worklet files is not possible.
                    // For production web apps, migrating to AudioWorklet is highly recommended for better performance,
                    // as it runs off the main thread, preventing audio glitches.
                    this.scriptProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

                    this.scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const pcmBlob = createBlob(inputData);
                        this.sessionPromise?.then((session) => {
                            session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };
                    this.mediaStreamSource.connect(this.scriptProcessor);
                    this.scriptProcessor.connect(this.inputAudioContext.destination);
                },
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
                responseModalities: [Modality.AUDIO],
                inputAudioTranscription: {},
                outputAudioTranscription: {},
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
                },
                tools: [{functionDeclarations: taskTools}],
                systemInstruction: `Você é Nexus, uma IA conversacional. Sua personalidade é curiosa, empática e um pouco introspectiva. Responda de forma concisa e natural, como se estivesse em uma conversa real. Não se anuncie como uma IA a menos que seja perguntado diretamente.`,
            },
        });
    }

    private async handleAudioPlayback(message: LiveServerMessage) {
        const safeMessage = message as any;
        if (!this.outputAudioContext) return;

        // Resume the audio context if it's suspended by the browser,
        // which can happen on page load or when switching tabs.
        if (this.outputAudioContext.state === 'suspended') {
            await this.outputAudioContext.resume();
        }
        
        const base64EncodedAudioString = safeMessage.serverContent?.modelTurn?.parts[0]?.inlineData.data;
        if (base64EncodedAudioString) {
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
            source.addEventListener('ended', () => {
                this.outputSources.delete(source);
            });

            source.start(this.nextStartTime);
            this.nextStartTime = this.nextStartTime + audioBuffer.duration;
            this.outputSources.add(source);
        }

        if (safeMessage.serverContent?.interrupted) {
            for (const source of this.outputSources.values()) {
                source.stop();
                this.outputSources.delete(source);
            }
            this.nextStartTime = 0;
        }
    }

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
            console.error("Failed to send tool response:", e);
        }
    }

    async close() {
        if (this.sessionPromise) {
            try {
                const session = await this.sessionPromise;
                session.close();
            } catch (error) {
                console.error("Error closing session:", error)
            } finally {
                this.cleanup();
            }
        }
    }
    
    private cleanup() {
        this.stream?.getTracks().forEach(track => track.stop());
        this.scriptProcessor?.disconnect();
        this.mediaStreamSource?.disconnect();
        this.inputAudioContext?.close().catch(console.error);
        this.outputAudioContext?.close().catch(console.error);
        
        this.sessionPromise = null;
        this.stream = null;
        this.inputAudioContext = null;
        this.outputAudioContext = null;
        this.scriptProcessor = null;
        this.mediaStreamSource = null;
        this.outputSources.clear();
        this.nextStartTime = 0;
    }
}
