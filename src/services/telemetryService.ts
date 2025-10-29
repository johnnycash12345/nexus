import { db } from './indexedDBService';

interface TelemetryStats {
    successCount: number;
    failureCount: number;
    totalRequests: number;
    successRate: string;
}

// Helper to hash text for anonymization
async function hashText(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

class TelemetryService {
    private successCount = 0;
    private failureCount = 0;

    public incrementSuccess(): void {
        this.successCount++;
    }

    public incrementFailure(): void {
        this.failureCount++;
    }

    public getStats(): TelemetryStats {
        const total = this.successCount + this.failureCount;
        const rate = total > 0 ? ((this.successCount / total) * 100).toFixed(2) : "0.00";
        return {
            successCount: this.successCount,
            failureCount: this.failureCount,
            totalRequests: total,
            successRate: `${rate}%`,
        };
    }

    public reset(): void {
        this.successCount = 0;
        this.failureCount = 0;
    }

    public async exportDiagnostics(userId: string): Promise<void> {
        try {
            // 1. Collect Data
            const [
                settings,
                systemMemory,
                concepts,
                thoughts,
                cognitiveLogs,
            ] = await Promise.all([
                db.getSettings(userId),
                db.getSystemMemory(userId),
                db.getAllConcepts(userId),
                db.getThoughtLogs(userId, 50),
                db.getCognitiveLogs(userId, 50),
            ]);

            // 2. Anonymize and Structure Data
            const anonymizedReflections = systemMemory.reflections.map(r => ({
                timestamp: 'N/A', // Timestamps are not stored on reflections
                text_hash: r.substring(0, 100) + '...', // Truncate for summary
            }));
            
            const anonymizedThoughts = thoughts.map(t => ({
                timestamp: t.timestamp,
                category: t.category,
                summary_hash: t.summary.substring(0, 100) + '...', // Truncate
            }));

            const diagnosticData = {
                metadata: {
                    export_timestamp: new Date().toISOString(),
                    user_id_hash: await hashText(userId),
                    version: "1.0.0",
                },
                performance: {
                    api_calls: this.getStats(),
                },
                cognitive_state: {
                    concept_count: concepts.length,
                    concepts_top_10: concepts.sort((a, b) => b.confidence - a.confidence).slice(0, 10).map(c => ({ name: c.name, confidence: c.confidence })),
                    reflection_count: systemMemory.reflections.length,
                    synapse_count: systemMemory.synapses.length,
                    interaction_count: systemMemory.interactionCount,
                },
                anonymized_logs: {
                    reflections: anonymizedReflections,
                    thoughts: anonymizedThoughts,
                    cognitive_events: cognitiveLogs,
                },
                current_settings: {
                    behavior: settings.behavior,
                    cognitive: settings.cognitive,
                }
            };

            // 3. Trigger Download
            const blob = new Blob([JSON.stringify(diagnosticData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `nexus_diagnostics_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error("Failed to export diagnostics:", error);
            alert("Ocorreu um erro ao gerar o relatório de diagnóstico.");
        }
    }
}

export const telemetryService = new TelemetryService();