

import { db } from './indexedDBService';
import { Concept } from '@/types';
import { memoryCache } from './memoryCache';

const MIN_CONFIDENCE = 0.05;

export const adaptiveMemory = {
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
        conceptsToUpdate.push({ ...concept, confidence: newConfidence, updatedAt: concept.updatedAt }); // keep original update time for decay calc
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
        memoryCache.clear(); // Invalidate cache after updates
    }
  },

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
};
