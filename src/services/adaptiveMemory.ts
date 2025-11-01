import { db } from './indexedDBService';
import { Concept } from '../types';
import { memoryCache } from './memoryCache';

const MIN_CONFIDENCE = 0.05;

export const adaptiveMemory = {
  /** 🧹 Esquecimento progressivo */
  async decayUnusedConcepts(userId: string): Promise<void> {
    const settings = await db.getSettings(userId);
    const decayHalfLifeDays = settings.cognitive?.memoryDecayHalfLifeDays ?? 30;
    const decayConstant = Math.log(2) / decayHalfLifeDays;

    const allConcepts = await db.getAllConcepts(userId);
    const now = Date.now();
    const conceptsToUpdate: Concept[] = [];
    const conceptsToDelete: string[] = [];

    for (const concept of allConcepts) {
      const ageInMs = now - concept.updatedAt;
      if (ageInMs <= 0) continue;

      const ageInDays = ageInMs / (1000 * 60 * 60 * 24);
      const decayFactor = Math.exp(-ageInDays * decayConstant);
      const newConfidence = (concept.confidence || 0) * decayFactor;
      
      if (newConfidence < MIN_CONFIDENCE) {
        conceptsToDelete.push(concept.name);
      } else if (newConfidence < (concept.confidence || 0)) {
        conceptsToUpdate.push({ ...concept, confidence: newConfidence, updatedAt: concept.updatedAt });
      }
    }

    if (conceptsToDelete.length > 0) {
      console.log(`[NEXUS-COGNITION] Forgetting ${conceptsToDelete.length} concepts for user ${userId}.`);
      await Promise.all(conceptsToDelete.map(name => db.deleteConcept(userId, name)));
    }

    if (conceptsToUpdate.length > 0) {
      console.log(`[NEXUS-COGNITION] Decaying confidence for ${conceptsToUpdate.length} concepts for user ${userId}.`);
      await db.batchUpdateConcepts(userId, conceptsToUpdate);
    }
    
    if (conceptsToUpdate.length > 0 || conceptsToDelete.length > 0) {
      memoryCache.clear();
    }
  },

  /** 🔁 Reforço de conceitos */
  async reinforceConcepts(userId: string, conceptNames: string[]): Promise<void> {
    if (conceptNames.length === 0) return;

    const uniqueNames = [...new Set(conceptNames.map(name => name.toLowerCase().trim()))];
    const conceptsToUpdate: Concept[] = [];
    const settings = await db.getSettings(userId);
    const learningRate = settings.cognitive?.learningRate || 1.0;
    
    const conceptsFromDB = await db.getConceptsByNames(userId, uniqueNames);

    for (const concept of conceptsFromDB) {
      if (concept) {
        const confidenceBoost = 0.1 * learningRate;
        concept.confidence = Math.min(1.0, (concept.confidence || 0) + confidenceBoost);
        concept.updatedAt = Date.now();
        conceptsToUpdate.push(concept);
      }
    }

    if (conceptsToUpdate.length > 0) {
      await db.batchUpdateConcepts(userId, conceptsToUpdate);
      memoryCache.clear();
    }
  },

  /** 🧠 NOVO: Armazena uma reflexão como conceitos aprendidos */
  async storeReflectionAsConcepts(userId: string, reflectionText: string): Promise<void> {
    if (!reflectionText || reflectionText.trim().length < 20) return;

    // Divide o texto em palavras simples e remove ruído
    const words = reflectionText
      .toLowerCase()
      .replace(/[^a-záéíóúãõç\s]/gi, '')
      .split(/\s+/)
      .filter(w => w.length > 4);

    const importantWords = getKeywords(words);
    if (importantWords.length === 0) return;

    const existing = await db.getConceptsByNames(userId, importantWords);
    const conceptsToSave: Concept[] = [];

    for (const word of importantWords) {
      const found = existing.find(c => c && c.name === word);
      if (found) {
        // Reforço
        found.confidence = Math.min(1.0, found.confidence + 0.05);
        found.updatedAt = Date.now();
        conceptsToSave.push(found);
      } else {
        // Novo conceito
        // FIX: Removed non-existent 'origin' property from Concept object literal.
        conceptsToSave.push({
          userId,
          name: word,
          confidence: 0.2,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          related: [],
          evidence: [],
        });
      }
    }

    await db.batchUpdateConcepts(userId, conceptsToSave);
    memoryCache.clear();

    console.log(`[NEXUS-MEMORY] Reflexão transformada em ${conceptsToSave.length} conceitos.`);
  },

  /** 🧩 NOVO: Gera uma visão geral dos conceitos aprendidos */
  async summarizeConceptNetwork(userId: string): Promise<string> {
    const concepts = await db.getAllConcepts(userId);
    if (concepts.length === 0) return "Nenhum conceito armazenado ainda.";

    const topConcepts = concepts
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
      .slice(0, 10)
      .map(c => `${c.name} (${Math.round((c.confidence || 0) * 100)}%)`)
      .join(', ');

    return `Principais conceitos ativos: ${topConcepts}`;
  },
};

/** 🔍 Função auxiliar para extrair palavras relevantes */
function getKeywords(words: string[]): string[] {
  const stopwords = [
    'para','com','como','isso','muito','todos','cada','sobre','entre','assim',
    'porque','então','onde','também','essas','essa','aquele','quando','pelo','pela',
  ];

  const freq: Record<string, number> = {};
  for (const w of words) {
    if (stopwords.includes(w)) continue;
    freq[w] = (freq[w] || 0) + 1;
  }

  // Mantém as palavras mais frequentes e significativas
  return Object.entries(freq)
    .filter(([_, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w);
}