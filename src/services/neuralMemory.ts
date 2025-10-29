import { db } from './indexedDBService';
import { Synapse, LearningContext } from '@/types';

export const neuralMemory = {
  async decayAndConsolidateSynapses(userId: string): Promise<void> {
    const system = await db.getSystemMemory(userId);
    if (!system?.synapses) return;

    const STRENGTH_THRESHOLD = 0.05;
    let synapses = system.synapses.filter(s => s.strength >= STRENGTH_THRESHOLD);

    if (synapses.length < system.synapses.length) {
      console.log(`[NEXUS-NEURAL] Pruned weak synapses for user ${userId}.`);
      await db.saveSystemMemory(userId, { synapses });
    }
  },
  
  async addSynapses(userId: string, newSynapses: { source: string; target: string; strength: number }[]): Promise<void> {
    if (newSynapses.length === 0) return;

    const system = await db.getSystemMemory(userId);
    const existingSynapses = system.synapses || [];
    const synapseMap = new Map<string, Synapse>();
    existingSynapses.forEach(s => synapseMap.set(`${s.source}->${s.target}`, s));

    const now = Date.now();
    for (const ns of newSynapses) {
        const key = `${ns.source.toLowerCase().trim()}->${ns.target.toLowerCase().trim()}`;
        const existing = synapseMap.get(key);
        if (existing) {
            existing.strength = Math.min(1.0, existing.strength + ns.strength);
            existing.lastUsed = now;
            existing.usage += 1;
        } else {
            synapseMap.set(key, { ...ns, lastUsed: now, usage: 1, decayRate: 0.001, createdAt: now });
        }
    }

    const updatedSynapses = Array.from(synapseMap.values());
    await db.saveSystemMemory(userId, { synapses: updatedSynapses });
  },

  async createSynapses(userId: string, sourceKeys: string[], targetKeys: string[], strength: number = 0.1) {
    const system = await db.getSystemMemory(userId);
    const now = Date.now();
    const existingSynapsesMap = new Map<string, Synapse>();
    (system.synapses || []).forEach(s => existingSynapsesMap.set(`${s.source}->${s.target}`, s));

    for (const a of [...new Set(sourceKeys)]) {
      for (const b of [...new Set(targetKeys)]) {
        if (a === b) continue;
        const key = `${a}->${b}`;
        if (existingSynapsesMap.has(key)) {
          const existing = existingSynapsesMap.get(key)!;
          existing.strength = Math.min(1, existing.strength + strength);
          existing.lastUsed = now;
          existing.usage += 1;
        } else {
          existingSynapsesMap.set(key, { source: a, target: b, strength, lastUsed: now, usage: 1, decayRate: 0.001, createdAt: now });
        }
      }
    }
    await db.saveSystemMemory(userId, { synapses: Array.from(existingSynapsesMap.values()) });
  },

  async registerInteraction(userId: string, userText: string, nexusResponse: string, learningContext: LearningContext) {
    const POSITIVE_REINFORCEMENT_REWARD = 0.05;
    const NEGATIVE_REINFORCEMENT_PENALTY = -0.02;

    const system = await db.getSystemMemory(userId);
    const now = Date.now();

    const keywords = learningContext.contextTags;
    for (const word of keywords) {
      await db.learnConcept(userId, word, {}, `Aprendido na conversa: "${userText.slice(0, 100)}"`);
    }

    let reward = 0;
    if(learningContext.reinforcementSignal === 'positive') reward = POSITIVE_REINFORCEMENT_REWARD;
    if(learningContext.reinforcementSignal === 'negative') reward = NEGATIVE_REINFORCEMENT_PENALTY;

    const existingSynapsesMap = new Map<string, Synapse>();
    (system.synapses || []).forEach(s => existingSynapsesMap.set(`${s.source}->${s.target}`, s));

    keywords.forEach(source => {
        keywords.forEach(target => {
            if(source === target) return;
            const key = `${source}->${target}`;
            const existing = existingSynapsesMap.get(key);
            if(existing) {
                existing.strength = Math.min(1, Math.max(0, existing.strength + reward - existing.decayRate));
                existing.lastUsed = now;
                existing.usage++;
            } else {
                existingSynapsesMap.set(key, {source, target, strength: 0.1 + reward, lastUsed: now, usage: 1, decayRate: 0.001, createdAt: now});
            }
        });
    });
    
    const newInteractionCount = (system.interactionCount || 0) + 1;
    await db.saveSystemMemory(userId, {
      synapses: Array.from(existingSynapsesMap.values()),
      lastReflectionAt: now,
      interactionCount: newInteractionCount,
    });
  },
};
