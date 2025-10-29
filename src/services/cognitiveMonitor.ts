import { AppSettings } from '@/types';

interface LogEntry<T> {
    timestamp: number;
    data: T;
}

const MAX_LOG_SIZE = 50;

class CognitiveMonitorService {
    public enabled = false;

    private thoughts: LogEntry<string>[] = [];
    private concepts: LogEntry<string>[] = [];
    private reflections: LogEntry<string>[] = [];
    private userId: string | null = null;

    // Call this when user logs in or app starts
    public async initialize(userId: string, initialSettings: AppSettings) {
        this.userId = userId;
        this.updateSettings(initialSettings);
    }

    public updateSettings(settings: AppSettings) {
        if (!this.userId) return;
        try {
            this.enabled = settings.behavior.permissions.transparencyMode;
        } catch (e) {
            console.error('[CognitiveMonitor] Could not read settings.', e);
            this.enabled = false; // Default to off on error
        }
    }

    private addToLog<T>(logArray: LogEntry<T>[], data: T) {
        logArray.unshift({ timestamp: Date.now(), data }); // Add to the beginning
        if (logArray.length > MAX_LOG_SIZE) {
            logArray.pop(); // Remove from the end
        }
    }

    public logThought(message: string) {
        if (!this.enabled) return;
        this.addToLog(this.thoughts, message);
        console.info(`[🧠 PENSAMENTO] ${message}`);
    }

    public logConcept(concept: string) {
        if (!this.enabled) return;
        const message = `Novo conceito assimilado: "${concept}"`;
        this.addToLog(this.concepts, message);
        console.info(`[💡 CONCEITO] ${message}`);
    }

    public logReflection(reflection: string) {
        if (!this.enabled) return;
        this.addToLog(this.reflections, reflection);
        console.info(`[🔍 REFLEXÃO] ${reflection}`);
    }

    public getState() {
        return {
            thoughts: this.thoughts.slice(0, 10),
            concepts: this.concepts.slice(0, 10),
            reflections: this.reflections.slice(0, 10),
        };
    }
}

export const cognitiveMonitor = new CognitiveMonitorService();