import { GoogleGenAI, Type } from "@google/genai";
import { ChatMessage, LearningContext, MetaReflection, LlmCognitiveResponse } from "../types";
import { db } from "./indexedDBService";
import { cognitiveMonitor } from "./cognitiveMonitor";
import { telemetryService } from './telemetryService';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Request Queue ---
type RequestResolver<T> = () => Promise<T>;
const requestQueue: {
    request: RequestResolver<any>;
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
}[] = [];
let isProcessingQueue = false;

async function processQueue() {
    if (isProcessingQueue || requestQueue.length === 0) {
        return;
    }
    isProcessingQueue = true;
    const { request, resolve, reject } = requestQueue.shift()!;
    try {
        const result = await request();
        resolve(result);
    } catch (error) {
        reject(error);
    } finally {
        isProcessingQueue = false;
        processQueue();
    }
}

function enqueueRequest<T>(request: RequestResolver<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        requestQueue.push({ request, resolve, reject });
        if (!isProcessingQueue) {
            processQueue();
        }
    });
}

// --- Retry Helper ---
const API_TIMEOUT = 30000; // 30 seconds

async function withRetry<T>(apiCall: () => Promise<T>, retries = 3, backoff = 2000): Promise<T> {
    try {
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('API call timed out')), API_TIMEOUT)
        );
        const result = await Promise.race([apiCall(), timeoutPromise]);
        telemetryService.incrementSuccess();
        return result;
    } catch (error: any) {
        telemetryService.incrementFailure();
        const errorString = (error.message || '').toString();
        const isRetryableError =
            errorString.includes('429') || // Rate limit
            /5\d\d/.test(errorString) || // 5xx server errors
            errorString.includes('Failed to fetch') || // Network error
            errorString.includes('timed out'); // Timeout

        if (isRetryableError && retries > 0) {
            console.warn(`[NEXUS-GEMINI] Retryable error occurred. Retrying in ${backoff / 1000}s... (${retries} retries left)`, error.message);
            await new Promise(resolve => setTimeout(resolve, backoff));
            return withRetry(apiCall, retries - 1, backoff * 2);
        } else if (isRetryableError) {
            console.error(`[NEXUS-ERROR] API call failed after multiple retries.`);
        }
        
        throw error;
    }
}


// --- Rate Limiting ---
let lastCallTimestamp = 0;
const MIN_CALL_INTERVAL_MS = 1000; // 1s minimum between calls, queue handles concurrency

// --- Types ---
interface GenerateOptions {
  useThinking?: boolean;
  latLng?: { latitude: number; longitude: number };
  customSchema?: any;
  tools?: any[];
  forcePlainText?: boolean;
}

// --- JSON Extraction Helper ---
function extractJson(str: string): any | null {
  if (!str) return null;
  const firstBrace = str.indexOf('{');
  const lastBrace = str.lastIndexOf('}');
  
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    return null;
  }
  
  const jsonString = str.substring(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.warn("[NEXUS-GEMINI] Failed to parse extracted JSON string:", e);
    return null;
  }
}


// --- Schema Estruturado ---
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    responseText: { type: Type.STRING },
    learningContext: {
      type: Type.OBJECT,
      properties: {
        inputIntent: { type: Type.STRING },
        emotionalTone: { type: Type.STRING },
        contextTags: { type: Type.ARRAY, items: { type: Type.STRING } },
        responseEffectiveness: { type: Type.NUMBER },
        reinforcementSignal: { type: Type.STRING },
      },
      required: [
        "inputIntent",
        "emotionalTone",
        "contextTags",
        "responseEffectiveness",
        "reinforcementSignal",
      ],
    },
    metaReflection: {
      type: Type.OBJECT,
      properties: {
        analysis: { type: Type.STRING },
        improvementFocus: { type: Type.STRING },
        nextStep: { type: Type.STRING },
      },
      required: ["analysis", "improvementFocus", "nextStep"],
    },
  },
  required: ["responseText", "learningContext", "metaReflection"],
};

