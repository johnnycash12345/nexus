
import { db } from './indexedDBService';
import { GenerateResponseFn } from './nexusBrain';

const REASONING_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1 day

export const associativeReasoner = {
  async crossConcepts(generateResponse: GenerateResponseFn): Promise<boolean> {
    const system = await db.getSystemMemory();
    const now = Date.now();
    const lastReasoning = system?.lastReasoningAt || 0;

    if (now - lastReasoning < REASONING_INTERVAL_MS) {
        return false;
    }

    const allConcepts = await db.getAllConcepts();
    if (allConcepts.length < 5) {
        await db.saveSystemMemory({ lastReasoningAt: now });
        return false;
    };

    console.log('[NEXUS-COGNITION] Starting associative reasoning...');
    window.dispatchEvent(
        new CustomEvent('nexus-thought-update', {
          detail: { text: 'Tentando criar novas conexões entre ideias...' },
        })
    );

    // Select 3 random but reasonably confident concepts
    const candidates = allConcepts.filter(c => (c.confidence || 0) > 0.4).sort(() => 0.5 - Math.random());
    const selectedConcepts = candidates.slice(0, 3);

    if (selectedConcepts.length < 2) {
        await db.saveSystemMemory({ lastReasoningAt: now });
        return false
    };

    const conceptNames = selectedConcepts.map(c => c.name).join(', ');

    const prompt = `
      As an AI named Nexus, find a creative, surprising, or insightful connection between the following concepts: ${conceptNames}.
      Explain the new idea or analogy you've formed. Be brief and start your idea with "A new idea is:".
    `;

    const response = await generateResponse(prompt, [], { useThinking: true });
    const newIdea = response.text.replace("A new idea is:", "").trim();

    if (newIdea) {
      console.log(`[NEXUS-COGNITION] New association generated: ${newIdea}`);
      const reflectionText = `Creative link between [${conceptNames}]: ${newIdea}`;
      await db.addSystemReflection(reflectionText);
      await db.saveSystemMemory({ lastReasoningAt: now });

      window.dispatchEvent(
        new CustomEvent('nexus-thought-update', {
          detail: { text: `Pensei em algo novo conectando ${conceptNames}.` },
        })
      );
      return true;
    }
    
    await db.saveSystemMemory({ lastReasoningAt: now });
    return false;
  },
};
