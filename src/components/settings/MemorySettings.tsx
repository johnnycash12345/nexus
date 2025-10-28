import React, { useState, useEffect } from 'react';
import { Concept } from '@/types';
import { db } from '@/services/indexedDBService';
import { motion } from 'framer-motion';

interface MemorySettingsProps {
    userId: string;
    token: string | null;
    onLogout: () => void;
}

const SettingsSection: React.FC<{ title: string; children: React.ReactNode, className?: string }> = ({ title, children, className }) => (
    <section className={`mb-8 ${className}`}>
        <h3 className="text-lg font-semibold text-cyan-300 mb-4 border-b border-gray-600 pb-2">{title}</h3>
        <div className="space-y-4">{children}</div>
    </section>
);

export const MemorySettings: React.FC<MemorySettingsProps> = ({ userId, token, onLogout }) => {
    const [concepts, setConcepts] = useState<Concept[]>([]);

    useEffect(() => {
        db.getAllConcepts(userId).then(setConcepts);
    }, [userId]);

    const handleDeleteConcept = async (name: string) => {
      if(window.confirm(`Tem certeza que quer que o Nexus esqueça sobre "${name}"?`)){
        await db.deleteConcept(userId, name);
        setConcepts(await db.getAllConcepts(userId));
      }
    };

    const handleLogoutClick = () => {
        if (window.confirm('Tem certeza de que deseja desconectar sua conta do Google? A sincronização automática será interrompida.')) onLogout();
    }
    
    const handleClearHistory = async () => {
        if (window.confirm('Tem certeza que deseja apagar todo o histórico de conversas? Esta ação não pode ser desfeita.')) {
            await db.clearChatHistory(userId);
            alert('Histórico de conversas apagado. A aplicação será recarregada.');
            window.location.reload();
        }
    };

    const handleResetMemory = async () => {
        if (window.confirm('ATENÇÃO: Você tem certeza que deseja resetar TODA a memória do Nexus? Isso inclui conceitos, perfil de usuário, diário e histórico. Esta ação não pode ser desfeita.')) {
            await db.resetNexusMemory(userId);
            alert('Memória do Nexus resetada. A aplicação será recarregada.');
            window.location.reload();
        }
    };

    const handleExport = async (type: 'memory' | 'graph') => {
        try {
            const isMemory = type === 'memory';
            let data: any;
            if (isMemory) {
                 const [profile, diary, system, concepts, chatHistory, tasks] = await Promise.all([
                    db.getUserProfile(userId), db.getDiary(userId), db.getSystemMemory(userId),
                    db.getAllConcepts(userId), db.getChatHistory(userId), db.getAllTasks(userId),
                ]);
                data = { profile, diary, system, concepts, chatHistory, tasks, meta: { exportedAt: new Date().toISOString(), version: '1.2.0' } };
            } else {
                const systemMemory = await db.getSystemMemory(userId);
                const synapses = systemMemory?.synapses || [];
                if (synapses.length === 0) { alert("Nenhum grafo cognitivo para exportar."); return; }
                const nodesSet = new Set<string>();
                synapses.forEach(s => { nodesSet.add(s.source); nodesSet.add(s.target); });
                data = { nodes: Array.from(nodesSet).map(id => ({ id })), edges: synapses.map(s => ({ source: s.source, target: s.target, weight: s.strength })) };
            }
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `nexus_${type}_backup_${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            URL.revokeObjectURL(link.href);
        } catch (error) {
            console.error(`Failed to export ${type}:`, error);
            alert(`Ocorreu um erro ao exportar os dados.`);
        }
    };

    const handleImport = (event: React.ChangeEvent<HTMLInputElement>, type: 'memory' | 'graph') => {
        const file = event.target.files?.[0];
        if (!file) return;

        const confirmationMsg = type === 'memory' ? 'Isso substituirá TODA a memória atual do Nexus.' : 'As novas conexões serão mescladas com a memória existente.';
        if (!window.confirm(`Tem certeza que deseja importar este arquivo? ${confirmationMsg}`)) {
            event.target.value = ''; return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target?.result as string);
                if (type === 'memory') await db.importBackup(userId, data);
                else await db.importCognitiveGraph(userId, data);
                alert('Dados importados com sucesso! A aplicação será recarregada.');
                window.location.reload();
            } catch (error: any) {
                alert(`Erro ao importar: ${error.message}`);
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="max-w-xl mx-auto">
            <SettingsSection title="Sincronização na Nuvem">
                <div className="p-4 bg-gray-900/50 rounded-md">
                    {token ? (
                        <>
                            <p className="text-sm text-green-400 mb-3">Conectado ao Google Drive. A memória é sincronizada automaticamente.</p>
                            <button onClick={handleLogoutClick} className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md transition-colors">Desconectar do Google</button>
                        </>
                    ) : (
                        <p className="text-sm text-gray-400">A sincronização está desativada. Reinicie e faça login com Google para ativar.</p>
                    )}
                </div>
            </SettingsSection>

            <SettingsSection title="Backup Local">
                <p className="text-sm text-gray-400 -mt-2">Salve ou restaure a memória completa do Nexus, ou apenas sua rede de conhecimento (grafo).</p>
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => handleExport('memory')} className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md transition-colors text-sm font-medium">Exportar Memória</button>
                    <label htmlFor="import-memory" className="w-full px-4 py-2 bg-cyan-700 hover:bg-cyan-600 rounded-md transition-colors text-sm font-medium text-center cursor-pointer">Importar Memória</label>
                    <input id="import-memory" type="file" accept=".json" className="hidden" onChange={(e) => handleImport(e, 'memory')} />
                    <button onClick={() => handleExport('graph')} className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md transition-colors text-sm font-medium">Exportar Grafo</button>
                    <label htmlFor="import-graph" className="w-full px-4 py-2 bg-cyan-700 hover:bg-cyan-600 rounded-md transition-colors text-sm font-medium text-center cursor-pointer">Importar Grafo</label>
                    <input id="import-graph" type="file" accept=".json" className="hidden" onChange={(e) => handleImport(e, 'graph')} />
                </div>
            </SettingsSection>
            
            <SettingsSection title="Memória de Conceitos">
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 rounded-lg bg-gray-900/50 p-2">
                    {concepts.length > 0 ? concepts.sort((a,b) => b.confidence - a.confidence).map(c => (
                        <div key={c.name} className="bg-gray-700/80 p-3 rounded-md flex justify-between items-center">
                            <div>
                                <p className="font-semibold text-white capitalize">{c.name}</p>
                                <div className="w-32 bg-gray-600 rounded-full h-1.5 mt-1"><div className="bg-cyan-500 h-1.5 rounded-full" style={{ width: `${(c.confidence || 0) * 100}%` }}></div></div>
                            </div>
                            <button onClick={() => handleDeleteConcept(c.name)} className="text-red-400 hover:text-red-300 text-xs font-semibold flex-shrink-0 ml-4">ESQUECER</button>
                        </div>
                    )) : <p className="text-gray-400 text-center p-4">O Nexus ainda não aprendeu nenhum conceito.</p>}
                </div>
            </SettingsSection>
            
            <SettingsSection title="Zona de Perigo" className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-300 -mt-2">Ações nesta seção são permanentes e não podem ser desfeitas.</p>
                <button onClick={handleClearHistory} className="w-full px-4 py-2 bg-red-600/50 hover:bg-red-600 rounded-md transition-colors text-sm">Limpar Histórico de Conversas</button>
                <button onClick={handleResetMemory} className="w-full px-4 py-2 bg-red-800/70 hover:bg-red-800 rounded-md transition-colors text-sm">Resetar Toda a Memória do Nexus</button>
            </SettingsSection>
        </div>
    );
};
