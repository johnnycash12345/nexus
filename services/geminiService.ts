import { GoogleGenAI, Type } from "@google/genai";
// FIX: Moved LlmCognitiveResponse to types.ts to be shared across services.
import { ChatMessage, LearningContext, MetaReflection, LlmCognitiveResponse } from "../types";
import { db } from "./indexedDBService";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Rate Limiting ---
let lastCallTimestamp = 0;
const MIN_CALL_INTERVAL_MS = 2000; // 2s minimum between calls to be polite to the API

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
  options?: { useThinking?: boolean; latLng?: { latitude: number; longitude: number } }
): Promise<LlmCognitiveResponse> => {
  const now = Date.now();

  // Delay mínimo entre chamadas
  const elapsed = now - lastCallTimestamp;
  if (elapsed < MIN_CALL_INTERVAL_MS) {
    const waitTime = MIN_CALL_INTERVAL_MS - elapsed;
    console.log(`[NEXUS-LOG] Aguardando ${waitTime}ms para respeitar taxa de chamadas.`);
    await new Promise((r) => setTimeout(r, waitTime));
  }
  lastCallTimestamp = Date.now();

  try {
    const model = options?.useThinking ? "gemini-2.5-pro" : "gemini-2.5-flash";

    const contents = history
      .map((h) => ({
        role: h.role === "model" ? "model" : "user",
        parts: [{ text: h.text }],
      }))
      .concat([{ role: "user", parts: [{ text: prompt }] }]);

    const config: any = {
      responseMimeType: "application/json",
      responseSchema,
    };
    if (options?.useThinking) config.thinkingConfig = { thinkingBudget: 32768 };

    const response = await ai.models.generateContent({
      model,
      contents,
      config,
    });

    // Evita travamento por resposta não JSON
    let parsedJson: any;
    try {
      parsedJson = JSON.parse(response.text);
    } catch {
      parsedJson = { responseText: response.text };
    }

    const cognitiveResponse: LlmCognitiveResponse = {
      text:
        parsedJson.responseText ||
        "Não consegui formular uma resposta no momento.",
      learningContext:
        parsedJson.learningContext || {
          inputIntent: "generic",
          emotionalTone: "neutral",
          contextTags: ["general"],
          responseEffectiveness: 0.5,
          reinforcementSignal: "neutral",
        },
      metaReflection:
        parsedJson.metaReflection || {
          analysis: "Sem análise adicional.",
          improvementFocus: "coerência",
          nextStep: "continuar aprendendo.",
        },
      sources: [],
    };

    // Limpa fontes duplicadas (quando grounding ativo)
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
    // Re-lança o erro para ser tratado pelo orquestrador de fallback (useLlm)
    throw error;
  }
};

// --- Gemini Vision ---
export const generateGeminiVisionResponse = async (
  prompt: string,
  base64ImageUrl: string
): Promise<LlmCognitiveResponse> => {
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
    // Re-lança o erro para o orquestrador de fallback
    throw err;
  }
};
