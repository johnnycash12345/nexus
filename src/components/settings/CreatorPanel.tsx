import React, { useState, useEffect } from 'react';
import { AppSettings, AssistantStatus, DecisionLogEntry } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '@/services/indexedDBService';
import { decisionLogService } from '@/services/decisionLogService';

const ToggleSetting: React.FC<{ id: string; title: string; description: string; checked: boolean; onChange: (value: boolean) => void; }> = ({ id, title, description, checked, onChange }) => (
    <label htmlFor={id} className="flex items-center justify-between p-3 bg-gray-900/50 hover:bg-gray-700/50 rounded-md cursor-pointer transition-colors">
        <div>
            <p className="font-medium text-white">{title}</p>
            <p className="text-sm text-gray-400">{description}</p>
        </div>
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="toggle-checkbox" />
    </label>
);

const MetricCard: React.FC<{ label: string; value: string; icon: React.ReactNode }> = ({ label, value, icon }) => (
    <div className="bg-gray-900/50 p-4 rounded-lg flex items-center gap-4">
        <div className="flex-shrink-0 w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-cyan-400">
            {icon}
        </div>
        <div>
            <p className="text-sm text-gray-400">{label}</p>
            <p className="text-lg font-bold text-white">{value}</p>
        </div>
    </div>
);

interface CreatorPanelProps {
    settings: AppSettings;
    setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
    userId: string;
}

