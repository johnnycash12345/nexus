import { db } from './indexedDBService';
import { UserContext, Project, ProjectTask } from '../types';
import { generateGeminiResponse } from './geminiService';
import { Type } from '@google/genai';

const taskDecompositionSchema = {
  type: Type.OBJECT,
  properties: {
    tasks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
        },
        required: ['description'],
      },
    },
  },
  required: ['tasks'],
};

class ProjectManager {
    async startProject(name: string, goal: string, userContext: UserContext): Promise<Project | null> {
        console.log(`[ProjectManager] Starting project "${name}" for user ${userContext.userId}`);
        
        // 1. Decompose the goal into tasks using the LLM
        const prompt = `
            Decomponha o seguinte objetivo de projeto em uma lista de subtarefas claras, sequenciais e acionáveis.
            Seja específico. O projeto é: "${name}".
            O objetivo completo é: "${goal}".
            Retorne apenas as tarefas. Sua resposta DEVE ser um único objeto JSON.
        `;

        try {
            const response = await generateGeminiResponse(prompt, [], { useThinking: true, customSchema: taskDecompositionSchema });
            const parsed = JSON.parse(response.text);
            
            if (!parsed.tasks || parsed.tasks.length === 0) {
                console.error('[ProjectManager] Failed to decompose project goal.');
                return null;
            }

            const projectTasks: ProjectTask[] = parsed.tasks.map((task: any, index: number) => ({
                step: index + 1,
                description: task.description,
                status: 'pending',
            }));

            // 2. Save the new project to the database
            const newProject: Omit<Project, 'id' | 'userId'> = {
                name,
                goal,
                tasks: projectTasks,
                createdAt: Date.now(),
                status: 'active',
            };

            return await db.saveProject(userContext.userId, newProject);

        } catch (error) {
            console.error('[ProjectManager] Error during project creation:', error);
            return null;
        }
    }

    async updateProgress(userId: string, projectId: number, step: number, status: 'completed', result: string): Promise<Project | undefined> {
        const project = await db.getProject(userId, projectId);
        if (!project) return;

        const task = project.tasks.find(t => t.step === step);
        if (task) {
            task.status = status;
            task.result = result;
        }

        // Check if all tasks are completed
        const allCompleted = project.tasks.every(t => t.status === 'completed');
        if (allCompleted) {
            project.status = 'completed';
        }
        
        await db.saveProject(userId, project);
        return project;
    }

    async getProjectStatus(userId: string, projectId: number): Promise<Project | undefined> {
        return db.getProject(userId, projectId);
    }
}

export const projectManager = new ProjectManager();
