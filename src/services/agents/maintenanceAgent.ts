import { db } from '@/services/indexedDBService';
import * as cognitiveUpdater from '@/services/cognitiveModules/cognitiveUpdater';
import { selfReflection } from '@/services/selfReflection';
import { reasoningEngine } from '@/services/reasoningEngine';
import { webSearchService } from '@/services/webSearchService';
import { integrateWebKnowledge } from '@/services/cognitiveModules/knowledgeIntegrator';
import { selfProgrammingService } from '@/services/selfProgrammingService';
import type { OrchestratorOptions, CodeModificationProposal, AssistantStatus } from '@/types';

type PresentProposalFn = (proposal: CodeModificationProposal, goal: string) => void;

export class MaintenanceAgent {
    private isBusy = false;
    private opts: OrchestratorOptions;

    constructor(opts: OrchestratorOptions) {
        this.opts = opts;
    }
    
    private setAgentStatus(status: AssistantStatus) {
        window.dispatchEvent(new CustomEvent('nexus-agent-status-update', {
            detail: { status },
        }));
    }


    public async runMaintenanceCycle(presentProposalFn: PresentProposalFn): Promise<void> {
        if (this.isBusy) {
            console.log('[MaintenanceAgent] Cycle already in progress. Skipping.');
            return;
        }

        const settings = await db.getSettings(this.opts.userId);
        if (!settings.behavior.enableBackgroundMaintenance) {
            console.log('[MaintenanceAgent] Background maintenance is disabled. Skipping cycle.');
            return;
        }

        this.isBusy = true;
        this.setAgentStatus('SELF_ANALYSIS');
        console.log('[MaintenanceAgent] Starting proactive maintenance cycle...');
        window.dispatchEvent(new CustomEvent('nexus-thought-update', {
            detail: { type: 'symbolic_log', text: 'Iniciando ciclo de manutenção e aprendizado...' },
        }));

        try {
            // 1. Manutenção Cognitiva
            console.log('[MaintenanceAgent] Running cognitive maintenance...');
            await cognitiveUpdater.runCognitiveMaintenance(this.opts.userId);

            // 2. Auto-Reflexão para Otimização de Código
            if (settings.behavior.permissions.allowSelfModification) {
                console.log('[MaintenanceAgent] Running proactive reflection for self-improvement...');
                const improvementGoal = await selfReflection.runProactiveAnalysis(this.opts.userId, this.opts.generateResponse);
                if (improvementGoal) {
                    this.setAgentStatus('REWRITING_CODE');
                    const proposal = await selfProgrammingService.proposeCodeModification(this.opts.userId, improvementGoal, 'nexusCore.ts', '/* Conceptual code for handling user turns and cognitive pipeline */');
                    if (proposal) {
                        presentProposalFn(proposal, improvementGoal);
                    }
                }
            }
            
            // 3. Pesquisa Temática
            if (settings.behavior.permissions.allowApiAccess) {
                this.setAgentStatus('THINKING');
                console.log('[MaintenanceAgent] Generating research topic...');
                const researchTopic = await reasoningEngine.generateResearchTopic(this.opts.userId, this.opts.generateResponse);
                if (researchTopic) {
                    this.setAgentStatus('SEARCHING_WEB');
                    console.log(`[MaintenanceAgent] Researching topic: "${researchTopic}"`);
                    // FIX: Add missing arguments to the search call.
                    const searchResult = await webSearchService.search(this.opts.userId, researchTopic, "Proactive research during maintenance cycle.");
                    if (searchResult) {
                        await integrateWebKnowledge(this.opts.userId, researchTopic, searchResult.summary, searchResult.sources);
                    }
                }
            }

            console.log('[MaintenanceAgent] Maintenance cycle complete.');

        } catch (error) {
            console.error('[MaintenanceAgent] Error during maintenance cycle:', error);
            this.setAgentStatus('ERROR');
            window.dispatchEvent(new CustomEvent('nexus-thought-update', {
                detail: { type: 'error', text: 'Erro no ciclo de manutenção.' },
            }));
        } finally {
            this.isBusy = false;
            this.setAgentStatus('IDLE');
        }
    }
}