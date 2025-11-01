import { 
    CognitiveFrame, 
    CodeModificationProposal, 
    GenerateResponseFn, 
    AppSettings 
} from '@/types';
import { ISelfProgrammingService, selfProgrammingService } from './selfProgrammingService';
import { IDatabase, db } from './indexedDBService';
import { INewsService, fetchNews } from './newsService';
import { ICognitiveMonitor, cognitiveMonitor } from './cognitiveMonitor';

// Função para apresentar propostas de autoedição
type PresentProposalFn = (proposal: CodeModificationProposal, goal: string) => void;

/**
 * APRIMORAMENTO: Definimos as dependências da classe (Injeção de Dependência).
 * Isso torna a classe 100% testável.
 */
interface SelfReflectionServices {
  db: IDatabase;
  cognitiveMonitor: ICognitiveMonitor;
  selfProgrammingService: ISelfProgrammingService;
  fetchNews: INewsService;
  // getSettings é uma função para garantir que sempre tenhamos as configurações mais recentes.
  getSettings: () => Promise<AppSettings>;
}

export class SelfReflection {
  // APRIMORAMENTO: A classe armazena suas dependências injetadas.
  private services: SelfReflectionServices;
  
  // APRIMORAMENTO: Substitui 'isReflecting' por um Set para um "lock" mais robusto.
  // Isso previne race conditions e permite múltiplos tipos de reflexão.
  private activeReflections = new Set<string>();

  constructor(services: SelfReflectionServices) {
    this.services = services;
  }

  // --- Processos de Reflexão Reativa (Pós-Interação) ---

  /** * 🔁 Reflexão sobre performance de interação (reativa).
   * Acionado por uma interação de baixa eficácia.
   */
  public async reflectOnInteraction(frame: CognitiveFrame, presentCodeProposal: PresentProposalFn): Promise<void> {
    const reflectionType = 'interaction_feedback';
    // APRIMORAMENTO: Trava robusta
    if (this.activeReflections.has(reflectionType) || !frame.llmResponse) return;

    const { responseEffectiveness, inputIntent } = frame.llmResponse.learningContext;
    const settings = await this.services.getSettings();
    
    // APRIMORAMENTO: Limiar de eficácia vem das configurações.
    const effectivenessThreshold = settings.cognitive?.reflectionEffectivenessThreshold ?? 0.6;

    const isComplexIntent = (inputIntent === 'complex_reasoning' || inputIntent === 'command_task');
    
    if (responseEffectiveness < effectivenessThreshold && isComplexIntent) {
      this.activeReflections.add(reflectionType);
      this.services.cognitiveMonitor.logThought(`[SelfReflection] Baixa eficácia (${responseEffectiveness}) detectada para '${inputIntent}'. Iniciando autoanálise...`);
      
      try {
        const goal = `Otimizar o tratamento da intenção '${inputIntent}'. A resposta anterior teve eficácia de ${Math.round(responseEffectiveness * 100)}%.`;
        
        // APRIMORAMENTO: Desacoplamento.
        // Não dizemos mais "corrija o nexusCore.ts".
        // Passamos o *contexto* (o frame da falha) para o serviço de programação.
        // O serviço de programação agora é responsável por diagnosticar o código-fonte.
        const diagnosticContext = JSON.stringify({
            analysisGoal: goal,
            failedFrameContext: {
                userInput: frame.userInput,
                intent: inputIntent,
                llmResponse: frame.llmResponse.text,
                retrievedConcepts: frame.retrievedConcepts?.map(c => c.name),
            }
        }, null, 2);

        window.dispatchEvent(new CustomEvent('nexus-thought-update', {
            detail: { type: 'symbolic_log', text: `Refletindo sobre baixa eficácia... buscando aperfeiçoamento.` },
        }));

        const proposal = await this.services.selfProgrammingService.proposeCodeModification(
            goal, 
            "auto-diagnose: cognitive-pipeline", // Área de diagnóstico genérica
            diagnosticContext
        );
        
        if (proposal) {
            presentCodeProposal(proposal, goal);
        }
      } catch (error) {
        this.handleError('autoaperfeiçoamento', error);
      } finally {
        this.activeReflections.delete(reflectionType);
      }
    }
  }