const DecisionLogItem: React.FC<{ log: DecisionLogEntry }> = ({ log }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    const logStyles = {
        CODE_PROPOSAL: { icon: '💻', color: 'text-purple-400', bg: 'bg-purple-900/30' },
        AUTONOMOUS_SEARCH: { icon: '🌐', color: 'text-blue-400', bg: 'bg-blue-900/30' },
        CONCEPT_MERGE: { icon: '🧠', color: 'text-yellow-400', bg: 'bg-yellow-900/30' },
    };

    const style = logStyles[log.decisionType] || { icon: '⚙️', color: 'text-gray-400', bg: 'bg-gray-700/50' };

    return (
        <div className={`p-3 rounded-lg ${style.bg}`}>
            <div className="flex items-start justify-between cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex items-start gap-3">
                    <span className={`text-lg ${style.color}`}>{style.icon}</span>
                    <div>
                        <p className={`font-semibold ${style.color}`}>{log.decisionType.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-gray-400">{new Date(log.timestamp).toLocaleString()}</p>
                    </div>
                </div>
                <svg className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 mt-1 ${isExpanded ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </div>
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginTop: '12px' }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        className="overflow-hidden border-t border-gray-600/50 pt-3"
                    >
                        <p className="text-sm text-gray-300 italic mb-2">"{log.reasoning}"</p>
                        <pre className="bg-gray-900/70 p-2 rounded text-xs text-white overflow-x-auto">
                            <code>{JSON.stringify(log.details, null, 2)}</code>
                        </pre>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// FIX: Add named export for lazy loading compatibility.
export const CreatorPanel: React.FC<CreatorPanelProps> = ({ settings, setSettings, userId }) => {
    const [isForcingCycle, setIsForcingCycle] = useState(false);
    const [fec, setFec] = useState('0.00');
    const [agentStatus, setAgentStatus] = useState<AssistantStatus>('IDLE');
    const [decisionLogs, setDecisionLogs] = useState<DecisionLogEntry[]>([]);
    const [logsVisible, setLogsVisible] = useState(false);

    // Fetch metrics on component mount and set up listeners
    useEffect(() => {
        const fetchMetrics = async () => {
            const memory = await db.getSystemMemory(userId);
            const synapses = memory.synapses || [];
            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;
            const newSynapses = synapses.filter(s => s.createdAt && (now - s.createdAt < oneDay));
            const factor = newSynapses.length / 24;
            setFec(`${factor.toFixed(2)} sinapses/h`);
        };
        
        const fetchLogs = () => {
             decisionLogService.getLogs(userId).then(setDecisionLogs);
        }

        fetchMetrics();
        fetchLogs();

        const handleStatusUpdate = (event: CustomEvent<{ status: AssistantStatus }>) => setAgentStatus(event.detail.status);
        const handleLogUpdate = () => fetchLogs();
        
        window.addEventListener('nexus-agent-status-update', handleStatusUpdate as EventListener);
        window.addEventListener('nexus-decision-log-updated', handleLogUpdate);

        return () => {
            window.removeEventListener('nexus-agent-status-update', handleStatusUpdate as EventListener);
            window.removeEventListener('nexus-decision-log-updated', handleLogUpdate);
        };
    }, [userId]);

    const handleNestedSettingChange = (subField: keyof AppSettings['behavior'], value: boolean) => {
        setSettings(prev => ({
            ...prev,
            behavior: { ...prev.behavior, [subField]: value },
        }));
    };
    
    const handlePermissionChange = (subField: keyof AppSettings['behavior']['permissions'], value: boolean) => {
        setSettings(prev => ({
            ...prev,
            behavior: {
                ...prev.behavior,
                permissions: { ...prev.behavior.permissions, [subField]: value }
            }
        }));
    };

    const handleForceEvolution = () => {
        setIsForcingCycle(true);
        window.dispatchEvent(new CustomEvent('nexus-force-evolution'));
        // The agent will set its own status, this timeout is a fallback
        setTimeout(() => setIsForcingCycle(false), 10000); 
    };

    return (
        <div className="max-w-xl mx-auto">
             <section className="mb-8">
                <h3 className="text-lg font-semibold text-cyan-300 mb-4 border-b border-gray-600 pb-2">Controles de Evolução</h3>
                <div className="space-y-4">
                    <ToggleSetting
                        id="enableAutonomousLearning" title="Aprendizado Pós-Interação"
                        description="Ativa a pesquisa e aprendizado após respostas complexas ou de baixa eficácia."
                        checked={settings.behavior.enableAutonomousLearning}
                        onChange={(v) => handleNestedSettingChange('enableAutonomousLearning', v)}
                    />
                    <ToggleSetting
                        id="enableBackgroundMaintenance" title="Manutenção Proativa em Fundo"
                        description="Permite que o Nexus estude e se otimize durante a inatividade."
                        checked={settings.behavior.enableBackgroundMaintenance}
                        onChange={(v) => handleNestedSettingChange('enableBackgroundMaintenance', v)}
                    />
                     <ToggleSetting
                        id="enableSelfProgramming" title="⚠️ Auto-Programação Ativada"
                        description="Permissão mestre para o Nexus propor e aplicar modificações em seu próprio código."
                        checked={settings.behavior.permissions.allowSelfModification}
                        onChange={(v) => handlePermissionChange('allowSelfModification', v)}
                    />
                </div>
             </section>

             <section className="mb-8">
                <h3 className="text-lg font-semibold text-cyan-300 mb-4 border-b border-gray-600 pb-2">Métricas de Observabilidade</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <MetricCard label="Fator de Expansão Cognitiva (FEC)" value={fec} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342a3.5 3.5 0 110-2.684m0 2.684l6.632 3.316m-6.632-6.002l6.632-3.316" /></svg>} />
                     <MetricCard label="Status do Agente Principal" value={agentStatus} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M12 6V3m0 18v-3" /></svg>} />
                     <MetricCard label="Taxa de Sucesso (Auto-Prog.)" value={"0 / 0 (0%)"} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>} />
                 </div>
             </section>

             <section className="mb-8">
                <h3 className="text-lg font-semibold text-cyan-300 mb-4 border-b border-gray-600 pb-2">Ações Manuais</h3>
                <button
                    onClick={handleForceEvolution} disabled={isForcingCycle}
                    className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-wait rounded-md transition-colors font-semibold flex items-center justify-center gap-2"
                >
                    {isForcingCycle ? <><div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin"></div> Ciclo em Andamento...</> : 'Forçar Ciclo de Evolução Agora'}
                </button>
                <p className="text-xs text-gray-400 mt-2 text-center">Inicia manualmente o ciclo de manutenção, reflexão e aprendizado.</p>
             </section>
             
             <section>
                <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                    <button onClick={() => setLogsVisible(!logsVisible)} className="flex justify-between items-center w-full text-left">
                        <h4 className="font-semibold text-white">Log de Decisão e Auditoria</h4>
                        <svg className={`w-5 h-5 text-gray-400 transition-transform ${logsVisible ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    <AnimatePresence>
                    {logsVisible && (
                        <motion.div initial={{ opacity: 0, height: 0, marginTop: 0 }} animate={{ opacity: 1, height: 'auto', marginTop: '16px' }} exit={{ opacity: 0, height: 0, marginTop: 0 }} className="overflow-hidden">
                            <div className="border-t border-gray-700 pt-4 space-y-3 max-h-64 overflow-y-auto pr-2">
                                {decisionLogs.length > 0 ? (
                                    decisionLogs.map(log => <DecisionLogItem key={log.id} log={log} />)
                                ) : (
                                    <p className="text-sm text-gray-500 text-center py-4">Nenhuma decisão crítica registrada ainda.</p>
                                )}
                            </div>
                        </motion.div>
                    )}
                    </AnimatePresence>
                 </div>
             </section>
        </div>
    );
};

export default CreatorPanel;
