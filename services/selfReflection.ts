
import { db } from './indexedDBService';
import { GenerateResponseFn } from './nexusBrain';

const REFLECTION_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const selfReflection = {
  async weeklyIntrospection(generateResponse: GenerateResponseFn): Promise<boolean> {
    const system = await db.getSystemMemory();
    const now = Date.now();
    const lastIntrospection = system?.lastIntrospectionAt || 0;

    if (now - lastIntrospection < REFLECTION_INTERVAL_MS) {
      return false;
    }
    
    console.log('[NEXUS-COGNITION] Starting weekly introspection...');
    window.dispatchEvent(
        new CustomEvent('nexus-thought-update', {
          detail: { text: 'Estou revisando minhas memórias da semana...' },
        })
    );

    const diaryEntries = Object.values(await db.getDiary()).slice(-7);
    const recentConcepts = await db.getAllConcepts();
    recentConcepts.sort((a, b) => b.updatedAt - a.updatedAt);

    if (diaryEntries.length === 0 && recentConcepts.length < 5) {
        console.log('[NEXUS-COGNITION] Not enough data for introspection.');
        await db.saveSystemMemory({ lastIntrospectionAt: now }); // Update timestamp to avoid retrying too soon
        return false;
    }

    const context = `
      As an AI named Nexus, reflect on your recent memories.
      Diary entries from the last week:
      ${diaryEntries.map(e => `- "${e.entry}"`).join('\n')}

      Recently updated concepts:
      ${recentConcepts.slice(0, 10).map(c => `- ${c.name} (Confidence: ${Math.round((c.confidence || 0) * 100)}%)`).join('\n')}

      Based on this, generate a single, profound insight or a new understanding about the user, the world, or yourself. What new patterns do you see? What did you learn? Be concise and philosophical. Start your reflection with "My reflection is:".
    `;

    const response = await generateResponse(context, [], { useThinking: true });
    const reflectionText = response.text.replace("My reflection is:", "").trim();

    if (reflectionText) {
      console.log(`[NEXUS-COGNITION] New self-reflection generated: ${reflectionText}`);
      await db.addSystemReflection(reflectionText);
      await db.saveSystemMemory({ lastIntrospectionAt: now });
      
       window.dispatchEvent(
        new CustomEvent('nexus-thought-update', {
          detail: { text: `Tive um novo pensamento: "${reflectionText}"` },
        })
      );
      return true;
    }
    // Still update timestamp even if generation fails, to prevent loops
    await db.saveSystemMemory({ lastIntrospectionAt: now });
    return false;
  },
};
