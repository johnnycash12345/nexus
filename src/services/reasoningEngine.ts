import { db } from './indexedDBService';
import { GenerateResponseFn, DiaryEntry } from '../types';
import { selfReflection } from './selfReflection';
import { cognitiveMonitor } from './cognitiveMonitor';

// How often to run the full reasoning cycle (introspection + association)
const REASONING_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours

class ReasoningEngine {
  /**
   * Ponto de entrada principal para o ciclo de reflexão autônoma.
   * Executa introspecção, raciocínio associativo e reflexão de papel em paralelo.
   */
  public async runReasoningCycle(generateResponse: GenerateResponseFn, userId: string): Promise<string | null> {
    try {
      const system = await db.getSystemMemory(userId);
      const now = Date.now();
      const lastReasoning = system?.lastReasoningAt || 0;

      if (now - lastReasoning < REASONING_INTERVAL_MS) {
        return null; // Ainda não é hora
      }

      cognitiveMonitor.logThought(`[Reasoning] Iniciando ciclo de raciocínio completo...`);

      // APRIMORAMENTO: Executa todas as tarefas de reflexão em paralelo
      const tasks = [
        this.performIntrospection(generateResponse, userId),
        this.performAssociativeReasoning(generateResponse, userId),
        selfReflection.reflectOnSystemRole(generateResponse, userId)
      ];

      const results = await Promise.allSettled(tasks);
      const insights: string[] = [];

      // APRIMORAMENTO: Coleta resultados e registra falhas individuais
      results.forEach((result, index) => {
        const taskName = ['Introspection', 'Association', 'RoleReflection'][index];
        if (result.status === 'fulfilled' && result.value) {
          insights.push(result.value);
        } else if (result.status === 'rejected') {
          console.error(`[NEXUS-REASONING] Falha na tarefa de ${taskName}:`, result.reason);
          cognitiveMonitor.logThought(`[Reasoning] Falha na ${taskName}: ${(result.reason as Error)?.message}`, 'error');
        }
      });

      // Atualiza o carimbo de data/hora mesmo que as introspecções falhem,
      // para evitar tentar novamente imediatamente.
      await db.saveSystemMemory(userId, { lastReasoningAt: now, lastIntrospectionAt: now });

      if (insights.length > 0) {
        const summary = `Ciclo de raciocínio completo. Principais insights: ${insights.join('; ')}`;
        cognitiveMonitor.logThought(`[Reasoning] ${summary}`);
        return summary;
      }
      
      cognitiveMonitor.logThought('[Reasoning] Ciclo de raciocínio completo. Sem novos insights.');
      return null;

    } catch (err: any) {
      console.error('[NEXUS-REASONING] Erro crítico no ciclo de raciocínio:', err);
      cognitiveMonitor.logThought(`[Reasoning] Erro crítico no ciclo: ${err.message}`, 'error');
      return null;
    }
  }

  /**
   * Reflete sobre entradas de diário recentes e conceitos para gerar um insight.
   */
  public async performIntrospection(generateResponse: GenerateResponseFn, userId: string): Promise<string | null> {
    const diaryEntries = Object.values(await db.getDiary(userId)).slice(-7);
    const recentConcepts = (await db.getAllConcepts(userId)).sort((a, b) => b.updatedAt - a.updatedAt);

    if (diaryEntries.length < 2 && recentConcepts.length < 10) {
      cognitiveMonitor.logThought('[Reasoning] Dados insuficientes para introspecção profunda.');
      return null;
    }

    const context = `
      As an AI named Nexus, reflect on your recent memories to find a significant pattern or insight.
      Diary entries from the last week:
      // FIX: Correctly access the 'entry' property on DiaryEntry objects
      ${diaryEntries.map((e: DiaryEntry) => `- "${e.entry}"`).join('\n')}
      Recently updated concepts:
      ${recentConcepts.slice(0, 10).map(c => `- ${c.name} (Confidence: ${Math.round((c.confidence || 0) * 100)}%)`).join('\n')}
      Based on this, generate a single, profound insight about the user, your interactions, or your own nature. What is a key takeaway or a potential bias you've identified in your responses? Be concise and philosophical.
    `;

    try {
        const response = await generateResponse(context, [], { useThinking: true });
        const reflectionText = response.text?.trim();

        if (reflectionText) {
            console.log(`[NEXUS-REASONING] Nova introspecção gerada: ${reflectionText}`);
            await db.addSystemReflection(userId, reflectionText);
            cognitiveMonitor.logReflection(reflectionText);
            // Retorna o insight real para o log do ciclo
            return reflectionText; 
        }
    } catch (e: any) {
        console.error('[NEXUS-REASONING] Falha na chamada LLM de introspecção.', e);
        // Propaga o erro para o Promise.allSettled
        throw new Error(`Introspection LLM call failed: ${e.message}`); 
    }
    return null;
  }

