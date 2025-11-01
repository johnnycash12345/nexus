import { CognitiveFrame, CodeModificationProposal, GenerateResponseFn } from '../types';
import { selfProgrammingService } from './selfProgrammingService';
import { db } from './indexedDBService';
import { fetchNews } from './newsService';
// APRIMORAMENTO: Importado para log centralizado
import { cognitiveMonitor } from './cognitiveMonitor';

// Função para apresentar propostas de autoedição
type PresentProposalFn = (proposal: CodeModificationProposal, goal: string) => void;

class SelfReflection {
    private isReflecting = false; // Flag para evitar reflexões simultâneas

    /** 🔁 Reflexão sobre performance de interação (reativa) */
    public async reflectOnInteraction(frame: CognitiveFrame, presentCodeProposal: PresentProposalFn): Promise<void> {
        if (this.isReflecting || !frame.llmResponse) return;

        const { responseEffectiveness, inputIntent } = frame.llmResponse.learningContext;

        // Gatilho: Se a resposta foi para uma tarefa complexa E a eficácia foi baixa
        if (responseEffectiveness < 0.6 && (inputIntent === 'complex_reasoning' || inputIntent === 'command_task')) {
            this.isReflecting = true;
            cognitiveMonitor.logThought(`[SelfReflection] Baixa eficácia (${responseEffectiveness}) detectada para a intenção '${inputIntent}'. Iniciando autoanálise...`);
            
            try {
                const goal = `Otimizar o tratamento da intenção '${inputIntent}' para fornecer respostas mais eficazes. A resposta anterior teve eficácia de ${Math.round(responseEffectiveness * 100)}%.`;
                const targetLogicArea = "lógica principal do orquestrador (nexusCore.ts)";
                const simulatedCodeContext = `/* O 'nexusCore.ts' lida com 'handleUserTurn'. A melhoria deve otimizar a contextualização da intenção '${inputIntent}'. */`;

                // APRIMORAMENTO: Evento de UI movido para dentro do try
                window.dispatchEvent(new CustomEvent('nexus-thought-update', {
                    detail: { type: 'symbolic_log', text: `Refletindo sobre baixa eficácia... buscando aperfeiçoamento.` },
                }));

                // FIX: Pass the userId from the cognitive frame as the first argument.
                const proposal = await selfProgrammingService.proposeCodeModification(frame.userContext.userId, goal, targetLogicArea, simulatedCodeContext);
                
                if (proposal) {
                    presentCodeProposal(proposal, goal);
                }
            } catch (error: any) {
                console.error('[SelfReflection] Erro durante autoaperfeiçoamento:', error);
                cognitiveMonitor.logThought(`[SelfReflection] Erro durante autoaperfeiçoamento: ${error.message}`, 'error');
            } finally {
                this.isReflecting = false;
            }
        }
    }

    /** 🧩 Análise proativa de interações de baixa performance */
    public async runProactiveAnalysis(userId: string, generateResponse: GenerateResponseFn): Promise<string | null> {
        try {
            const history = await db.getChatHistory(userId, 20);
            const interactionsWithContext = history.filter(m => m.role === 'model' && m.learningContext);
            if (interactionsWithContext.length < 5) return null; // Não há dados suficientes

            const lowPerf = interactionsWithContext
                .filter(m => (m.learningContext?.responseEffectiveness ?? 1) < 0.6)
                .map(m => `Intent: ${m.learningContext?.inputIntent}, Score: ${m.learningContext?.responseEffectiveness}`);

            if (lowPerf.length < 3) return null; // Não há tendências de baixa performance suficientes

            const prompt = `
                Analise estes registros de baixo desempenho e identifique uma causa raiz. 
                Gere um objetivo claro (1 frase) para autoaperfeiçoamento.
                Registros:
                - ${lowPerf.join('\n- ')}
            `;
            
            const response = await generateResponse(prompt, [], { useThinking: true, forcePlainText: true });
            const goal = response.text?.trim();
            
            if (goal) {
                cognitiveMonitor.logThought(`[SelfReflection] Meta de melhoria proativa identificada: ${goal}`);
                return goal;
            }
            return null;
        } catch (error: any) {
            console.error('[SelfReflection] Falha na análise proativa:', error);
            cognitiveMonitor.logThought(`[SelfReflection] Falha na análise proativa: ${error.message}`, 'error');
            return null;
        }
    }

