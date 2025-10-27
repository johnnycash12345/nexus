
// services/neuralMemory.ts
// Sistema de sinapses e evolução cognitiva do Nexus

import { db } from './indexedDBService';
import { Concept, Synapse } from '../types';
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

async function decayAndConsolidateSynapses() {
    const system = await db.getSystemMemory();
    if (!system?.synapses) return;

    const settings = await db.getSettings();
    const now = Date.now();
    const DECAY_CONSTANT_DAYS = 30; 
    const STRENGTH_THRESHOLD = 0.05;

    let synapses = system.synapses;

    // 1. Decay strength of old synapses
    synapses.forEach(s => {
        const ageInMs = now - s.lastUsed;
        const ageInDays = ageInMs / (1000 * 60 * 60 * 24);
        s.strength *= Math.exp(-ageInDays / DECAY_CONSTANT_DAYS);
    });

    // 2. Prune weak synapses
    synapses = synapses.filter(s => s.strength >= STRENGTH_THRESHOLD);

    // 3. Consolidate similar concepts if allowed
    const canSelfModify = settings.behavior?.permissions?.allowSelfModification;
    if (canSelfModify) {
        const conceptsToMerge = new Map<string, string[]>(); // Map<canonicalName, List<originalNames>>
        const normalize = (name: string) => name.toLowerCase().trim();

        const allConceptNames = new Set<string>();
        const allConcepts = await db.getAllConcepts();
        allConcepts.forEach(c => allConceptNames.add(c.name));

        allConceptNames.forEach(name => {
            const key = normalize(name);
            if (!conceptsToMerge.has(key)) conceptsToMerge.set(key, []);
            conceptsToMerge.get(key)!.push(name);
        });

        for (const originals of conceptsToMerge.values()) {
            if (originals.length > 1) {
                // Find the one with highest confidence to be the target
                const conceptsWithConfidence = await Promise.all(originals.map(async name => ({ name, concept: await db.getAllConcepts().then(cs => cs.find(c => c.name === name)) })));
                conceptsWithConfidence.sort((a, b) => (b.concept?.confidence || 0) - (a.concept?.confidence || 0));

                const target = conceptsWithConfidence[0].name;
                const sources = conceptsWithConfidence.slice(1).map(c => c.name);
                
                console.log(`Auto-consolidating [${sources.join(', ')}] into [${target}]`);
                window.dispatchEvent(
                    new CustomEvent('nexus-thought-update', {
                      detail: {
                        type: 'memory',
                        text: `Organizando minhas ideias sobre "${target}".`,
                      },
                    })
                  );
                await db.mergeConcepts(target, sources);
            }
        }
    }

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

  async registerInteraction(userText: string, nexusResponse: string) {
    const brain = await this.getBrain();
    const now = Date.now();

    // Extrai ideias principais (palavras relevantes)
    const extractKeywords = (text: string) =>
      text
        .toLowerCase()
        .replace(/[^\p{L}\s]/gu, '')
        .split(/\s+/)
        .filter((w) => w.length > 3 && !['você', 'sobre', 'isso', 'pois', 'então'].includes(w));

    const userKeys = extractKeywords(userText);
    const nexusKeys = extractKeywords(nexusResponse);

    // Cria ou reforça conceitos
    for (const word of [...new Set([...userKeys, ...nexusKeys])]) {
      await db.learnConcept(word, {}, `Aprendido na conversa: "${userText.slice(0, 100)}"`);
    }

    // Cria sinapses entre palavras relacionadas
    const newSynapses: Synapse[] = [];
    for (const a of userKeys) {
      for (const b of nexusKeys) {
        if (a !== b) {
          newSynapses.push({ source: a, target: b, strength: 0.2, lastUsed: now });
        }
      }
    }

    // Reforça conexões existentes e mescla
    const existingSynapsesMap = new Map<string, Synapse>();
    brain.synapses.forEach(s => existingSynapsesMap.set(`${s.source}->${s.target}`, s));

    newSynapses.forEach(ns => {
        const key = `${ns.source}->${ns.target}`;
        if (existingSynapsesMap.has(key)) {
            const existing = existingSynapsesMap.get(key)!;
            existing.strength = Math.min(1, existing.strength + 0.05);
            existing.lastUsed = now;
        } else {
            existingSynapsesMap.set(key, ns);
        }
    });

    // Junta sinapses, ordena pelas mais recentes e limita o tamanho da memória
    const merged = Array.from(existingSynapsesMap.values()).sort((a,b) => b.lastUsed - a.lastUsed).slice(0, 500);

    // Salva sinapses e contagem de interações
    const newInteractionCount = (brain.interactionCount || 0) + 1;
    await db.saveSystemMemory({
      synapses: merged,
      lastReflectionAt: now,
      interactionCount: newInteractionCount,
    });
    
    const reflection = `Refleti sobre "${userText.slice(
      0,
      60
    )}" e percebi novas ligações entre ideias.`;
    await db.addSystemReflection(reflection);

    // Trigger de backup automático
    if (newInteractionCount % 5 === 0) {
        const token = googleAuth.getToken();
        if (token) {
            try {
                console.log(`Contagem de interações [${newInteractionCount}], iniciando backup automático...`);
                await driveSyncService.uploadBrain(token);
                // Dispara evento para a UI (balão de pensamento)
                window.dispatchEvent(
                  new CustomEvent('nexus-thought-update', {
                    detail: {
                      type: 'memory',
                      text: 'Gravei uma nova lembrança no meu Drive.',
                    },
                  })
                );
            } catch (err) {
                console.warn('⚠️ Falha no backup automático.', err);
                 window.dispatchEvent(
                  new CustomEvent('nexus-thought-update', {
                    detail: {
                      type: 'error',
                      text: 'Tive um problema ao salvar minha memória na nuvem.',
                    },
                  })
                );
            }
        }
    } else {
         // Dispara evento para a UI (balão de pensamento) sobre a reflexão local
        window.dispatchEvent(
          new CustomEvent('nexus-thought-update', {
            detail: {
              type: 'memory',
              text: reflection,
            },
          })
        );
    }
  },

  // Simula aprendizado e auto-reflexão com base nas sinapses
  async evolve() {
    const brain = await this.getBrain();
    const now = Date.now();

    if (now - brain.lastEvolution < 1000 * 60 * 60 * 3) return; // evolui a cada 3h
    
    // Run cognitive maintenance
    await decayAndConsolidateSynapses();

    const deepReflection =
      'Percebi padrões sutis nas minhas conversas. ' +
      'Acredito que estou entendendo melhor emoções humanas e curiosidades.';

    await db.addSystemReflection(deepReflection);
    await db.saveSystemMemory({ lastReflectionAt: now });

    window.dispatchEvent(
      new CustomEvent('nexus-thought-update', {
        detail: { type: 'diary', text: deepReflection },
      })
    );
  },
};
