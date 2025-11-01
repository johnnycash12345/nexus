import React, { useState, useCallback, useMemo, memo } from 'react';
import { Concept } from '../../types';
import { db } from '../../services/indexedDBService';

// --- Tipos e Interfaces ---

interface MemorySettingsProps {
  userId: string;
  token: string | null;
  onLogout: () => void;
  concepts: Concept[];
  setConcepts: React.Dispatch<React.SetStateAction<Concept[]>>;
}

type LoadingState = {
  exportMemory: boolean;
  importMemory: boolean;
  exportGraph: boolean;
  importGraph: boolean;
  deleteConcept: string | null; // Armazena o nome do conceito sendo deletado
  clearHistory: boolean;
  resetMemory: boolean;
};

// --- Funções Utilitárias ---

/**
 * Lê um arquivo como texto e executa um callback com seu conteúdo.
 */
const handleFileRead = (
  file: File,
  onLoad: (content: string) => Promise<void>,
  onError: (message: string) => void,
  onFinally: () => void
) => {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const content = e.target?.result;
      if (typeof content !== 'string') throw new Error("File content is not readable.");
      await onLoad(content);
    } catch (error: any) {
      console.error("Failed to process file:", error);
      onError(`Ocorreu um erro ao processar o arquivo: ${error.message}`);
    } finally {
      onFinally();
    }
  };
  reader.onerror = () => {
    onError("Erro ao ler o arquivo.");
    onFinally();
  };
  reader.readAsText(file);
};

// --- Componentes Filhos Memoizados ---

const GoogleSyncSection = memo(({ token, onLogout }: { token: string | null, onLogout: () => void }) => {
  const handleLogoutClick = useCallback(() => {
    if (window.confirm('Tem certeza de que deseja desconectar sua conta do Google? A sincronização automática será interrompida.')) {
      onLogout();
    }
  }, [onLogout]);

  return (
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
  );
});

