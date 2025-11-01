import { AppSettings } from '@/types';

// Uso de readonly e tipagem mais específica para evitar mutação acidental
const MAX_LOG_SIZE: number = 50;
const INITIAL_LOG_LIMIT: number = 10; // Para o método getState()

// Tipos ------------------------------------------------------------------------

/**
 * Representa uma entrada de log genérica com carimbo de data/hora.
 * @template T O tipo de dado armazenado na entrada de log.
 */
export interface LogEntry<T> { // Exportado para ser usado no hook
  readonly timestamp: number;
  readonly data: T;
}

/**
 * Define a estrutura do estado de monitoramento retornado pelo getState().
 */
export interface MonitorState { // Exportado para ser usado no hook
  thoughts: LogEntry<string>[];
  concepts: LogEntry<string>[];
  reflections: LogEntry<string>[];
  isEnabled: boolean;
  userId: string | null;
}

/**
 * Define o tipo de uma função de callback do listener.
 */
type ListenerCallback = () => void;

/**
 * Define o tipo da função de cancelamento de inscrição.
 */
type UnsubscribeFunction = () => void;

// Serviço ----------------------------------------------------------------------

/**
 * Serviço Singleton para monitorar e registrar a "cognição" do sistema.
 */
class CognitiveMonitorService {
  // Propriedades -------------------------------------------------------------
  private enabled: boolean = false;
  private userId: string | null = null;

  private readonly thoughts: LogEntry<string>[] = [];
  private readonly concepts: LogEntry<string>[] = [];
  private readonly reflections: LogEntry<string>[] = [];

  /**
   * [NOVO] Armazena os callbacks dos componentes que estão ouvindo.
   * Usar um Set garante que o mesmo listener não seja adicionado duas vezes
   * e otimiza a remoção.
   */
  private readonly listeners = new Set<ListenerCallback>();

  public get isEnabled(): boolean {
    return this.enabled;
  }

  private constructor() {
    // Construtor privado para Singleton
  }

  // Métodos de Inicialização e Configuração ----------------------------------

  /**
   * Inicializa o monitor.
   * [CORRIGIDO] Removido 'async' pois o método é síncrono.
   */
  public initialize(userId: string, initialSettings: AppSettings): void {
    this.userId = userId;
    this.updateSettings(initialSettings);
    console.info(`[CognitiveMonitor] Inicializado para o usuário: ${userId}. Ativado: ${this.enabled}`);
  }

  public updateSettings(settings: AppSettings): void {
    if (!this.userId) {
      console.warn('[CognitiveMonitor] Tentativa de atualizar configurações sem usuário inicializado.');
      return;
    }

    try {
      const newEnabledState = settings.behavior?.permissions?.transparencyMode ?? false;
      if (this.enabled !== newEnabledState) {
        this.enabled = newEnabledState;
        console.info(`[CognitiveMonitor] Estado de transparência atualizado para: ${this.enabled}`);
        // Notifica os listeners se o estado de ativação mudar
        this.notifyListeners(); 
      }
    } catch (e) {
      console.error('[CognitiveMonitor] Não foi possível ler as configurações. Desativando monitoramento.', e);
      this.enabled = false;
    }
  }

  // Métodos de Reatividade (Pub/Sub) ---------------------------------------

  /**
   * [NOVO] Permite que um componente React "assine" as mudanças deste serviço.
   * @param callback A função a ser chamada quando os dados mudarem.
   * @returns Uma função de 'unsubscribe' para ser usada na limpeza do useEffect.
   */
  public subscribe(callback: ListenerCallback): UnsubscribeFunction {
    this.listeners.add(callback);
    
    // Retorna a função de unsubscribe
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * [NOVO] Notifica todos os listeners (componentes) inscritos.
   */
  private notifyListeners(): void {
    // Itera sobre os listeners e os chama
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (e) {
        console.error("[CognitiveMonitor] Erro ao notificar listener:", e);
      }
    }
  }

  // Métodos Internos de Log --------------------------------------------------

  private addToLog<T>(logArray: LogEntry<T>[], data: T): void {
    logArray.unshift({ timestamp: Date.now(), data });
    if (logArray.length > MAX_LOG_SIZE) {
      logArray.pop();
    }
  }

  /**
   * [NOVO] Método privado refatorado para centralizar a lógica de log.
   */
  private logInternal(
    logArray: LogEntry<string>[],
    message: string,
    consolePrefix: string
  ): void {
    if (!this.enabled) return;
    
    // 1. Adiciona ao log
    this.addToLog(logArray, message);
    console.info(`${consolePrefix} ${message}`);
    
    // 2. Notifica a UI
    this.notifyListeners();
  }

  // Métodos Públicos de Log --------------------------------------------------
  // [CORRIGIDO] Agora usam o método logInternal centralizado.

  public logThought(message: string, type: 'info' | 'error' = 'info'): void {
    const prefix = type === 'error' ? '[🧠 THOUGHT-ERROR]' : '[🧠 THOUGHT]';
    if(type === 'error') {
        console.error(`${prefix} ${message}`);
    }
    this.logInternal(this.thoughts, message, prefix);
  }

  public logConcept(concept: string): void {
    const message = `Novo conceito assimilado: "${concept}"`;
    this.logInternal(this.concepts, message, '[💡 CONCEPT]');
  }

  public logReflection(reflection: string): void {
    this.logInternal(this.reflections, reflection, '[🔍 REFLECTION]');
  }

  // Métodos de Acesso aos Dados ----------------------------------------------

  public getState(limit: number = INITIAL_LOG_LIMIT): MonitorState {
    return {
      thoughts: this.thoughts.slice(0, limit),
      concepts: this.concepts.slice(0, limit),
      reflections: this.reflections.slice(0, limit),
      isEnabled: this.enabled,
      userId: this.userId,
    };
  }

  public clearLogs(): void {
    this.thoughts.length = 0;
    this.concepts.length = 0;
    this.reflections.length = 0;
    console.info('[CognitiveMonitor] Todos os logs foram limpos.');
    
    // Notifica a UI que os logs foram limpos
    this.notifyListeners();
  }

  // Padrão Singleton ---------------------------------------------------------
  private static instance: CognitiveMonitorService;

  public static getInstance(): CognitiveMonitorService {
    if (!CognitiveMonitorService.instance) {
      // FIX: Corrected typo from CognitiveMonitorSercice to CognitiveMonitorService
      CognitiveMonitorService.instance = new CognitiveMonitorService();
    }
    return CognitiveMonitorService.instance;
  }
}

// Exportação Singleton
export const cognitiveMonitor = CognitiveMonitorService.getInstance();