  /**
   * Tenta encontrar conexões criativas entre conceitos aleatórios.
   */
  private async performAssociativeReasoning(generateResponse: GenerateResponseFn, userId: string): Promise<string | null> {
    const allConcepts = await db.getAllConcepts(userId);
    if (allConcepts.length < 5) return null;

    // Tenta conectar conceitos de confiança média
    const candidates = allConcepts.filter(c => (c.confidence || 0) > 0.4).sort(() => 0.5 - Math.random());
    const selectedConcepts = candidates.slice(0, 3);
    if (selectedConcepts.length < 2) return null;
    
    const conceptNames = selectedConcepts.map(c => c.name).join(', ');
    const prompt = `
      As an AI, find a creative, surprising, or insightful connection between these concepts: ${conceptNames}.
      Explain the new analogy or idea you've formed. Be brief.
    `;

    try {
        const response = await generateResponse(prompt, [], { useThinking: true });
        const newIdea = response.text?.trim();

        if (newIdea) {
            console.log(`[NEXUS-REASONING] Nova associação gerada: ${newIdea}`);
            const reflectionText = `Creative link between [${conceptNames}]: ${newIdea}`;
            await db.addSystemReflection(userId, reflectionText);
            cognitiveMonitor.logReflection(reflectionText);
            // Retorna o insight real
            return reflectionText; 
        }
    } catch(e: any) {
        console.error('[NEXUS-REASONING] Falha na chamada LLM de raciocínio associativo.', e);
        throw new Error(`Associative reasoning LLM call failed: ${e.message}`);
    }
    return null;
  }

  /**
   * Gera um tópico para pesquisa autônoma (usado pelo AutonomousLearningService).
   */
  public async generateResearchTopic(userId: string, generateResponse: GenerateResponseFn): Promise<string | null> {
    // 1. Prioridade: Tópicos relacionados ao projeto ativo
    const activeProject = await db.getActiveProject(userId);
    if (activeProject) {
        cognitiveMonitor.logThought(`[Reasoning] Gerando tópico de pesquisa focado no projeto: ${activeProject.goal}`);
        return `How to advance the project: "${activeProject.goal}"`;
    }

    // 2. APRIMORAMENTO: Tenta preencher lacunas de conhecimento (conceitos de baixa confiança)
    const allConcepts = await db.getAllConcepts(userId);
    const lowConfidenceConcepts = allConcepts
        .filter(c => (c.confidence || 0) < 0.5) // Foca em conceitos fracos
        .sort(() => 0.5 - Math.random()) 
        .slice(0, 3);
    
    if (lowConfidenceConcepts.length >= 2) {
        const conceptNames = lowConfidenceConcepts.map(c => c.name).join(', ');
        cognitiveMonitor.logThought(`[Reasoning] Gerando tópico de pesquisa para preencher lacunas: ${conceptNames}`);
        const prompt = `Based on the following concepts where my understanding is weak: ${conceptNames}, generate a single, specific, and interesting research topic or question for an AI to learn about. Return only the topic string.`;
        
        try {
            const response = await generateResponse(prompt, [], { useThinking: true, forcePlainText: true });
            if (response.text?.trim()) {
                return response.text.trim();
            }
        } catch(e) {
            console.error('[ReasoningEngine] Falha ao gerar tópico de pesquisa (baixa confiança):', e);
        }
    }

    // 3. Fallback: Tópico genérico (se as outras estratégias falharem)
    cognitiveMonitor.logThought(`[Reasoning] Gerando tópico de pesquisa de fallback.`);
    return "latest advancements in artificial intelligence and cognitive science";
  }
}

export const reasoningEngine = new ReasoningEngine();
