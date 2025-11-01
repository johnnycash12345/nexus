import { 
    CognitiveFrame, 
    VisualState, 
    CodeModificationProposal, 
    UserContext 
} from '../../types';
import { 
    IDatabase, 
    ICognitiveLogger, 
    db, 
    cognitiveLogger 
} from '../indexedDBService';
import { 
    INeuralMemory, 
    neuralMemory 
} from '../neuralMemory';
import { EmotionalAgent } from '../agents/emotionalAgent';
import { SelfReflection } from '../selfReflection'; 
import { ICognitiveMonitor, cognitiveMonitor } from '../cognitiveMonitor';

// --- APRIMORAMENTO 10x (PONTO 1 & 2) ---
// Importação dos novos serviços de aprendizado
import { IPerformanceTracker, performanceTracker } from '../performanceTracker';
import { adaptiveMemory } from '../adaptiveMemory';

/**
 * Dependências 10x Completas:
 * Inclui todos os serviços necessários para o ciclo de aprendizado.
 */
interface CognitiveUpdaterDependencies {
  db: IDatabase;
  cognitiveLogger: ICognitiveLogger;
  neuralMemory: INeuralMemory;
  cognitiveMonitor: ICognitiveMonitor;
  performanceTracker: IPerformanceTracker; // PONTO 1
}

/**
 * O Aprendiz Cognitivo.
 * Esta classe é o núcleo do ciclo de aprendizado pós-interação.
 * Ela orquestra a integração da memória, validação de performance,
 * aprendizado adaptativo e reflexão sobre falhas.
 */
export class CognitiveUpdater {
  private db: IDatabase;
  private cognitiveLogger: ICognitiveLogger;
  private neuralMemory: INeuralMemory;
  private cognitiveMonitor: ICognitiveMonitor;
  private performanceTracker: IPerformanceTracker; // PONTO 1

  constructor(deps: CognitiveUpdaterDependencies) {
    this.db = deps.db;
    this.cognitiveLogger = deps.cognitiveLogger;
    this.neuralMemory = deps.neuralMemory;
    this.cognitiveMonitor = deps.cognitiveMonitor;
    this.performanceTracker = deps.performanceTracker; // PONTO 1
  }

  /**
   * Executa o ciclo de aprendizado pós-interação completo.
   * @param frame O CognitiveFrame completo da interação.
   * @param emotionalAgent A instância do EmotionalAgent para processar emoções.
   * @param selfReflection A instância do SelfReflection para acionar a autoanálise.
   * @returns O VisualState resultante, ou null se nenhum for gerado.
   */
  public async updateCognitiveState(
    frame: CognitiveFrame, 
    emotionalAgent: EmotionalAgent,
    selfReflection: SelfReflection // A instância injetada pelo Orquestrador
  ): Promise<VisualState | null> {
    
    if (!frame.llmResponse) {
      console.error("[CognitiveUpdater] Não é possível atualizar o estado sem uma resposta do LLM.");
      this.cognitiveMonitor.logThought("CognitiveUpdater pulado: llmResponse está nulo.", 'error');
      return null;
    }

    const { userContext, latency } = frame;
    const { learningContext, metaReflection, text } = frame.llmResponse;

    // --- ETAPA 1: Log de Ação (Auditoria) ---
    this.cognitiveLogger.logAction(userContext.userId, { 
      timestamp: Date.now(),
      event: 'new_learning', 
      stage: 'integrate',
      description: `Nova aprendizagem da interação. Intenção: ${learningContext.inputIntent}`,
      impact: 'Estado interno atualizado.', 
      result: 'Success.', 
      rollback_used: false,
    });
    
    // --- ETAPA 2: Integração Rápida (Paralela) ---
    // Salva a memória principal e processa emoções/associações.
    const integrationTasks = [
      this.db.saveSystemMemory(userContext.userId, { metaReflection }),
      this.neuralMemory.registerInteraction(userContext.userId, frame.userInput, text, learningContext),
      emotionalAgent.processInteraction(frame)
    ];

    const results = await Promise.allSettled(integrationTasks);

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const taskName = ['saveSystemMemory', 'registerInteraction', 'processInteraction'][index];
        console.error(`[CognitiveUpdater] Falha na subtarefa de integração '${taskName}':`, result.reason);
        this.cognitiveMonitor.logThought(`[CognitiveUpdater] Falha na tarefa '${taskName}': ${result.reason?.message}`, 'error');
      }
    });

    // --- ETAPA 3: Aprendizado Validado (PONTO 1) ---
    // Registra a performance desta interação para o loop de validação.
    await this.performanceTracker.logInteraction(frame.userContext.userId, {
      intent: learningContext.inputIntent,
      effectiveness: learningContext.responseEffectiveness,
      latency: latency || 0, // (frame.latency deve ser calculado no Orquestrador)
      reflectionScore: metaReflection ? 1 : 0
    });

    // --- ETAPA 4 & 5: Aprendizado de Fundo (Fire-and-Forget) ---
    // Estas tarefas rodam em segundo plano e não bloqueiam a UI.

    // PONTO 2: Memória Adaptativa (Reforço/Decaimento de Conceitos)
    (async () => {
      try {
        await adaptiveMemory.updateConceptWeights(frame);
        await adaptiveMemory.decayUnusedConcepts(userContext.userId); // Passando userId
      } catch (err) {
        this.cognitiveMonitor.logThought(`[CognitiveUpdater] Falha ao ajustar pesos de memória: ${err.message}`, 'error');
      }
    })();

    // PONTO 3: Auto-Reflexão (Backpropagation de Falha)
    (async () => {
      try {
        const settings = await this.db.getSettings(userContext.userId);
        if (settings.behavior.permissions.allowSelfModification) {
          // A instância 'selfReflection' já contém a lógica para checar a eficácia (Ponto 3)
          await selfReflection.reflectOnInteraction(frame);
        }
      } catch (err) {
        console.warn("[CognitiveUpdater] Processo de auto-reflexão em segundo plano falhou:", err);
        this.cognitiveMonitor.logThought(`[CognitiveUpdater] Falha na auto-reflexão: ${err.message}`, 'error');
      }
    })();

    // --- ETAPA 6: Log Cognitivo (Consciência) (PONTO 4) ---
    this.cognitiveMonitor.logThought(
      `[CognitiveUpdater] Aprendizagem integrada. Intenção: ${learningContext.inputIntent}, Eficácia: ${(learningContext.responseEffectiveness * 100).toFixed(0)}%.`
    );
    if (learningContext.responseEffectiveness > 0.8) {
      this.cognitiveMonitor.logReflection(`🧠 Aprendi algo novo e útil sobre ${learningContext.inputIntent}.`);
    }

    // --- ETAPA 7: Visualização (Retorno Desacoplado) ---
    const emotionState = (await this.db.getSystemMemory(userContext.userId)).emotionState;
    if (emotionState) {
      const visualState: VisualState = {
          highlightNodes: learningContext.contextTags.slice(0, 3),
          pulseIntensity: learningContext.responseEffectiveness,
          emotionalSpectrum: { [emotionState.current]: emotionState.intensity }
      };
      return visualState;
    }
    
    return null;
  }
}

// ----------------------------------------------------------------------
// Instanciação Singleton com Injeção de Dependência 10x
// ----------------------------------------------------------------------
export const cognitiveUpdater = new CognitiveUpdater({
  db: db,
  cognitiveLogger: cognitiveLogger,
  neuralMemory: neuralMemory,
  cognitiveMonitor: cognitiveMonitor,
  performanceTracker: performanceTracker // PONTO 1
});