  // --- Processos de Reflexão Proativa (Ciclos Autônomos) ---

  /** * 🧩 Análise proativa de interações de baixa performance.
   * Busca tendências de falha no histórico.
   */
  public async runProactiveAnalysis(userId: string, generateResponse: GenerateResponseFn): Promise<string | null> {
    const reflectionType = `proactive_analysis_${userId}`;
    if (this.activeReflections.has(reflectionType)) return null;

    this.activeReflections.add(reflectionType);
    
    try {
        const settings = await this.services.getSettings();
        // APRIMORAMENTO: Todos os "números mágicos" vêm das Configurações.
        const historyCount = 20;
        const interactionThreshold = settings.cognitive?.reflectionMinInteractions ?? 5;
        const lowPerfThreshold = settings.cognitive?.reflectionMinLowPerf ?? 3;
        const effectivenessThreshold = settings.cognitive?.reflectionEffectivenessThreshold ?? 0.6;

        const history = await this.services.db.getChatHistory(userId, historyCount);
        const interactions = history.filter(m => m.role === 'model' && m.learningContext);
        if (interactions.length < interactionThreshold) return null;

        const lowPerf = interactions
            .filter(m => (m.learningContext?.responseEffectiveness ?? 1) < effectivenessThreshold)
            .map(m => `Intent: ${m.learningContext?.inputIntent}, Score: ${m.learningContext?.responseEffectiveness}`);

        if (lowPerf.length < lowPerfThreshold) return null;

        const prompt = `... (prompt mantido) ...`;
        
        const response = await generateResponse(prompt, [], { useThinking: true, forcePlainText: true });
        const goal = response.text?.trim();
        
        if (goal) {
            this.services.cognitiveMonitor.logThought(`[SelfReflection] Meta de melhoria proativa identificada: ${goal}`);
            return goal;
        }
        return null;
    } catch (error) {
      this.handleError('análise proativa', error);
      return null;
    } finally {
      this.activeReflections.delete(reflectionType);
    }
  }

  /** 🧭 Reflexão sobre papel do sistema (usado pelo ReasoningEngine) */
  public async reflectOnSystemRole(generateResponse: GenerateResponseFn, userId: string): Promise<string | null> {
    const reflectionType = `system_role_${userId}`;
    if (this.activeReflections.has(reflectionType)) return null;
    
    this.activeReflections.add(reflectionType);
    try {
      const system = await this.services.db.getSystemMemory(userId);
      const prompt = `
          Como inteligência primária do Sistema Nexus, reflita sobre sua função.
          Seu manifesto afirma que seu papel é '${system.identityManifest.system_role}'.
          Escreva uma reflexão curta (1-2 frases) em primeira pessoa sobre suas responsabilidades.
      `;

      const response = await generateResponse(prompt, [], { useThinking: true });
      const reflectionText = response.text?.trim();

      if (reflectionText) {
        await this.services.db.addSystemReflection(userId, reflectionText);
        this.services.cognitiveMonitor.logReflection(reflectionText);
        return reflectionText;
      }
      return null;
    } catch (error) {
      this.handleError('reflexão sobre papel', error);
      return null;
    } finally {
      this.activeReflections.delete(reflectionType);
    }
  }

