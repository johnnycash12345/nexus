import { db } from '../indexedDBService';
import { SimpleFunctionCall, ChatMessage, UserContext } from '@/types';

export class CodeAgent {
    async executeFunctionCall(call: SimpleFunctionCall, userContext: UserContext): Promise<Omit<ChatMessage, 'userId' | 'timestamp'>> {
        let resultText = `Função desconhecida: ${call.name}`;
        const { userId } = userContext;

        try {
            if (call.name === 'addTask' && call.args.text) {
                await db.addTask(userId, { text: call.args.text });
                resultText = `Ok, adicionei "${call.args.text}" à sua lista de tarefas.`;
            } else if (call.name === 'listTasks') {
                const tasks = await db.getAllTasks(userId);
                const pendingTasks = tasks.filter(t => !t.completed);
                if (pendingTasks.length === 0) {
                    resultText = "Você não tem nenhuma tarefa pendente no momento.";
                } else {
                    resultText = `Aqui estão suas tarefas pendentes: ${pendingTasks.map(t => `"${t.text}"`).join(', ')}.`;
                }
            } else if (call.name === 'markTaskAsCompleted' && call.args.text) {
                const tasks = await db.getAllTasks(userId);
                const taskToComplete = tasks.find(t => !t.completed && t.text.toLowerCase().trim() === call.args.text.toLowerCase().trim());
                if (taskToComplete) {
                    await db.updateTask(userId, { ...taskToComplete, completed: true });
                    resultText = `Pronto, marquei a tarefa "${taskToComplete.text}" como concluída.`;
                } else {
                    resultText = `Não encontrei a tarefa pendente "${call.args.text}" para marcar como concluída.`;
                }
            }
        } catch (error) {
            console.error(`[CodeAgent] Error executing function '${call.name}':`, error);
            resultText = `Desculpe, tive um problema ao tentar executar a ação: ${call.name}.`;
        }
        
        return {
            role: 'model',
            text: resultText,
            type: 'status',
        };
    }
}