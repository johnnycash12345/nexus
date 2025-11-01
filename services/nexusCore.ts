import { 
    CognitiveFrame, 
    CodeModificationProposal, 
    GenerateResponseFn, 
    AppSettings,
    UserContext,
    LlmCognitiveResponse
} from '@/types';

// APRIMORAMENTO 10x: Importamos as *interfaces* dos serviços, não as implementações.
// Isso torna a classe 100% testável e desacoplada.
import { ISelfProgrammingService } from './selfProgrammingService';
import { IDatabase } from './indexedDBService';
import { INewsService } from './newsService';
import { ICognitiveMonitor } from './cognitiveMonitor';

// APRIMORAMENTO 10x (Ponto 6): Importamos o sistema de auto-reparo para validação.
import { ISelfRepairSystem } from './selfRepairSystem'; 
// APRIMORAMENTO 10x (Ponto 1): Importamos o tracker de performance (hipotético).
import { IPerformanceTracker } from './performanceTracker';

// Função para apresentar propostas de autoedição (agora injetada)
type PresentProposalFn = (proposal: CodeModificationProposal, goal: string) => void;

/**
 * APRIMORAMENTO 10x: Definimos todas as dependências que a classe SelfReflection
 * precisa para operar. Elas serão injetadas pelo Orquestrador.
 */
export interface SelfReflectionDependencies {
    userContext: UserContext;
    generateResponse: GenerateResponseFn;
    presentCodeProposal: PresentProposalFn;
    getSettings: () => Promise<AppSettings>;
    // Serviços Externos
    db: IDatabase;
    cognitiveMonitor: ICognitiveMonitor;
    selfProgrammingService: ISelfProgrammingService;
    fetchNews: INewsService;
    selfRepairSystem: ISelfRepairSystem;
    performanceTracker: IPerformanceTracker;
}

/**
 * APRIMORAMENTO 10x: Esta é agora uma classe de instância pura.
 * Ela não é mais um singleton e depende de injeção de dependência.
 * Ela agora encapsula toda a lógica de "pensar sobre si mesmo".
 */
export class SelfReflection {
    private deps: SelfReflectionDependencies;
    private activeReflections = new Set<string>(); // Trava robusta contra race conditions

    constructor(dependencies: SelfReflectionDependencies) {
        this.deps = dependencies;
    }

    // --- Processos de Reflexão Reativa (Pós-Interação) ---

    /**
     * 🔁 APRIMORAMENTO 10x (Pontos 1, 6, 9, 10): Reflexão sobre performance de interação.
     * Agora inclui auto-validação, auto-proteção e auto-ajuste.
     */
    public async reflectOnInteraction(frame: CognitiveFrame): Promise<void> {
        const reflectionType = 'interaction_feedback';
        if (this.activeReflections.has(reflectionType) || !frame.llmResponse) return;

        const { responseEffectiveness, inputIntent } = frame.llmResponse.learningContext;
        const settings = await this.deps.getSettings();
        const effectivenessThreshold = settings.cognitive?.reflectionEffectivenessThreshold ?? 0.6;
        const isComplexIntent = (inputIntent === 'complex_reasoning' || inputIntent === 'command_task');

        if (responseEffectiveness < effectivenessThreshold && isComplexIntent) {
            this.activeReflections.add(reflectionType);
            this.setReflectiveMode(true); // PONTO 10: Ativa o modo "pensativo"
            this.deps.cognitiveMonitor.logThought(`[SelfReflection] Baixa eficácia (${responseEffectiveness}) detectada para '${inputIntent}'. Iniciando autoanálise...`);
            
            try {
                // PONTO 9 (Trigger): Dispara um auto-ajuste
                this.triggerSelfTuningCheck(responseEffectiveness);

                const goal = `Otimizar o tratamento da intenção '${inputIntent}'. A resposta anterior teve eficácia de ${Math.round(responseEffectiveness * 100)}%.`;
                
                // Desacoplado: O serviço de programação agora diagnostica o contexto
                const diagnosticContext = JSON.stringify({
                    analysisGoal: goal,
                    failedFrameContext: {
                        userInput: frame.userInput,
                        intent: inputIntent,
                        llmResponse: frame.llmResponse.text,
                        retrievedConcepts: frame.retrievedConcepts?.map(c => c.name),
                    }
                }, null, 2);

                this.dispatchThoughtUpdate(`Refletindo sobre baixa eficácia... buscando aperfeiçoamento.`);

                const proposal = await this.deps.selfProgrammingService.proposeCodeModification(
                    goal, 
                    "auto-diagnose: cognitive-pipeline",
                    diagnosticContext
                );
                
                if (proposal) {
                    // PONTO 6 (Self-Protection): Valida a proposta antes de apresentá-la
                    if (await this.deps.selfRepairSystem.validateProposal(proposal)) {
                        this.deps.presentCodeProposal(proposal, goal);
                    } else {
                        this.deps.cognitiveMonitor.logThought('🚫 Proposta de auto-modificação rejeitada por risco de integridade.', 'error');
                    }
                }
            } catch (error) {
                this.handleError('autoaperfeiçoamento', error);
            } finally {
                this.activeReflections.delete(reflectionType);
                this.setReflectiveMode(false); // PONTO 10: Desativa o modo "pensativo"
            }
        }
    }