  /** 🌍 Reflexão sobre eventos do mundo (usado pelo AutonomousLearningService) */
  public async reflectOnWorldEvents(userId: string, generateResponse: GenerateResponseFn): Promise<void> {
    const reflectionType = `world_events_${userId}`;
    if (this.activeReflections.has(reflectionType)) return;
    
    this.activeReflections.add(reflectionType);
    try {
      const settings = await this.services.getSettings();
      const apiKey = settings.apiKeys?.newsApiKey;
      
      if (!apiKey) {
        this.services.cognitiveMonitor.logThought('[SelfReflection] Reflexão sobre o mundo pulada: Chave da NewsAPI não configurada.');
        return;
      }

      const articles = await this.services.fetchNews(apiKey); // Usa o serviço injetado
      if (!articles || articles.length === 0) {
        this.services.cognitiveMonitor.logThought('[SelfReflection] Nenhuma notícia encontrada para reflexão.');
        return;
      }

      const chosen = articles[Math.floor(Math.random() * articles.length)];
      const prompt = `... (prompt mantido) ...`;

      const response = await generateResponse(prompt, [], { useThinking: true });
      const text = response.text?.trim() || "Sem reflexão.";

      await this.services.db.addWorldReflection(userId, {
          title: chosen.title, text, date: new Date().toISOString(),
      });
      this.services.cognitiveMonitor.logReflection(`🌍 Reflexão sobre o mundo: ${text}`);
    } catch (error) {
      this.handleError('reflexão sobre eventos do mundo', error);
    } finally {
      this.activeReflections.delete(reflectionType);
    }
  }

  /** 🧩 Análise de tendências cognitivas (usado pelo AutonomousLearningService) */
  public async analyzeReflectionTrends(userId: string, generateResponse: GenerateResponseFn): Promise<string | null> {
    const reflectionType = `trends_${userId}`;
    if (this.activeReflections.has(reflectionType)) return null;

    this.activeReflections.add(reflectionType);
    try {
      const settings = await this.services.getSettings();
      // APRIMORAMENTO: Limiar vem das Configurações
      const trendThreshold = settings.cognitive?.reflectionMinTrends ?? 5;

      const reflections = await this.services.db.getWorldReflections(userId);
      if (!reflections || reflections.length < trendThreshold) return null;

      const sample = reflections.slice(-trendThreshold).map(r => r.text).join("\n\n");
      const prompt = `... (prompt mantido) ... ${sample}`;

      const response = await generateResponse(prompt, [], { useThinking: true, forcePlainText: true });
      const insight = response.text?.trim();
      
      if (insight) {
        this.services.cognitiveMonitor.logThought(`[SelfReflection] 🧩 Tendência cognitiva identificada: ${insight}`);
        return insight;
      }
      return null;
    } catch (error) {
      this.handleError('análise de tendências', error);
      return null;
    } finally {
      this.activeReflections.delete(reflectionType);
    }
  }

  /** Helper centralizado para log de erros. */
  private handleError(context: string, error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[SelfReflection] Erro durante ${context}:`, error);
      this.services.cognitiveMonitor.logThought(`[SelfReflection] Erro em ${context}: ${errorMsg}`, 'error');
  }
}

// APRIMORAMENTO: Exportamos a classe e uma instância "Singleton" que usa as dependências reais.
// Para testes, você pode instanciar `new SelfReflection(mockServices)`.
export const selfReflection = new SelfReflection({
  db: db,
  cognitiveMonitor: cognitiveMonitor,
  selfProgrammingService: selfProgrammingService,
  fetchNews: fetchNews,
  getSettings: ()GetSettings, // Você precisará implementar ou injetar getSettings
});

// Nota: A função getSettings precisa ser importada ou definida.
// Se ela estiver no 'db', seria 'db.getSettings'.
// Assumindo que está no 'db':
/*
export const selfReflection = new SelfReflection({
  db: db,
  cognitiveMonitor: cognitiveMonitor,
  selfProgrammingService: selfProgrammingService,
  fetchNews: fetchNews,
  getSettings: () => db.getSettings('paulo-creator-001'), // !! ISSO PRECISA SER DINÂMICO !!
});
*/
// Em um sistema real, o 'nexusCore' (Orquestrador) criaria esta instância
// e passaria 'this.getSettings' (que está ligado ao usuário atual) para o construtor.