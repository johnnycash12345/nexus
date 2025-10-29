import { db } from './indexedDBService';
import { UserContext, Project } from '@/types';
import { AgentManager } from './agents/agentManager';
import { projectManager } from './projectManager';

type ProgressCallback = (update: string) => void;

class SchedulerService {
    private intervalId: number | null = null;
    private isRunning = false;
    
    start(userContext: UserContext, agentManager: AgentManager, onProgress: ProgressCallback) {
        if (this.isRunning) return;
        
        console.log('[Scheduler] Starting for user', userContext.userId);
        this.isRunning = true;
        // Check for tasks every 30 seconds (for demonstration)
        this.intervalId = window.setInterval(() => {
            this.executeNextTask(userContext, agentManager, onProgress);
        }, 30 * 1000);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        console.log('[Scheduler] Stopped.');
    }

    private async executeNextTask(userContext: UserContext, agentManager: AgentManager, onProgress: ProgressCallback) {
        const project = await db.getActiveProject(userContext.userId);
        if (!project) return;

        const nextTask = project.tasks.find(t => t.status === 'pending');
        if (!nextTask) {
            console.log(`[Scheduler] Project "${project.name}" has no more pending tasks.`);
            return;
        }
        
        console.log(`[Scheduler] Executing task: "${nextTask.description}"`);
        
        // Mark as in progress
        nextTask.status = 'in_progress';
        await db.saveProject(userContext.userId, project);

        // Here we would delegate to the correct agent via the agentManager.
        // For now, we simulate the execution.
        // Example: await agentManager.delegateTask({ intent: 'command_code', userInput: nextTask.description, ... });
        const simulatedResult = `Simulação da execução da tarefa: '${nextTask.description}' concluída com sucesso.`;
        
        // Update project progress
        await projectManager.updateProgress(userContext.userId, project.id!, nextTask.step, 'completed', simulatedResult);
        
        onProgress(`${userContext.userName}, acabei de concluir a subtarefa "${nextTask.description}" para o projeto "${project.name}".`);
    }
}

export const schedulerService = new SchedulerService();