// --- Função Principal ---
export const generateGeminiResponse = async (
  prompt: string,
  history: ChatMessage[],
  options: GenerateOptions = {}
): Promise<LlmCognitiveResponse> => {
  return enqueueRequest(() => withRetry(async () => {
    const now = Date.now();
    const elapsed = now - lastCallTimestamp;
    if (elapsed < MIN_CALL_INTERVAL_MS) {
      const waitTime = MIN_CALL_INTERVAL_MS - elapsed;
      await new Promise((r) => setTimeout(r, waitTime));
    }
    lastCallTimestamp = Date.now();
    const model = options.useThinking ? "gemini-2.5-pro" : "gemini-2.5-flash";
    cognitiveMonitor.logThought(`Consultando modelo: ${model} com prompt de ${prompt.length} caracteres.`);

    try {
      const contents = history
        .map((h) => ({
          role: h.role === "model" ? "model" : "user",
          parts: [{ text: h.text }],
        }))
        .concat([{ role: "user", parts: [{ text: prompt }] }]);

      const config: any = {
        responseMimeType: options.forcePlainText ? undefined : (options.tools ? undefined : "application/json"),
        responseSchema: options.forcePlainText ? undefined : (options.tools ? undefined : (options.customSchema || responseSchema)),
      };
      if (options.useThinking) config.thinkingConfig = { thinkingBudget: 32768 };
      if (options.tools) config.tools = options.tools;

      const toolConfig: any = {};
      if (options.latLng) {
        toolConfig.retrievalConfig = { latLng: options.latLng };
      }
      if (Object.keys(toolConfig).length > 0) {
        config.toolConfig = toolConfig;
      }

      const response = await ai.models.generateContent({
        model,
        contents,
        config,
      });

      cognitiveMonitor.logThought('Resposta do modelo recebida e sendo processada.');
      const rawText = response.text;

      if (options.forcePlainText) {
          return {
              text: rawText.trim(),
              learningContext: { inputIntent: 'internal', emotionalTone: 'neutral', contextTags: [], responseEffectiveness: 0.5, reinforcementSignal: 'neutral' },
              metaReflection: { analysis: 'Plain text response requested.', improvementFocus: 'accuracy', nextStep: 'provide text' },
              functionCalls: [],
              sources: [],
          };
      }
      
      let parsedJson: any = null;
      let userFacingText: string = rawText; // Default to raw text as a fallback

      if (!options.tools) {
          const extracted = extractJson(rawText);
          
          if (extracted) {
              parsedJson = extracted;
              if (options.customSchema) {
                  userFacingText = JSON.stringify(parsedJson, null, 2);
              } else {
                  const textFromJSON = parsedJson.responseText || parsedJson.response || parsedJson.text;
                  
                  if (typeof textFromJSON === 'string' && textFromJSON.trim()) {
                      userFacingText = textFromJSON;
                  } else {
                      console.warn("[NEXUS-GEMINI] JSON response received, but the user-facing text field ('responseText', 'response', 'text') is missing or empty.", parsedJson);
                      userFacingText = "Entendi, mas estou processando essa informação internamente. Poderia reformular sua pergunta, por favor?";
                  }
              }
          }
      }
      
      const cognitiveResponse: LlmCognitiveResponse = {
        text: userFacingText.trim() || "Não consegui formular uma resposta no momento.",
        learningContext:
          parsedJson?.learningContext || {
            inputIntent: "generic",
            emotionalTone: "neutral",
            contextTags: ["general"],
            responseEffectiveness: 0.5,
            reinforcementSignal: "neutral",
          },
        metaReflection:
          parsedJson?.metaReflection || {
            analysis: "Sem análise adicional.",
            improvementFocus: "coerência",
            nextStep: "continuar aprendendo.",
          },
        functionCalls: response.functionCalls as any,
        sources: [],
      };

      const groundingChunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = groundingChunks.reduce((acc: any[], chunk: any) => {
        if (chunk?.web?.uri && chunk?.web?.title)
          acc.push({ uri: chunk.web.uri, title: chunk.web.title });
        if (chunk?.maps?.uri && chunk?.maps?.title)
          acc.push({ uri: chunk.maps.uri, title: chunk.maps.title });
        return acc;
      }, []);

      const seenUris = new Set();
      cognitiveResponse.sources = sources.filter((s) => {
        if (seenUris.has(s.uri)) return false;
        seenUris.add(s.uri);
        return true;
      });

      return cognitiveResponse;
    } catch (error: any) {
      cognitiveMonitor.logThought(`Erro na chamada do Gemini: ${error.message}`);
      // Error is thrown to be handled by withRetry
      throw error;
    }
  }));
};

// --- Gemini Vision ---
export const generateGeminiVisionResponse = async (
  prompt: string,
  base64ImageUrl: string
): Promise<LlmCognitiveResponse> => {
  return enqueueRequest(() => withRetry(async () => {
    const now = Date.now();
    const elapsed = now - lastCallTimestamp;
    if (elapsed < MIN_CALL_INTERVAL_MS)
      await new Promise((r) => setTimeout(r, MIN_CALL_INTERVAL_MS - elapsed));
    lastCallTimestamp = Date.now();
    cognitiveMonitor.logThought('Consultando modelo de visão com imagem.');

    try {
      const model = "gemini-2.5-flash";
      const mimeType = base64ImageUrl.substring(
        base64ImageUrl.indexOf(":") + 1,
        base64ImageUrl.indexOf(";")
      );
      const base64Data = base64ImageUrl.split(",")[1];

      const response = await ai.models.generateContent({
        model,
        contents: {
          parts: [{ text: prompt }, { inlineData: { mimeType, data: base64Data } }],
        },
      });
      cognitiveMonitor.logThought('Resposta do modelo de visão recebida.');

      return {
        text: response.text,
        learningContext: {
          inputIntent: "vision_query",
          emotionalTone: "curious",
          contextTags: ["image", "visual_analysis"],
          responseEffectiveness: 0.85,
          reinforcementSignal: "positive",
        },
        metaReflection: {
          analysis: "Análise visual bem-sucedida.",
          improvementFocus: "reconhecimento de padrões",
          nextStep: "Associar imagem com memórias semânticas.",
        },
      };
    } catch (err: any) {
      cognitiveMonitor.logThought(`Erro na chamada de visão do Gemini: ${err.message}`);
      // Error is thrown to be handled by withRetry
      throw err;
    }
  }));
};