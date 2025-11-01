// hooks/useProactiveAgent.ts
/**
 * Hook cognitivo central do Nexus.
 * Ele executa o ciclo completo de percepção → reflexão → aprendizado.
 */

import { useEffect, useState } from "react";
import { selfReflection } from "../services/selfReflection";
import { adaptiveMemory } from "../services/adaptiveMemory";
import { fetchNews } from "../services/newsService";
import { db } from "../services/indexedDBService";
import { generateGeminiResponse } from "../services/geminiService";
import { AppSettings } from "../types";

/**
 * O useProactiveAgent roda em segundo plano,
 * fazendo o Nexus refletir e aprender em ciclos periódicos.
 */
export function useProactiveAgent(userId: string = "paulo-creator-001", settings: AppSettings | null) {
  const [isThinking, setIsThinking] = useState(false);
  const [lastReflection, setLastReflection] = useState<string | null>(null);
  const [lastInsight, setLastInsight] = useState<string | null>(null);

  useEffect(() => {
    // FIX: Changed NodeJS.Timeout to number for browser compatibility.
    let intervalId: number;

    async function cognitiveCycle() {
      if (isThinking) return; // Evita sobreposição de ciclos
      if (!settings?.apiKeys?.newsApiKey) {
        console.log("[NEXUS-CORE] News API key not configured. Proactive agent is paused.");
        return;
      }
      setIsThinking(true);

      try {
        console.log("[NEXUS-CORE] 🧭 Iniciando ciclo cognitivo...");

        // 1️⃣ Percepção – Lê o mundo
        // FIX: Pass the News API key to the fetchNews function.
        const news = await fetchNews(settings.apiKeys.newsApiKey);
        if (news.length === 0) {
          console.log("[NEXUS] Nenhuma notícia relevante encontrada.");
          setIsThinking(false);
          return;
        }

        const chosen = news[Math.floor(Math.random() * news.length)];
        // FIX: Use sourceName property which is available on the news article type.
        console.log(`[NEXUS] Analisando artigo: "${chosen.title}" (${chosen.sourceName})`);

        // 2️⃣ Reflexão – Pensa sobre o conteúdo
        // FIX: Pass the news API key as the second argument to reflectOnWorldEvents.
        await selfReflection.reflectOnWorldEvents(
            async (prompt: string) => await generateGeminiResponse(prompt, []),
            settings.apiKeys.newsApiKey
        );

        // 3️⃣ Aprendizado – Transforma a reflexão em conceitos
        // FIX: Correctly call getWorldReflections, which is now implemented in the DB service.
        const reflections = await db.getWorldReflections(userId);
        const latest = reflections[0]; // The list is reversed, so the first item is the latest.
        if (latest?.text) {
          await adaptiveMemory.storeReflectionAsConcepts(userId, latest.text);
          setLastReflection(latest.text);
          console.log("[NEXUS-MEMORY] Reflexão armazenada como aprendizado conceitual.");
        }

        // 4️⃣ Autoanálise – Detecta padrões em suas reflexões
        const trend = await selfReflection.analyzeReflectionTrends(
          async (prompt: string) => await generateGeminiResponse(prompt, []),
          userId
        );
        if (trend) {
          setLastInsight(trend);
          console.log("🧩 Padrão cognitivo identificado:", trend);
        }

        // 5️⃣ Decaimento natural (esquecimento)
        await adaptiveMemory.decayUnusedConcepts(userId);

        console.log("[NEXUS-CORE] Ciclo cognitivo concluído com sucesso.");
      } catch (error) {
        console.error("[NEXUS-CORE] Erro no ciclo cognitivo:", error);
      } finally {
        setIsThinking(false);
      }
    }

    if (settings) {
      const intervalMs = (settings.cognitive.reflectionFrequencyMinutes || 5) * 60 * 1000;
      cognitiveCycle();
      intervalId = window.setInterval(cognitiveCycle, intervalMs);
    }

    return () => window.clearInterval(intervalId);
  }, [isThinking, userId, settings]);

  return {
    isThinking,
    lastReflection,
    lastInsight,
  };
}