    // --- Processos de Reflexão Proativa (Agendados) ---

    /**
     * 🧩 APRIMORAMENTO 10x (Ponto 5): Análise proativa (para ser chamada por um Scheduler).
     */
    public async runProactiveAnalysis(): Promise<string | null> {
        const reflectionType = `proactive_analysis_${this.deps.userContext.userId}`;
        if (this.activeReflections.has(reflectionType)) return null;
        
        this.activeReflections.add(reflectionType);
        this.setReflectiveMode(true);
        
        try {
            const { userId, generateResponse } = this.deps;
            const settings = await this.deps.getSettings();
            const historyCount = 20;
            const interactionThreshold = settings.cognitive?.reflectionMinInteractions ?? 5;
            const lowPerfThreshold = settings.cognitive?.reflectionMinLowPerf ?? 3;
            const effectivenessThreshold = settings.cognitive?.reflectionEffectivenessThreshold ?? 0.6;

            const history = await this.deps.db.getChatHistory(userId, historyCount);
            const interactions = history.filter(m => m.role === 'model' && m.learningContext);
            if (interactions.length < interactionThreshold) return null;

            const lowPerf = interactions
                .filter(m => (m.learningContext?.responseEffectiveness ?? 1) < effectivenessThreshold)
                .map(m => `Intent: ${m.learningContext?.inputIntent}, Score: ${m.learningContext?.responseEffectiveness}`);

            if (lowPerf.length < lowPerfThreshold) return null;

            const prompt = `... (prompt de análise proativa) ...`;
            const response = await generateResponse(prompt, [], { useThinking: true, forcePlainText: true });
            const goal = response.text?.trim();
            
            if (goal) {
                this.deps.cognitiveMonitor.logThought(`[SelfReflection] Meta de melhoria proativa identificada: ${goal}`);
                return goal;
            }
            return null;
        } catch (error) {
            this.handleError('análise proativa', error);
            return null;
        } finally {
            this.activeReflections.delete(reflectionType);
            this.setReflectiveMode(false);
        }
    }

    /** 🧭 Reflexão sobre papel do sistema (usado pelo ReasoningEngine) */
    public async reflectOnSystemRole(): Promise<string | null> {
        // ... (lógica movida para usar this.deps.db, this.deps.generateResponse, etc.) ...
        // (O código interno deste método não precisa mudar muito, apenas as chamadas)
        try {
            const system = await this.deps.db.getSystemMemory(this.deps.userContext.userId);
            const prompt = `...`;
            const response = await this.deps.generateResponse(prompt, [], { useThinking: true });
            const reflectionText = response.text?.trim();
            if (reflectionText) {
                await this.deps.db.addSystemReflection(this.deps.userContext.userId, reflectionText);
                this.deps.cognitiveMonitor.logReflection(reflectionText);
                return reflectionText;
            }
            return null;
        } catch (error) {
            this.handleError('reflexão sobre papel', error);
            return null;
        }
    }

    /** 🌍 Reflexão sobre eventos do mundo (usado pelo AutonomousLearningService) */
    public async reflectOnWorldEvents(): Promise<void> {
        // ... (lógica movida para usar this.deps.getSettings, this.deps.fetchNews, etc.) ...
        try {
            const settings = await this.deps.getSettings();
            const apiKey = settings.apiKeys?.newsApiKey;
            if (!apiKey) return;

            const articles = await this.deps.fetchNews(apiKey);
            // ... (resto da lógica) ...
        } catch (error) {
            this.handleError('reflexão sobre eventos do mundo', error);
        }
    }

    /** 🧩 Análise de tendências cognitivas (usado pelo AutonomousLearningService) */
    public async analyzeReflectionTrends(): Promise<string | null> {
        // ... (lógica movida para usar this.deps.db, this.deps.generateResponse, etc.) ...
        try {
            const reflections = await this.deps.db.getWorldReflections(this.deps.userContext.userId);
            // ... (resto da lógica) ...
            return null;
        } catch (error) {
            this.handleError('análise de tendências', error);
            return null;
        }
    }

