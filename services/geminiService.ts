
import { GoogleGenAI, Type } from "@google/genai";
import { ChatMessage, LearningContext, MetaReflection, LlmCognitiveResponse } from "../types";
import { db } from "./indexedDBService";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Retry Helper ---
async function withRetry<T>(apiCall: () => Promise<T>, retries = 3, backoff = 2000): Promise<T> {
    try {
        return await apiCall();
    } catch (error: any) {
        const errorString = JSON.stringify(error);
        const isRateLimitError = errorString.includes('429') || errorString.includes('RESOURCE_EXHAUSTED');
        
        if (isRateLimitError && retries > 0) {
            console.warn(`[NEXUS-GEMINI] Rate limit atingido. Tentando novamente em ${backoff / 1000}s... (${retries} tentativas restantes)`);
            await new Promise(resolve => setTimeout(resolve, backoff));
            return withRetry(apiCall, retries - 1, backoff * 2);
        } else if (isRateLimitError) {
             console.error(`[NEXUS-ERROR] Rate limit atingido e número máximo de tentativas excedido.`);
        }
        
        throw error; // Re-throw for fallbacks
    }
}


// --- Rate Limiting ---
let lastCallTimestamp = 0;
const MIN_CALL_INTERVAL_MS = 2000; // 2s minimum between calls to be polite to the API

// --- Types ---
interface GenerateOptions {
  useThinking?: boolean;
  latLng?: { latitude: number; longitude: number };
  customSchema?: any;
  tools?: any[];
}

// --- JSON Extraction Helper ---
function extractJson(str: string): any | null {
  if (!str) return null;
  // Find the first '{' and the last '}' to bound the JSON object.
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
  return withRetry(async () => {
    const now = Date.now();
    const elapsed = now - lastCallTimestamp;
    if (elapsed < MIN_CALL_INTERVAL_MS) {
      const waitTime = MIN_CALL_INTERVAL_MS - elapsed;
      console.log(`[NEXUS-LOG] Aguardando ${waitTime}ms para respeitar taxa de chamadas.`);
      await new Promise((r) => setTimeout(r, waitTime));
    }
    lastCallTimestamp = Date.now();

    try {
      const model = options.useThinking ? "gemini-2.5-pro" : "gemini-2.5-flash";

      const contents = history
        .map((h) => ({
          role: h.role === "model" ? "model" : "user",
          parts: [{ text: h.text }],
        }))
        .concat([{ role: "user", parts: [{ text: prompt }] }]);

      const config: any = {
        responseMimeType: options.tools ? undefined : "application/json",
        responseSchema: options.tools ? undefined : (options.customSchema || responseSchema),
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

      const rawText = response.text;
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
      console.error(`[NEXUS-ERROR] Falha na chamada do Gemini:`, error);
      throw error;
    }
  });
};

// --- Gemini Vision ---
export const generateGeminiVisionResponse = async (
  prompt: string,
  base64ImageUrl: string
): Promise<LlmCognitiveResponse> => {
  return withRetry(async () => {
    const now = Date.now();
    const elapsed = now - lastCallTimestamp;
    if (elapsed < MIN_CALL_INTERVAL_MS)
      await new Promise((r) => setTimeout(r, MIN_CALL_INTERVAL_MS - elapsed));
    lastCallTimestamp = Date.now();

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
    } catch (err) {
      console.error("[NEXUS-VISION-ERROR]:", err);
      throw err;
    }
  });
};
