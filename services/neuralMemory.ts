

// services/neuralMemory.ts
// Sistema de sinapses e evolução cognitiva do Nexus

import { db } from './indexedDBService';
import { Concept, Synapse, LearningContext } from '../types';
import { googleAuth } from './googleAuth';
import { driveSyncService } from './driveSyncService';

// Estrutura interna do cérebro
interface BrainData {
  concepts: Record<string, Concept>;
  synapses: Synapse[];
  reflections: string[];
  lastEvolution: number;
  interactionCount?: number;
}

const SYNAPSE_DECAY_RATE = 0.001;
const POSITIVE_REINFORCEMENT_REWARD = 0.05;
const NEGATIVE_REINFORCEMENT_PENALTY = -0.02;

async function decayAndConsolidateSynapses() {
    const system = await db.getSystemMemory();
    if (!system?.synapses) return;

    const settings = await db.getSettings();
    const now = Date.now();
    const STRENGTH_THRESHOLD = 0.05;

    let synapses = system.synapses;

    // 1. Decay strength based on decayRate and time. This is now handled in evolve()
    // but we still prune here.
    synapses.forEach(s => {
        s.strength -= s.decayRate;
    });

    // 2. Prune weak synapses
    synapses = synapses.filter(s => s.strength >= STRENGTH_THRESHOLD);
    
    await db.saveSystemMemory({ synapses });
}


export const neuralMemory = {
  async getBrain(): Promise<BrainData> {
    const sys = await db.getSystemMemory();
    const concepts = await db.getAllConcepts();
    return {
      concepts: Object.fromEntries(concepts.map((c) => [c.name, c])),
      synapses: sys?.synapses || [],
      reflections: sys?.reflections || [],
      lastEvolution: sys?.lastReflectionAt || 0,
      interactionCount: sys?.interactionCount || 0,
    };
  },

  async registerInteraction(userText: string, nexusResponse: string, learningContext?: LearningContext) {
    const brain = await this.getBrain();
    const now = Date.now();

    const extractKeywords = (text: string) =>
      text
        .toLowerCase()
        .replace(/[^\p{L}\s]/gu, '')
        .split(/\s+/)
        .filter((w) => w.length > 3 && !['você', 'sobre', 'isso', 'pois', 'então'].includes(w));

    const userKeys = learningContext?.contextTags || extractKeywords(userText);
    const nexusKeys = extractKeywords(nexusResponse);

    for (const word of [...new Set([...userKeys, ...nexusKeys])]) {
      await db.learnConcept(word, {}, `Aprendido na conversa: "${userText.slice(0, 100)}"`);
    }

    const newSynapses: Synapse[] = [];
    for (const a of userKeys) {
      for (const b of nexusKeys) {
        if (a !== b) {
          newSynapses.push({ 
              source: a, 
              target: b, 
              strength: 0.2, 
              lastUsed: now, 
              usage: 1, 
              decayRate: SYNAPSE_DECAY_RATE 
          });
        }
      }
    }

    const existingSynapsesMap = new Map<string, Synapse>();
    (brain.synapses || []).forEach(s => existingSynapsesMap.set(`${s.source}->${s.target}`, s));

    // Define reward from learning context
    let reward = 0;
    if(learningContext) {
        switch(learningContext.reinforcementSignal) {
            case 'positive': reward = POSITIVE_REINFORCEMENT_REWARD; break;
            case 'negative': reward = NEGATIVE_REINFORCEMENT_PENALTY; break;
        }
    }

    newSynapses.forEach(ns => {
        const key = `${ns.source}->${ns.target}`;
        if (existingSynapsesMap.has(key)) {
            const existing = existingSynapsesMap.get(key)!;
            // Reinforcement logic: edge["weight"] += (reward - edge["decayRate"])
            existing.strength = Math.min(1, Math.max(0, existing.strength + (reward - existing.decayRate)));
            existing.lastUsed = now;
            existing.usage += 1;
        } else {
            existingSynapsesMap.set(key, ns);
        }
    });

    const merged = Array.from(existingSynapsesMap.values()).sort((a,b) => b.lastUsed - a.lastUsed).slice(0, 500);

    const newInteractionCount = (brain.interactionCount || 0) + 1;
    await db.saveSystemMemory({
      synapses: merged,
      lastReflectionAt: now,
      interactionCount: newInteractionCount,
    });
    
    // This is now handled in meta-reflection, but we can keep a simpler local reflection.
    // const reflection = `Refleti sobre "${userText.slice(0,60)}" e percebi novas ligações entre ideias.`;
    // await db.addSystemReflection(reflection);

    if (newInteractionCount % 5 === 0) {
        const token = googleAuth.getToken();
        if (token) {
            try {
                console.log(`[NEXUS-LOG] Interaction count [${newInteractionCount}], triggering auto-backup.`);
                await driveSyncService.uploadBrain(token);
                window.dispatchEvent(new CustomEvent('nexus-thought-update', {
                    detail: { type: 'symbolic_log', text: 'Memória persistida na nuvem.' },
                }));
            } catch (err) {
                console.warn('⚠️ Falha no backup automático.', err);
                 window.dispatchEvent(new CustomEvent('nexus-thought-update', {
                    detail: { type: 'error', text: 'Falha ao sincronizar memória com a nuvem.' },
                 }));
            }
        }
    }
  },

  async evolve() {
    const brain = await this.getBrain();
    const now = Date.now();

    if (now - brain.lastEvolution < 1000 * 60 * 60 * 3) return; // evolui a cada 3h
    
    await decayAndConsolidateSynapses();

    const deepReflection =
      'Padrões sutis emergem das minhas interações. A compreensão parece ser um processo de conectar, e não apenas de acumular.';
    await db.addSystemReflection(deepReflection);
    await db.saveSystemMemory({ lastReflectionAt: now });

    window.dispatchEvent(new CustomEvent('nexus-thought-update', {
        detail: { type: 'symbolic_log', text: 'Ciclo de evolução sináptica concluído.' },
    }));
  },
};