const BackupSection = memo(({ onExport, onImport, isLoadingExport, isLoadingImport }: {
  onExport: () => void,
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void,
  isLoadingExport: boolean,
  isLoadingImport: boolean
}) => (
  <div>
    <h4 className="text-md font-semibold text-cyan-300 mb-2">Backup Local</h4>
    <div className="p-3 bg-gray-700/50 border border-gray-600/50 rounded-md space-y-3">
      <p className="text-xs text-gray-400">
        Salve um arquivo da memória completa do Nexus no seu dispositivo ou restaure a partir de um arquivo salvo anteriormente.
      </p>
      <div className="flex gap-2">
        <button
          onClick={onExport}
          disabled={isLoadingExport || isLoadingImport}
          className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoadingExport ? "Exportando..." : "Exportar Memória"}
        </button>
        <label
          htmlFor="import-backup"
          className={`w-full px-4 py-2 bg-cyan-700 hover:bg-cyan-600 rounded-md transition-colors text-sm font-medium text-center ${isLoadingImport ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {isLoadingImport ? "Importando..." : "Importar Memória"}
        </label>
        <input id="import-backup" type="file" accept=".json,application/json" className="hidden" onChange={onImport} disabled={isLoadingImport} />
      </div>
    </div>
  </div>
));

const CognitiveGraphSection = memo(({ onExport, onImport, isLoadingExport, isLoadingImport }: {
  onExport: () => void,
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void,
  isLoadingExport: boolean,
  isLoadingImport: boolean
}) => (
  <div>
    <h4 className="text-md font-semibold text-cyan-300 mb-2 mt-4">Visualização Cognitiva</h4>
    <div className="p-3 bg-gray-700/50 border border-gray-600/50 rounded-md space-y-3">
      <p className="text-xs text-gray-400">
        Exporte ou importe a rede de sinapses do Nexus. Útil para transferir o conhecimento evoluído para uma nova instância ou para visualização.
      </p>
      <div className="flex gap-2">
        <button
          onClick={onExport}
          disabled={isLoadingExport || isLoadingImport}
          className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoadingExport ? "Exportando..." : "Exportar Grafo"}
        </button>
        <label
          htmlFor="import-graph"
          className={`w-full px-4 py-2 bg-cyan-700 hover:bg-cyan-600 rounded-md transition-colors text-sm font-medium text-center ${isLoadingImport ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {isLoadingImport ? "Importando..." : "Importar Grafo"}
        </label>
        <input id="import-graph" type="file" accept=".json,application/json" className="hidden" onChange={onImport} disabled={isLoadingImport} />
      </div>
    </div>
  </div>
));

const ConceptListSection = memo(({ concepts, onDelete, loadingConceptName }: {
  concepts: Concept[],
  onDelete: (name: string) => void,
  loadingConceptName: string | null
}) => (
  <div>
    <h3 className="text-lg font-semibold text-cyan-300 mb-2 mt-6">Memória do Nexus (Conceitos)</h3>
    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 mb-4 border-b border-gray-700 pb-4">
      {concepts.length > 0 ? concepts.map(c => (
        <div key={c.name} className="bg-gray-700 p-3 rounded-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-semibold text-white capitalize">{c.name}</p>
              <p className="text-sm text-gray-400">Confiança: {Math.round((c.confidence || 0) * 100)}%</p>
            </div>
            <button
              onClick={() => onDelete(c.name)}
              disabled={!!loadingConceptName}
              className="text-red-400 hover:text-red-300 text-sm flex-shrink-0 ml-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingConceptName === c.name ? "Esquecendo..." : "Esquecer"}
            </button>
          </div>
        </div>
      )) : <p className="text-gray-400">O Nexus ainda não aprendeu nenhum conceito.</p>}
    </div>
  </div>
));

const DestructiveActionsSection = memo(({ onClearHistory, onResetMemory, isLoadingClear, isLoadingReset }: {
  onClearHistory: () => void,
  onResetMemory: () => void,
  isLoadingClear: boolean,
  isLoadingReset: boolean
}) => (
  <div>
    <h4 className="text-md font-semibold text-red-400 mb-2 mt-6">
      <IconWarning /> Ações Destrutivas
    </h4>
    <div className="p-3 bg-gray-700/50 border border-red-500/30 rounded-md space-y-3">
      <button
        onClick={onClearHistory}
        disabled={isLoadingClear || isLoadingReset}
        className="w-full px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-500 rounded-md transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoadingClear ? "Limpando..." : "Limpar Histórico de Conversas"}
      </button>
      <button
        onClick={onResetMemory}
        disabled={isLoadingClear || isLoadingReset}
        className="w-full px-4 py-2 bg-red-800 hover:bg-red-700 disabled:bg-gray-500 rounded-md transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoadingReset ? "Resetando..." : "Resetar Memória do Nexus"}
      </button>
    </div>
  </div>
));

// --- Componente Principal ---

export const MemorySettings = ({ userId, token, onLogout, concepts, setConcepts }: MemorySettingsProps) => {

  const [loading, setLoading] = useState<LoadingState>({
    exportMemory: false,
    importMemory: false,
    exportGraph: false,
    importGraph: false,
    deleteConcept: null,
    clearHistory: false,
    resetMemory: false,
  });

  // --- Handlers Memoizados ---

  const handleDeleteConcept = useCallback(async (name: string) => {
    if (window.confirm(`Tem certeza que quer que o Nexus esqueça sobre "${name}"?`)) {
      setLoading(s => ({ ...s, deleteConcept: name }));
      try {
        await db.deleteConcept(userId, name);
        setConcepts(await db.getAllConcepts(userId));
      } catch (error) {
        console.error("Failed to delete concept:", error);
        alert("Erro ao tentar esquecer o conceito.");
      } finally {
        setLoading(s => ({ ...s, deleteConcept: null }));
      }
    }
  }, [userId, setConcepts]);

  const handleClearHistory = useCallback(async () => {
    if (window.confirm('Tem certeza que deseja apagar todo o histórico de conversas? Esta ação não pode ser desfeita.')) {
      setLoading(s => ({ ...s, clearHistory: true }));
      try {
        await db.clearChatHistory(userId);
        alert('Histórico de conversas apagado. A aplicação será recarregada.');
        window.location.reload();
      } catch (error) {
        console.error("Failed to clear history:", error);
        alert("Erro ao limpar o histórico.");
        setLoading(s => ({ ...s, clearHistory: false }));
      }
    }
  }, [userId]);

  const handleResetMemory = useCallback(async () => {
    if (window.confirm('ATENÇÃO: Você tem certeza que deseja resetar TODA a memória do Nexus? Isso inclui conceitos, perfil de usuário, diário e histórico. Esta ação não pode ser desfeita.')) {
      setLoading(s => ({ ...s, resetMemory: true }));
      try {
        await db.resetNexusMemory(userId);
        alert('Memória do Nexus resetada. A aplicação será recarregada.');
        window.location.reload();
      } catch (error) {
        console.error("Failed to reset memory:", error);
        alert("Erro ao resetar a memória.");
        setLoading(s => ({ ...s, resetMemory: false }));
      }
    }
  }, [userId]);

  const handleExportMemory = useCallback(async () => {
    setLoading(s => ({ ...s, exportMemory: true }));
    try {
      const [profile, diary, system, concepts, chatHistory, tasks] = await Promise.all([
        db.getUserProfile(userId),
        db.getDiary(userId),
        db.getSystemMemory(userId),
        db.getAllConcepts(userId),
        db.getChatHistory(userId),
        db.getAllTasks(userId),
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
    } finally {
      setLoading(s => ({ ...s, exportMemory: false }));
    }
  }, [userId]);

  const handleImportMemory = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!window.confirm('Tem certeza que deseja importar este arquivo? Isso substituirá TODA a memória atual do Nexus.')) {
      event.target.value = '';
      return;
    }

    setLoading(s => ({ ...s, importMemory: true }));

    handleFileRead(
      file,
      async (content) => {
        const backupData = JSON.parse(content);
        await db.importBackup(userId, backupData);
        alert('Memória importada com sucesso! A aplicação será recarregada.');
        window.location.reload();
      },
      (errorMessage) => alert(errorMessage),
      () => {
        event.target.value = '';
        setLoading(s => ({ ...s, importMemory: false }));
      }
    );
  }, [userId]);

  const handleExportCognitiveGraph = useCallback(async () => {
    setLoading(s => ({ ...s, exportGraph: true }));
    try {
      const systemMemory = await db.getSystemMemory(userId);
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
    } finally {
      setLoading(s => ({ ...s, exportGraph: false }));
    }
  }, [userId]);

  const handleImportCognitiveGraph = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!window.confirm('Tem certeza que deseja importar este grafo? As novas conexões serão mescladas com a memória existente.')) {
      event.target.value = '';
      return;
    }

    setLoading(s => ({ ...s, importGraph: true }));

    handleFileRead(
      file,
      async (content) => {
        const graphData = JSON.parse(content);
        await db.importCognitiveGraph(userId, graphData);
        alert('Grafo cognitivo importado com sucesso! A aplicação será recarregada.');
        window.location.reload();
      },
      (errorMessage) => alert(errorMessage),
      () => {
        event.target.value = '';
        setLoading(s => ({ ...s, importGraph: false }));
      }
    );
  }, [userId]);

  // --- Dados Memoizados ---

  const sortedConcepts = useMemo(() => {
    return [...concepts].sort((a, b) => a.name.localeCompare(b.name));
  }, [concepts]);

  // --- Renderização ---

  return (
    <div>
      <GoogleSyncSection token={token} onLogout={onLogout} />

      <BackupSection
        onExport={handleExportMemory}
        onImport={handleImportMemory}
        isLoadingExport={loading.exportMemory}
        isLoadingImport={loading.importMemory}
      />

      <CognitiveGraphSection
        onExport={handleExportCognitiveGraph}
        onImport={handleImportCognitiveGraph}
        isLoadingExport={loading.exportGraph}
        isLoadingImport={loading.importGraph}
      />

      <ConceptListSection
        concepts={sortedConcepts}
        onDelete={handleDeleteConcept}
        loadingConceptName={loading.deleteConcept}
      />

      <DestructiveActionsSection
        onClearHistory={handleClearHistory}
        onResetMemory={handleResetMemory}
        isLoadingClear={loading.clearHistory}
        isLoadingReset={loading.resetMemory}
      />
    </div>
  );
};

// --- Ícones ---

const IconWarning = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block mr-1 -mt-1" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 011 1v3a1 1 0 11-2 0V6a1 1 0 011-1z" clipRule="evenodd" />
  </svg>
);