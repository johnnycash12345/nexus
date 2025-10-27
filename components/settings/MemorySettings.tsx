

import React from 'react';
import { Concept } from '../../types';
import { db } from '../../services/indexedDBService';

interface MemorySettingsProps {
    token: string | null;
    onLogout: () => void;
    concepts: Concept[];
    setConcepts: React.Dispatch<React.SetStateAction<Concept[]>>;
}

export const MemorySettings: React.FC<MemorySettingsProps> = ({ token, onLogout, concepts, setConcepts }) => {
    
    const handleDeleteConcept = async (name: string) => {
      if(window.confirm(`Tem certeza que quer que o Nexus esqueça sobre "${name}"?`)){
        await db.deleteConcept(name);
        setConcepts(await db.getAllConcepts());
      }
    };

    const handleLogoutClick = () => {
        if (window.confirm('Tem certeza de que deseja desconectar sua conta do Google? A sincronização automática será interrompida.')) {
            onLogout();
        }
    }
    
    const handleClearHistory = async () => {
        if (window.confirm('Tem certeza que deseja apagar todo o histórico de conversas? Esta ação não pode ser desfeita.')) {
            await db.clearChatHistory();
            alert('Histórico de conversas apagado. A aplicação será recarregada.');
            window.location.reload();
        }
    };

    const handleResetMemory = async () => {
        if (window.confirm('ATENÇÃO: Você tem certeza que deseja resetar TODA a memória do Nexus? Isso inclui conceitos, perfil de usuário, diário e histórico. Esta ação não pode ser desfeita.')) {
            await db.resetNexusMemory();
            alert('Memória do Nexus resetada. A aplicação será recarregada.');
            window.location.reload();
        }
    };

    const handleExportMemory = async () => {
        try {
            const [profile, diary, system, concepts, chatHistory, tasks] = await Promise.all([
                db.getUserProfile(),
                db.getDiary(),
                db.getSystemMemory(),
                db.getAllConcepts(),
                db.getChatHistory(),
                db.getAllTasks(),
            ]);

            const backupData = {
                profile, diary, system, concepts, chatHistory, tasks,
                meta: {
                    exportedAt: new Date().toISOString(),
                    version: '1.1.0',
                }
            };

            const fileContent = JSON.stringify(backupData, null, 2);
            const blob = new Blob([fileContent], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const today = new Date().toISOString().split('T')[0];
            link.download = `nexus_memory_backup_${today}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Failed to export memory:", error);
            alert("Ocorreu um erro ao exportar a memória.");
        }
    };
    
    const handleExportCognitiveGraph = async () => {
        try {
            const systemMemory = await db.getSystemMemory();
            const synapses = systemMemory?.synapses || [];

            if (synapses.length === 0) {
                alert("Nenhuma sinapse encontrada na memória para exportar.");
                return;
            }

            const nodesSet = new Set<string>();
            synapses.forEach(s => {
                nodesSet.add(s.source);
                nodesSet.add(s.target);
            });

            const graphData = {
                nodes: Array.from(nodesSet).map(node => ({ id: node })),
                edges: synapses.map(s => ({
                    source: s.source,
                    target: s.target,
                    weight: s.strength,
                })),
            };

            const fileContent = JSON.stringify(graphData, null, 2);
            const blob = new Blob([fileContent], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const today = new Date().toISOString().split('T')[0];
            link.download = `nexus_cognitive_graph_${today}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Failed to export cognitive graph:", error);
            alert("Ocorreu um erro ao exportar o grafo cognitivo.");
        }
    };


    const handleImportMemory = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!window.confirm('Tem certeza que deseja importar este arquivo? Isso substituirá TODA a memória atual do Nexus.')) {
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = e.target?.result;
                if (typeof content !== 'string') throw new Error("File content is not readable.");
                const backupData = JSON.parse(content);
                await db.importBackup(backupData);
                alert('Memória importada com sucesso! A aplicação será recarregada.');
                window.location.reload();
            } catch (error: any) {
                console.error("Failed to import memory:", error);
                alert(`Ocorreu um erro ao importar o arquivo: ${error.message}`);
            } finally {
                event.target.value = '';
            }
        };
        reader.onerror = () => {
            alert("Erro ao ler o arquivo de backup.");
            event.target.value = '';
        };
        reader.readAsText(file);
    };

    const handleImportCognitiveGraph = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!window.confirm('Tem certeza que deseja importar este grafo? As novas conexões serão mescladas com a memória existente.')) {
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = e.target?.result;
                if (typeof content !== 'string') throw new Error("File content is not readable.");
                const graphData = JSON.parse(content);
                await db.importCognitiveGraph(graphData);
                alert('Grafo cognitivo importado com sucesso! A aplicação será recarregada.');
                window.location.reload();
            } catch (error: any) {
                console.error("Failed to import cognitive graph:", error);
                alert(`Ocorreu um erro ao importar o grafo: ${error.message}`);
            } finally {
                event.target.value = '';
            }
        };
        reader.onerror = () => {
            alert("Erro ao ler o arquivo de grafo.");
            event.target.value = '';
        };
        reader.readAsText(file);
    };

    return (
        <div>
            <div className="p-3 bg-gray-700 rounded-md mb-4">
                <p className="font-medium text-white">Sincronização com Google Drive</p>
                 {token ? (
                    <>
                        <p className="text-sm text-green-400 mb-3">Conectado. A memória é sincronizada automaticamente.</p>
                        <button onClick={handleLogoutClick} className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md transition-colors">
                            Logout do Google
                        </button>
                    </>
                ) : (
                    <>
                        <p className="text-sm text-gray-400 mb-3">A sincronização na nuvem está desativada.</p>
                        <p className="text-xs text-gray-400">Para ativar, reinicie a aplicação e faça login com o Google na tela inicial.</p>
                    </>
                )}
            </div>

            <div>
                <h4 className="text-md font-semibold text-cyan-300 mb-2">Backup Local</h4>
                <div className="p-3 bg-gray-700/50 border border-gray-600/50 rounded-md space-y-3">
                    <p className="text-xs text-gray-400">
                        Salve um arquivo da memória completa do Nexus no seu dispositivo ou restaure a partir de um arquivo salvo anteriormente.
                    </p>
                    <div className="flex gap-2">
                        <button 
                            onClick={handleExportMemory} 
                            className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md transition-colors text-sm font-medium"
                        >
                            Exportar Memória
                        </button>
                        <label 
                            htmlFor="import-backup" 
                            className="w-full px-4 py-2 bg-cyan-700 hover:bg-cyan-600 rounded-md transition-colors text-sm font-medium text-center cursor-pointer"
                        >
                            Importar Memória
                        </label>
                        <input id="import-backup" type="file" accept=".json,application/json" className="hidden" onChange={handleImportMemory} />
                    </div>
                </div>
            </div>

            <div>
                <h4 className="text-md font-semibold text-cyan-300 mb-2 mt-4">Visualização Cognitiva</h4>
                <div className="p-3 bg-gray-700/50 border border-gray-600/50 rounded-md space-y-3">
                    <p className="text-xs text-gray-400">
                        Exporte ou importe a rede de sinapses do Nexus. Útil para transferir o conhecimento evoluído para uma nova instância ou para visualização.
                    </p>
                    <div className="flex gap-2">
                        <button 
                            onClick={handleExportCognitiveGraph} 
                            className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md transition-colors text-sm font-medium"
                        >
                            Exportar Grafo
                        </button>
                        <label 
                            htmlFor="import-graph" 
                            className="w-full px-4 py-2 bg-cyan-700 hover:bg-cyan-600 rounded-md transition-colors text-sm font-medium text-center cursor-pointer"
                        >
                            Importar Grafo
                        </label>
                        <input id="import-graph" type="file" accept=".json,application/json" className="hidden" onChange={handleImportCognitiveGraph} />
                    </div>
                </div>
            </div>
            
            <h3 className="text-lg font-semibold text-cyan-300 mb-2 mt-6">Memória do Nexus (Conceitos)</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 mb-4 border-b border-gray-700 pb-4">
                {concepts.length > 0 ? concepts.map(c => (
                    <div key={c.name} className="bg-gray-700 p-3 rounded-md">
                        <div className="flex justify-between items-start">
                           <div>
                             <p className="font-semibold text-white capitalize">{c.name}</p>
                             <p className="text-sm text-gray-400">Confiança: {Math.round((c.confidence || 0) * 100)}%</p>
                           </div>
                           <button onClick={() => handleDeleteConcept(c.name)} className="text-red-400 hover:text-red-300 text-sm flex-shrink-0 ml-2">Esquecer</button>
                        </div>
                    </div>
                )) : <p className="text-gray-400">O Nexus ainda não aprendeu nenhum conceito.</p>}
            </div>
            
            <div>
                <h4 className="text-md font-semibold text-red-400 mb-2 mt-6">Ações Destrutivas</h4>
                <div className="p-3 bg-gray-700/50 border border-red-500/30 rounded-md space-y-3">
                    <button onClick={handleClearHistory} className="w-full px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-500 rounded-md transition-colors text-sm">
                        Limpar Histórico de Conversas
                    </button>
                    <button onClick={handleResetMemory} className="w-full px-4 py-2 bg-red-800 hover:bg-red-700 disabled:bg-gray-500 rounded-md transition-colors text-sm">
                        Resetar Memória do Nexus
                    </button>
                </div>
            </div>
        </div>
    );
};