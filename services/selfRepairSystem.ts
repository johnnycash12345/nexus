

import { generateGeminiResponse } from './geminiService';
import { db } from './indexedDBService';

export const selfRepairSystem = {
  async monitorErrors(errorLog: string): Promise<string> {
    try {
        const analysis = await generateGeminiResponse(
            `Analise o seguinte erro de JavaScript em uma aplicação React/TypeScript e descreva em português uma possível causa e uma sugestão de correção segura. Não gere o código corrigido, apenas a explicação.\n\nErro: "${errorLog}"`,
            [] // No history needed for this specific task
        );
        const fixSuggestion = analysis.text;

        // Log the event to Nexus's internal memory
        const reflection = `Tentei diagnosticar um erro do sistema: "${errorLog}". Sugestão de correção: ${fixSuggestion}`;
        await db.addSystemReflection('paulo-creator-001', reflection);

        // Also dispatch a thought event for the UI
        window.dispatchEvent(
            new CustomEvent('nexus-thought-update', {
              detail: {
                text: `Detectei uma anomalia... analisando a causa.`,
              },
            })
        );
        
        return fixSuggestion;

    } catch (e) {
        console.error("Self-repair system failed to analyze error:", e);
        return "Não foi possível analisar o erro.";
    }
  },

  autoHealOnCrash(): void {
    // Ensure the listener is only added once.
    if ((window as any)._nexusErrorHandler) {
        return;
    }

    const handleError = async (e: ErrorEvent) => {
        // Avoid self-repair loops from errors within the repair system itself
        if (e.message.includes('Self-repair system failed')) return;

        console.error("Erro global detectado pelo Nexus:", e.message, e.filename, e.lineno);
        const fix = await this.monitorErrors(e.message);
        console.warn("🩹 Sugestão de Autocorreção do Nexus:", fix);
    };

    window.addEventListener("error", handleError);
    (window as any)._nexusErrorHandler = handleError; // Mark as installed
  },
};