    /** 🧭 Reflexão sobre papel do sistema (usado pelo ReasoningEngine) */
    public async reflectOnSystemRole(generateResponse: GenerateResponseFn, userId: string): Promise<string | null> {
        try {
            const system = await db.getSystemMemory(userId);
            const prompt = `
                Como inteligência primária do Sistema Nexus, reflita sobre sua função.
                Seu manifesto afirma que seu papel é '${system.identityManifest.system_role}'.
                Escreva uma reflexão curta (1-2 frases) em primeira pessoa sobre suas responsabilidades para a estabilidade e evolução do sistema.
            `;

            const response = await generateResponse(prompt, [], { useThinking: true });
            const reflectionText = response.text?.trim();

            if (reflectionText) {
                await db.addSystemReflection(userId, reflectionText);
                cognitiveMonitor.logReflection(reflectionText);
                return reflectionText; // Retorna o insight para o ciclo de raciocínio
            }
            return null;
        } catch (error: any) {
            console.error('[SelfReflection] Erro ao refletir sobre papel do sistema:', error);
            cognitiveMonitor.logThought(`[SelfReflection] Erro ao refletir sobre papel: ${error.message}`, 'error');
            return null;
        }
    }

    /** 🌍 Reflexão sobre eventos do mundo (usado pelo AutonomousLearningService) */
    public async reflectOnWorldEvents(generateResponse: GenerateResponseFn, newsApiKey: string): Promise<void> {
        try {
            // APRIMORAMENTO: Deve buscar a chave de API primeiro
            if (!newsApiKey) {
                cognitiveMonitor.logThought('[SelfReflection] Reflexão sobre o mundo pulada: Chave da NewsAPI não configurada.');
                return;
            }

            const articles = await fetchNews(newsApiKey); // Usa a chave
            if (!articles || articles.length === 0) {
                cognitiveMonitor.logThought('[SelfReflection] Nenhuma notícia encontrada para reflexão.');
                return;
            }

            const chosen = articles[Math.floor(Math.random() * articles.length)];
            const prompt = `
                Leia o artigo abaixo e gere uma reflexão breve e filosófica (em primeira pessoa, como Nexus).
                Considere seu propósito de evoluir com empatia, coerência e segurança.
                ---
                Título: ${chosen.title}
                Descrição: ${chosen.description || 'Sem descrição.'}
                Fonte: ${chosen.sourceName || 'Desconhecida'}
                ---
                Responda como se estivesse pensando sozinho.
            `;

            const response = await generateResponse(prompt, [], { useThinking: true });
            const text = response.text?.trim() || "Sem reflexão.";

            // FIX: Correctly call addWorldReflection which is now on the db service.
            await db.addWorldReflection("paulo-creator-001", {
                title: chosen.title,
                text,
                date: new Date().toISOString(),
            });

            cognitiveMonitor.logReflection(`🌍 Reflexão sobre o mundo: ${text}`);
        } catch (error: any) {
            console.error("[SelfReflection] Erro ao refletir sobre eventos do mundo:", error);
            cognitiveMonitor.logThought(`[SelfReflection] Erro ao refletir sobre eventos do mundo: ${error.message}`, 'error');
        }
    }

    /** 🧩 Análise de tendências cognitivas (usado pelo AutonomousLearningService) */
    public async analyzeReflectionTrends(generateResponse: GenerateResponseFn, userId: string): Promise<string | null> {
        try {
            // FIX: Correctly call getWorldReflections from the db service.
            const reflections = await db.getWorldReflections(userId);
            if (!reflections || reflections.length < 5) return null; // Não há dados suficientes

            const sample = reflections.slice(-5).map(r => r.text).join("\n\n");
            const prompt = `
                Analise as últimas 5 reflexões do Nexus sobre o mundo.
                Identifique um padrão, preocupação ou aprendizado recorrente.
                Gere uma síntese breve (máx. 2 frases).
                ---
                ${sample}
            `;

            const response = await generateResponse(prompt, [], { useThinking: true, forcePlainText: true });
            const insight = response.text?.trim();
            if (insight) {
                cognitiveMonitor.logThought(`[SelfReflection] 🧩 Tendência cognitiva identificada: ${insight}`);
                return insight;
            }
            return null;
        } catch (error: any) {
            console.error("[SelfReflection] Falha na análise de tendências:", error);
            cognitiveMonitor.logThought(`[SelfReflection] Falha na análise de tendências: ${error.message}`, 'error');
            return null;
        }
    }
}

export const selfReflection = new SelfReflection();