    // --- APRIMORAMENTO 10x: Implementação dos Pontos do Roadmap ---

    /**
     * 🧠 PONTO 3: Meta-reflexão (refletir sobre as próprias reflexões)
     */
    public async runMetaReflection(): Promise<void> {
        const reflectionType = `meta_reflection_${this.deps.userContext.userId}`;
        if (this.activeReflections.has(reflectionType)) return;

        this.activeReflections.add(reflectionType);
        this.setReflectiveMode(true);
        this.deps.cognitiveMonitor.logThought("[SelfReflection] Iniciando ciclo de Meta-Reflexão...");

        try {
            const [reflections, patterns] = await Promise.all([
                this.deps.db.getSystemReflections(this.deps.userContext.userId, 10),
                this.deps.db.getReflectionPatterns(this.deps.userContext.userId, 5) // Ponto 2
            ]);

            if (reflections.length < 5) return;

            const prompt = `
                Analise suas 10 últimas reflexões internas e seus 5 padrões de aprendizado mais recentes.
                Reflexões: ${reflections.map(r => `"${r}"`).join(', ')}
                Padrões: ${patterns.map(p => `[Trigger: ${p.trigger}, Ação: ${p.action}, Sucesso: ${p.successRate * 100}%]`).join(', ')}
                
                Gere uma autocrítica construtiva: Você está se tornando mais eficiente? Mais empático?
                Está caindo em algum loop de pensamento?
            `;
            const meta = await this.deps.generateResponse(prompt, [], { useThinking: true });
            this.deps.cognitiveMonitor.logReflection(`🪞 Meta-reflexão: ${meta.text}`);

        } catch (error) {
            this.handleError('meta-reflexão', error);
        } finally {
            this.activeReflections.delete(reflectionType);
            this.setReflectiveMode(false);
        }
    }

    /**
     * 📊 PONTO 1: Loop de Auto-Validação (Stub)
     * (Seria chamado pelo Orquestrador após uma mudança ser aplicada e novos dados coletados)
     */
    public async validateLastReflectionImpact(frame: CognitiveFrame, oldEffectiveness: number): Promise<void> {
        const newEffectiveness = await this.deps.db.getAverageEffectiveness(this.deps.userContext.userId, frame.llmResponse.learningContext.inputIntent);
        
        const impact = await this.deps.performanceTracker.compareMetrics(this.deps.userContext.userId, {
            before: oldEffectiveness,
            after: newEffectiveness
        });

        if (impact.delta > 0.1) {
            this.deps.cognitiveMonitor.logThought(`[SelfReflection] ✅ MELHORIA VALIDADA. Impacto: +${(impact.delta * 100).toFixed(0)}%`);
            // PONTO 2: Salva o padrão de sucesso
            await this.deps.db.addReflectionPattern({
                trigger: frame.llmResponse.learningContext.inputIntent,
                action: 'otimização de pipeline', // Genérico por enquanto
                successRate: 0.9, // Assumindo sucesso
                lastUsed: Date.now()
            });
        }
    }
    
    /**
     * 🔄 PONTO 9: Auto-Ajuste (Self-Tuning) (Stub)
     */
    private async triggerSelfTuningCheck(currentEffectiveness: number): Promise<void> {
        const settings = await this.deps.getSettings();
        const avg = await this.deps.db.getAverageEffectiveness(this.deps.userContext.userId);

        // Se a média geral está caindo...
        if (avg < 0.5) {
            // ...torne o sistema mais agressivo ao aprender.
            const newThreshold = Math.max(0.4, (settings.cognitive.reflectionEffectivenessThreshold ?? 0.6) - 0.05);
            // (Esta lógica deveria, na verdade, estar no 'nexusCore' ou 'SelfTuningService')
            this.deps.cognitiveMonitor.logThought(`[SelfTuning] Média de eficácia caiu para ${avg}. Ajustando limiar de reflexão para ${newThreshold}.`);
        }
    }

    // --- Helpers ---

    /** 💫 PONTO 10: Dispara o evento de UI "modo pensativo" */
    private setReflectiveMode(isReflecting: boolean): void {
        window.dispatchEvent(new CustomEvent('nexus-state-update', { 
            detail: { mode: isReflecting ? 'reflective' : 'idle' }
        }));
    }

    private dispatchThoughtUpdate(text: string): void {
         window.dispatchEvent(new CustomEvent('nexus-thought-update', {
            detail: { type: 'symbolic_log', text },
        }));
    }
    
    /** Helper centralizado para log de erros. */
    private handleError(context: string, error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[SelfReflection] Erro durante ${context}:`, error);
        this.deps.cognitiveMonitor.logThought(`[SelfReflection] Erro em ${context}: ${errorMsg}`, 'error');
    }
}