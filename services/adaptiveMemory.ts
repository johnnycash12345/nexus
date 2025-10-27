
import { db } from './indexedDBService';
import { Concept } from '../types';
import { memoryCache } from './memoryCache';

const DECAY_HALF_LIFE_DAYS = 30; // Time for confidence to halve
const DECAY_CONSTANT = Math.log(2) / DECAY_HALF_LIFE_DAYS;
const MIN_CONFIDENCE = 0.05;

export const adaptiveMemory = {
  async decayUnusedConcepts(): Promise<void> {
    const allConcepts = await db.getAllConcepts();
    const now = Date.now();
    const conceptsToUpdate: Concept[] = [];
    const conceptsToDelete: string[] = [];

    for (const concept of allConcepts) {
      const ageInMs = now - concept.updatedAt;
      if (ageInMs <= 0) continue;

      const ageInDays = ageInMs / (1000 * 60 * 60 * 24);
      const decayFactor = Math.exp(-ageInDays * DECAY_CONSTANT);
      const newConfidence = (concept.confidence || 0) * decayFactor;
      
      if (newConfidence < MIN_CONFIDENCE) {
        conceptsToDelete.push(concept.name);
      } else if (newConfidence < (concept.confidence || 0)) {
        conceptsToUpdate.push({ ...concept, confidence: newConfidence, updatedAt: concept.updatedAt }); // keep original update time for decay calc
      }
    }

    if (conceptsToDelete.length > 0) {
      console.log(`[NEXUS-COGNITION] Forgetting ${conceptsToDelete.length} concepts due to low confidence.`);
      await Promise.all(conceptsToDelete.map(name => db.deleteConcept(name)));
    }

    if (conceptsToUpdate.length > 0) {
      console.log(`[NEXUS-COGNITION] Decaying confidence for ${conceptsToUpdate.length} concepts.`);
      await db.batchUpdateConcepts(conceptsToUpdate);
    }
    
    if (conceptsToUpdate.length > 0 || conceptsToDelete.length > 0) {
        memoryCache.clear(); // Invalidate cache after updates
    }
  },

  async reinforceConcepts(conceptNames: string[]): Promise<void> {
    if (conceptNames.length === 0) return;

    const uniqueNames = [...new Set(conceptNames.map(name => name.toLowerCase().trim()))];
    
    const conceptsToUpdate: Concept[] = [];
    const settings = await db.getSettings();
    const learningRate = settings.cognitive?.learningRate || 1.0;
    
    const conceptsFromDB = await db.getConceptsByNames(uniqueNames);

    for (const concept of conceptsFromDB) {
        if (concept) {
            const confidenceBoost = 0.1 * learningRate;
            concept.confidence = Math.min(1.0, (concept.confidence || 0) + confidenceBoost);
            concept.updatedAt = Date.now();
            conceptsToUpdate.push(concept);
        }
    }

    if (conceptsToUpdate.length > 0) {
        await db.batchUpdateConcepts(conceptsToUpdate);
        memoryCache.clear();
    }
  },
};
