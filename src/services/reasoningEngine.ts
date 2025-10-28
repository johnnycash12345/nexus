import { db } from './indexedDBService';
import { GenerateResponseFn } from '@/types';
import { selfReflection } from './selfReflection';

// How often to run the full reasoning cycle (introspection + association)
const REASONING_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours

class ReasoningEngine {
  public async runReasoningCycle(generateResponse: GenerateResponseFn, userId: string): Promise<string | null> {
    const system = await db.getSystemMemory(userId);
    const now = Date.now();
    const lastReasoning = system?.lastReasoningAt || 0;

    if (now - lastReasoning < REASONING_INTERVAL_MS) {
      return null; // Not time yet
    }

    console.log(`[NEXUS-REASONING] Starting full reasoning cycle for user ${userId}...`);
    let insights: string[] = [];

    const introspectionInsight = await this.performIntrospection(generateResponse, userId);
    if (introspectionInsight) insights.push(introspectionInsight);

    const associationInsight = await this.performAssociativeReasoning(generateResponse, userId);
    if (associationInsight) insights.push(associationInsight);

    const roleReflectionInsight = await selfReflection.reflectOnSystemRole(generateResponse, userId);
    if (roleReflectionInsight) insights.push(roleReflectionInsight);
    
    await db.saveSystemMemory(userId, { lastReasoningAt: now, lastIntrospectionAt: now });

    if (insights.length > 0) {
      const summary = `Reasoning cycle complete. Key insights: ${insights.join('; ')}`;
      console.log(`[NEXUS-REASONING] ${summary}`);
      return summary;
    }
    
    console.log('[NEXUS-REASONING] Reasoning cycle complete. No new major insights generated.');
    return null;
  }

  private async performIntrospection(generateResponse: GenerateResponseFn, userId: string): Promise<string | null> {
    const diaryEntries = Object.values(await db.getDiary(userId)).slice(-7);
    const recentConcepts = (await db.getAllConcepts(userId)).sort((a, b) => b.updatedAt - a.updatedAt);

    if (diaryEntries.length < 2 && recentConcepts.length < 10) {
      console.log('[NEXUS-REASONING] Not enough data for deep introspection.');
      return null;
    }

    const context = `
      As an AI named Nexus, reflect on your recent memories to find a significant pattern or insight.
      Diary entries from the last week:
      ${diaryEntries.map(e => `- "${e.entry}"`).join('\n')}
      Recently updated concepts:
      ${recentConcepts.slice(0, 10).map(c => `- ${c.name} (Confidence: ${Math.round((c.confidence || 0) * 100)}%)`).join('\n')}
      Based on this, generate a single, profound insight about the user, your interactions, or your own nature. What is a key takeaway or a potential bias you've identified in your responses? Be concise and philosophical.
    `;

    try {
        const response = await generateResponse(context, [], { useThinking: true });
        const reflectionText = response.text?.trim();

        if (reflectionText) {
            console.log(`[NEXUS-REASONING] New introspection generated: ${reflectionText}`);
            await db.addSystemReflection(userId, reflectionText);
            return `Introspection yielded: "${reflectionText.slice(0, 80)}..."`;
        }
    } catch (e) {
        console.error('[NEXUS-REASONING] Introspection LLM call failed.', e);
    }
    return null;
  }

  private async performAssociativeReasoning(generateResponse: GenerateResponseFn, userId: string): Promise<string | null> {
    const allConcepts = await db.getAllConcepts(userId);
    if (allConcepts.length < 5) return null;

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
            console.log(`[NEXUS-REASONING] New association generated: ${newIdea}`);
            const reflectionText = `Creative link between [${conceptNames}]: ${newIdea}`;
            await db.addSystemReflection(userId, reflectionText);
            return `New association created between ${conceptNames}.`;
        }
    } catch(e) {
        console.error('[NEXUS-REASONING] Associative reasoning LLM call failed.', e);
    }
    return null;
  }
}

export const reasoningEngine = new ReasoningEngine();
