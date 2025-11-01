import { db } from '../indexedDBService';
import { SimpleFunctionCall, ChatMessage, UserContext, Task } from '../../types'; // Importe o tipo Task

/**
 * Define a assinatura de um manipulador de função.
 * Ele pode retornar uma string simples (para uma mensagem de status)
 * ou um objeto de ChatMessage completo (para UIs personalizadas).
 */
type FunctionHandler = (
    args: any, 
    userId: string
) => Promise<string | Omit<ChatMessage, 'userId' | 'timestamp'>>;

/**
 * O CodeAgent atua como a "camada de execução" do Nexus.
 * Ele traduz chamadas de função (Function Calls) do LLM em ações
 * reais no banco de dados ou em outros serviços.
 */
export class CodeAgent {

    /**
     * O Mapa de Funções (Dispatch Table).
     * Mapeia o nome da função (string) para o método que a executa.
     */
    private functionMap: Map<string, FunctionHandler>;

    constructor() {
        this.functionMap = new Map<string, FunctionHandler>([
            ['addTask', this.handleAddTask],
            ['listTasks', this.handleListTasks],
            ['markTaskAsCompleted', this.handleMarkTaskAsCompleted],
            // Adicione novas funções aqui
            // ['deleteTask', this.handleDeleteTask],
        ]);
    }

    /**
     * Ponto de entrada principal. Recebe a chamada do LLM e a roteia
     * para o manipulador correto.
     */
    async executeFunctionCall(call: SimpleFunctionCall, userContext: UserContext): Promise<Omit<ChatMessage, 'userId' | 'timestamp'>> {
        const { name, args } = call;
        const { userId } = userContext;

        const handler = this.functionMap.get(name);

        if (!handler) {
            console.warn(`[CodeAgent] Função desconhecida chamada: ${name}`);
            return this.createStatusMessage(`Função desconhecida: ${name}`);
        }

        try {
            // Chama o método manipulador correspondente
            // .call(this, ...) garante que o 'this' dentro do manipulador seja a instância do CodeAgent
            const result = await handler.call(this, args, userId);

            // Se o manipulador retornar uma string, encapsula em uma mensagem de status
            if (typeof result === 'string') {
                return this.createStatusMessage(result);
            }
            // Se retornar um objeto, o manipulador criou uma mensagem personalizada
            return result;

        } catch (error: any) {
            console.error(`[CodeAgent] Erro ao executar a função '${name}':`, error);
            // APRIMORAMENTO: Retorna a mensagem de erro da validação (ex: "Texto faltando")
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
            return this.createStatusMessage(`Desculpe, tive um problema ao executar ${name}: ${errorMessage}`);
        }
    }

    /**
     * Cria um objeto de ChatMessage padrão do tipo 'status'.
     */
    private createStatusMessage(text: string): Omit<ChatMessage, 'userId' | 'timestamp'> {
        return {
            role: 'model',
            text: text,
            type: 'status',
        };
    }

    // ----------------------------------------------------------------------
    // MANIPULADORES DE FUNÇÃO (LÓGICA ISOLADA)
    // ----------------------------------------------------------------------

    /**
     * 1. Adiciona uma nova tarefa.
     */
    private async handleAddTask(args: { text?: string }, userId: string): Promise<string> {
        const text = args.text?.trim();
        
        // APRIMORAMENTO: Validação de argumentos
        if (!text) {
            throw new Error("O 'text' da tarefa não pode estar vazio.");
        }

        await db.addTask(userId, { text });
        return `Ok, adicionei "${text}" à sua lista de tarefas.`;
    }

    /**
     * 2. Lista tarefas pendentes.
     */
    private async handleListTasks(args: any, userId: string): Promise<string> {
        const tasks = await db.getAllTasks(userId);
        const pendingTasks = tasks.filter(t => !t.completed);

        if (pendingTasks.length === 0) {
            return "Você não tem nenhuma tarefa pendente no momento.";
        }

        // APRIMORAMENTO: Retorna uma lista Markdown em vez de uma string
        // O componente Message irá formatar isso corretamente.
        const taskList = pendingTasks.map(t => `- ${t.text}`).join('\n');
        return `Aqui estão suas tarefas pendentes:\n${taskList}`;
    }

    /**
     * 3. Marca uma tarefa como concluída.
     */
    private async handleMarkTaskAsCompleted(args: { text?: string }, userId: string): Promise<string> {
        const textToFind = args.text?.trim().toLowerCase();

        // APRIMORAMENTO: Validação de argumentos
        if (!textToFind) {
            throw new Error("O 'text' da tarefa a ser concluída não foi fornecido.");
        }

        const tasks = await db.getAllTasks(userId);
        
        // Lógica de busca (mantida, pois é boa)
        const taskToComplete = tasks.find(t => 
            !t.completed && 
            t.text.toLowerCase().trim() === textToFind
        );

        if (taskToComplete) {
            await db.updateTask(userId, { ...taskToComplete, completed: true });
            return `Pronto, marquei a tarefa "${taskToComplete.text}" como concluída.`;
        } else {
            return `Não encontrei a tarefa pendente "${args.text}" para marcar como concluída.`;
        }
    }

    // Exemplo de como adicionar uma nova função:
    /*
    private async handleDeleteTask(args: { text?: string }, userId: string): Promise<string> {
        // ...lógica para deletar
        return "Tarefa deletada.";
    }
    */
}