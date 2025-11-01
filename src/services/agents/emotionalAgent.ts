import { CognitiveFrame } from '../../types';
import { analyzeAndEvolveEmotion } from '../emotionalEngine';
import { associativeReasoner } from '../associativeReasoner';
// APRIMORAMENTO: Importa o logger central
import { cognitiveMonitor } from '../cognitiveMonitor'; 

/**
 * O EmotionalAgent é responsável por processar os aspectos "subconscientes"
 * de uma interação após ela ocorrer, como a evolução emocional e a
 * formação de novas memórias associativas.
 */
export class EmotionalAgent {
    constructor(private userId: string) {}

    /**
     * Processa e integra o resultado de uma interação no estado
     * emocional e na memória de longo prazo.
     * * Executa a análise emocional e a geração de sinapses em paralelo.
     */
    async processInteraction(frame: CognitiveFrame): Promise<void> {
        if (!frame.llmResponse) {
            cognitiveMonitor.logThought("[EmotionalAgent] Interação pulada: sem resposta do LLM.", "error");
            return;
        }

        const { learningContext, text } = frame.llmResponse;

        // APRIMORAMENTO: Define as tarefas de integração
        const integrationTasks = [
            {
                name: 'Evolução Emocional',
                task: () => analyzeAndEvolveEmotion(this.userId, learningContext, text)
            },
            {
                name: 'Raciocínio Associativo',
                task: () => associativeReasoner.generateNewSynapses(frame)
            }
        ];

        // APRIMORAMENTO: Usa Promise.allSettled para garantir que ambas as tarefas
        // sejam executadas, mesmo que uma falhe.
        const results = await Promise.allSettled(
            integrationTasks.map(t => t.task())
        );

        // APRIMORAMENTO: Verifica os resultados de cada tarefa individualmente
        results.forEach((result, index) => {
            const taskName = integrationTasks[index].name;

            if (result.status === 'rejected') {
                // Se uma tarefa falhou, registra o erro no console E no monitor cognitivo
                console.error(`[EmotionalAgent] Falha na tarefa: ${taskName}`, result.reason);
                // FIX: Correctly access the error message from the rejected promise.
                cognitiveMonitor.logThought(
                    `[EmotionalAgent] Falha na tarefa de ${taskName}. Erro: ${(result.reason as Error)?.message || result.reason}`, 
                    'error'
                );
            }
            // (Opcional) Log de sucesso, se necessário
            // else {
            //     cognitiveMonitor.logThought(`[EmotionalAgent] Tarefa de ${taskName} concluída.`);
            // }
        });
    }
}
