import { db } from './indexedDBService';
import { DecisionLogEntry, DecisionLogType } from '@/types';

class DecisionLogService {
    /**
     * Logs a critical decision to the database.
     * @param entry - The decision entry, excluding the 'id' and 'timestamp'.
     */
    async logDecision(entry: Omit<DecisionLogEntry, 'id' | 'timestamp'>): Promise<void> {
        try {
            const fullEntry: Omit<DecisionLogEntry, 'id'> = {
                ...entry,
                timestamp: Date.now(),
            };
            await db.addDecisionLog(fullEntry);
            
            // Optional: Dispatch an event to notify UI components of new logs
            window.dispatchEvent(new CustomEvent('nexus-decision-log-updated'));

        } catch (error) {
            console.error('[DecisionLogService] Failed to log decision:', error);
        }
    }

    /**
     * Retrieves the most recent decision logs for a user.
     * @param userId - The ID of the user whose logs to retrieve.
     * @param limit - The maximum number of logs to return (default: 50).
     * @returns A promise that resolves to an array of decision log entries.
     */
    async getLogs(userId: string, limit: number = 50): Promise<DecisionLogEntry[]> {
        try {
            return await db.getDecisionLogs(userId, limit);
        } catch (error) {
            console.error('[DecisionLogService] Failed to retrieve logs:', error);
            return [];
        }
    }
}

export const decisionLogService = new DecisionLogService();
