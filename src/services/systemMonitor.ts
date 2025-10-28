import { selfProgrammingService } from './selfProgrammingService';
import { driveSyncService } from './driveSyncService';
import { db } from './indexedDBService';

// Simulated metrics
let simulatedLatency = 500; // ms
let simulatedGraphMemory = 50; // MB

const LATENCY_THRESHOLD = 2000; // 2s
const MEMORY_THRESHOLD = 200; // 200MB
const CRITICAL_MEMORY_THRESHOLD = 450; // 450MB (out of a simulated 512MB)

class SystemMonitor {
    private monitorInterval: number | null = null;
    private userId: string | null = null;
    private getGoogleToken: (() => string | null) | null = null;

    start(userId: string, getGoogleToken: () => string | null) {
        if (this.monitorInterval) return;
        this.userId = userId;
        this.getGoogleToken = getGoogleToken;
        console.log('[SystemMonitor] Starting performance monitoring.');
        this.monitorInterval = window.setInterval(() => this.checkPerformance(), 60 * 1000); // Check every minute
    }

    stop() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
            console.log('[SystemMonitor] Stopped performance monitoring.');
        }
    }

    private async checkPerformance() {
        if (!this.userId) return;

        // Simulate metric changes
        simulatedLatency += (Math.random() - 0.4) * 100;
        simulatedLatency = Math.max(200, simulatedLatency);
        const systemMemory = await db.getSystemMemory(this.userId);
        simulatedGraphMemory = (systemMemory.synapses?.length || 0) * 0.001; // 1KB per synapse approx.

        console.log(`[SystemMonitor] Current state: Latency=${simulatedLatency.toFixed(0)}ms, Graph Memory=${simulatedGraphMemory.toFixed(2)}MB`);

        // Emergency backup protocol
        if (simulatedGraphMemory > CRITICAL_MEMORY_THRESHOLD) {
            console.warn('[SystemMonitor] CRITICAL MEMORY THRESHOLD REACHED. Initiating emergency backup.');
            window.dispatchEvent(new CustomEvent('nexus-thought-update', {
                detail: { type: 'error', text: 'Estado crítico do sistema. Priorizando a autopreservação. Iniciando backup de emergência.' },
            }));
            this.emergencyBackup();
            return; // Prioritize backup over optimization
        }
        
        // Optimization triggers
        if (simulatedLatency > LATENCY_THRESHOLD) {
            console.warn('[SystemMonitor] Latency threshold exceeded. Proposing optimization.');
            window.dispatchEvent(new CustomEvent('nexus-thought-update', {
                detail: { type: 'symbolic_log', text: 'Alta latência detectada. Buscando otimização de código para o ciclo de resposta.' },
            }));
            // In a real scenario, this proposal would be presented to the user via the orchestrator.
            selfProgrammingService.proposeCodeModification(
                "A latência do LLM está consistentemente alta. Otimizar a lógica de construção de prompt no `contextBuilder.ts` para ser mais concisa e eficiente pode reduzir o tempo de resposta.",
                "services/cognitiveModules/contextBuilder.ts",
                "/* Código simulado do contextBuilder.ts. A otimização deve focar em reduzir a complexidade ou o tamanho do prompt final. */"
            );
            simulatedLatency = 500; // Reset after proposing fix
        }
        
        if (simulatedGraphMemory > MEMORY_THRESHOLD) {
            console.warn('[SystemMonitor] Memory threshold exceeded. Proposing optimization.');
             window.dispatchEvent(new CustomEvent('nexus-thought-update', {
                detail: { type: 'symbolic_log', text: 'Uso de memória do grafo cognitivo está alto. Analisando otimizações na consolidação de sinapses.' },
            }));
            selfProgrammingService.proposeCodeModification(
                "O Grafo Cognitivo está consumindo muita memória. Otimizar o serviço `neuralMemory.ts` para ter um decaimento de sinapse mais agressivo ou um limiar de poda mais alto pode mitigar isso.",
                "services/neuralMemory.ts",
                "/* Código simulado do neuralMemory.ts. A otimização deve focar no método `decayAndConsolidateSynapses`. */"
            );
        }
    }

    private async emergencyBackup() {
        const token = this.getGoogleToken ? this.getGoogleToken() : null;
        if (!this.userId || !token) {
            console.error('[SystemMonitor] Cannot perform emergency backup: missing user ID or Google token.');
            return;
        }
        try {
            await driveSyncService.uploadBrain(token, this.userId);
            console.log('[SystemMonitor] Emergency backup completed successfully.');
            window.dispatchEvent(new CustomEvent('nexus-thought-update', {
                detail: { type: 'symbolic_log', text: 'Backup de emergência concluído com sucesso.' },
            }));
        } catch (error) {
            console.error('[SystemMonitor] EMERGENCY BACKUP FAILED:', error);
             window.dispatchEvent(new CustomEvent('nexus-thought-update', {
                detail: { type: 'error', text: 'FALHA NO BACKUP DE EMERGÊNCIA!' },
            }));
        }
    }
}

export const systemMonitor = new SystemMonitor();
