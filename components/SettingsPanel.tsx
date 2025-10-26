
import React, { useState, useEffect } from 'react';
import { AppSettings, Concept } from '../types';
import { db } from '../services/indexedDBService';
import { AppearanceSelector } from './AppearanceSelector';

interface SettingsPanelProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  onClose: () => void;
  token: string | null;
  onLogout: () => void;
}

type Tab = 'geral' | 'cérebro' | 'integrações' | 'memória';

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onSettingsChange, onClose, token, onLogout }) => {
  const [activeTab, setActiveTab] = useState<Tab>('geral');
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);
  
  useEffect(() => {
    const fetchVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices.filter(v => v.lang.startsWith('pt')));
      }
    };
    
    fetchVoices();
    window.speechSynthesis.onvoiceschanged = fetchVoices;
    
    if (activeTab === 'memória') {
        db.getAllConcepts().then(setConcepts);
    }
  }, [activeTab]);
  
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
  }

  const handleSettingChange = (field: keyof AppSettings, value: any) => {
    setLocalSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleNestedSettingChange = (field: keyof AppSettings, subField: string, value: any) => {
    setLocalSettings(prev => ({
        ...prev,
        [field]: {
            ...(prev[field] as object),
            [subField]: value,
        },
    }));
  };
  
  const handleSave = () => {
    setSaveStatus('saving');
    onSettingsChange(localSettings);
    setSaveStatus('saved');
    setTimeout(() => {
      setSaveStatus('idle');
      onClose();
    }, 1200);
  };

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
        const [profile, diary, system, concepts] = await Promise.all([
            db.getUserProfile(),
            db.getDiary(),
            db.getSystemMemory(),
            db.getAllConcepts()
        ]);

        const backupData = {
            profile, diary, system, concepts,
            exportedAt: new Date().toISOString(),
            version: '1.0.0',
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

  const renderTabContent = () => {
    switch (activeTab) {
      case 'geral':
        return (
          <div>
            <h3 className="text-lg font-semibold text-cyan-300 mb-4">Aparência do Nexus</h3>
            <AppearanceSelector
              current={localSettings.appearance ?? 'neutral'}
              onChange={(newAppearance) => handleSettingChange('appearance', newAppearance)}
            />
            <h3 className="text-lg font-semibold text-cyan-300 my-4">Configurações de Voz</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="voice-select" className="block text-sm font-medium text-gray-300 mb-1">Voz</label>
                <select id="voice-select" value={localSettings.voice.voiceURI || ''} onChange={(e) => handleNestedSettingChange('voice', 'voiceURI', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500">
                  <option value="">Padrão do Sistema (PT-BR)</option>
                  {voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="voice-rate" className="block text-sm font-medium text-gray-300 mb-1">Velocidade ({localSettings.voice.rate.toFixed(1)})</label>
                <input id="voice-rate" type="range" min="0.5" max="2" step="0.1" value={localSettings.voice.rate} onChange={(e) => handleNestedSettingChange('voice', 'rate', parseFloat(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
              </div>
              <div>
                <label htmlFor="voice-pitch" className="block text-sm font-medium text-gray-300 mb-1">Tom ({localSettings.voice.pitch.toFixed(1)})</label>
                <input id="voice-pitch" type="range" min="0" max="2" step="0.1" value={localSettings.voice.pitch} onChange={(e) => handleNestedSettingChange('voice', 'pitch', parseFloat(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
              </div>
            </div>
          </div>
        );
      case 'cérebro':
        return (
            <div>
                <h3 className="text-lg font-semibold text-cyan-300 mb-4">Comportamento e Personalidade</h3>
                <div className="space-y-3">
                    <label className="flex items-center justify-between p-3 bg-gray-700 rounded-md cursor-pointer">
                        <div>
                            <p className="font-medium text-white">Iniciativa Proativa</p>
                            <p className="text-sm text-gray-400">Permitir que o Nexus inicie conversas.</p>
                        </div>
                        <input type="checkbox" checked={localSettings.behavior?.enableProactive} onChange={(e) => handleNestedSettingChange('behavior', 'enableProactive', e.target.checked)} className="toggle-checkbox" />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-gray-700 rounded-md cursor-pointer">
                        <div>
                            <p className="font-medium text-white">Curiosidade Autônoma</p>
                            <p className="text-sm text-gray-400">Permitir que o Nexus faça perguntas quando ocioso.</p>
                        </div>
                        <input type="checkbox" checked={localSettings.behavior?.enableCuriosity} onChange={(e) => handleNestedSettingChange('behavior', 'enableCuriosity', e.target.checked)} className="toggle-checkbox" />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-gray-700 rounded-md cursor-pointer">
                        <div>
                            <p className="font-medium text-white">Diário e Reflexões</p>
                            <p className="text-sm text-gray-400">Habilitar o Nexus para manter um diário sobre as interações.</p>
                        </div>
                        <input type="checkbox" checked={localSettings.behavior?.enableDiary} onChange={(e) => handleNestedSettingChange('behavior', 'enableDiary', e.target.checked)} className="toggle-checkbox" />
                    </label>
                </div>
                <div className="mt-6">
                    <h3 className="text-lg font-semibold text-cyan-300 mb-4">Parâmetros Cognitivos (Avançado)</h3>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="emotional-intensity" className="block text-sm font-medium text-gray-300 mb-1">Intensidade Emocional ({localSettings.cognitive?.emotionalIntensity.toFixed(1)})</label>
                            <input id="emotional-intensity" type="range" min="0.5" max="1.5" step="0.1" value={localSettings.cognitive?.emotionalIntensity || 1.0} onChange={(e) => handleNestedSettingChange('cognitive', 'emotionalIntensity', parseFloat(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                        </div>
                        <div>
                            <label htmlFor="learning-rate" className="block text-sm font-medium text-gray-300 mb-1">Velocidade de Aprendizado ({localSettings.cognitive?.learningRate.toFixed(1)})</label>
                            <input id="learning-rate" type="range" min="0.5" max="2" step="0.1" value={localSettings.cognitive?.learningRate || 1.0} onChange={(e) => handleNestedSettingChange('cognitive', 'learningRate', parseFloat(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                        </div>
                    </div>
                </div>
            </div>
        );
    case 'integrações':
        return (
            <div>
                <h3 className="text-lg font-semibold text-cyan-300 mb-4">Provedor de LLM</h3>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="llm-provider" className="block text-sm font-medium text-gray-300 mb-1">Modelo de Linguagem</label>
                        <select id="llm-provider" value={localSettings.llmProvider || 'gemini'} onChange={(e) => handleSettingChange('llmProvider', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500">
                            <option value="gemini">Google Gemini (Padrão)</option>
                            <option value="deepseek">DeepSeek</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="deepseek-api-key" className="block text-sm font-medium text-gray-300 mb-1">Chave de API DeepSeek</label>
                        <input
                            type="password"
                            id="deepseek-api-key"
                            value={localSettings.apiKeys?.deepseekApiKey || ''}
                            onChange={(e) => handleNestedSettingChange('apiKeys', 'deepseekApiKey', e.target.value)}
                            placeholder="Cole sua chave aqui"
                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500"
                            disabled={localSettings.llmProvider !== 'deepseek'}
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            Necessária apenas se o provedor for DeepSeek. Obtenha uma em <a href="https://platform.deepseek.com/" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">platform.deepseek.com</a>.
                        </p>
                    </div>
                     <div className="p-3 bg-gray-700/50 border border-cyan-500/20 rounded-md">
                        <p className="text-sm text-gray-300">A chave de API do **Google Gemini** é gerenciada pelo ambiente e não precisa ser inserida aqui.</p>
                     </div>
                </div>
            </div>
        );
      case 'memória':
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
            
            <h3 className="text-lg font-semibold text-cyan-300 mb-2 mt-6">Memória do Nexus (Conceitos)</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 mb-4 border-b border-gray-700 pb-4">
                {concepts.length > 0 ? concepts.map(c => (
                    <div key={c.name} className="bg-gray-700 p-3 rounded-md">
                        <div className="flex justify-between items-start">
                           <div>
                             <p className="font-semibold text-white">{c.name}</p>
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
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-md m-4 flex flex-col" onClick={e => e.stopPropagation()}>
        <style>{`
            .toggle-checkbox {
                appearance: none; width: 40px; height: 20px; background-color: #4a5568;
                border-radius: 10px; position: relative; cursor: pointer; transition: background-color 0.2s;
            }
            .toggle-checkbox:checked { background-color: #22d3ee; }
            .toggle-checkbox::before {
                content: ''; position: absolute; width: 16px; height: 16px;
                background-color: white; border-radius: 50%; top: 2px; left: 2px;
                transition: transform 0.2s;
            }
            .toggle-checkbox:checked::before { transform: translateX(20px); }
        `}</style>
        <header className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Configurações</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </header>
        
        <nav className="flex-shrink-0 flex border-b border-gray-700">
          <button onClick={() => handleTabChange('geral')} className={`flex-1 p-3 text-sm font-medium ${activeTab === 'geral' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400'}`}>Geral</button>
          <button onClick={() => handleTabChange('cérebro')} className={`flex-1 p-3 text-sm font-medium ${activeTab === 'cérebro' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400'}`}>Cérebro</button>
          <button onClick={() => handleTabChange('integrações')} className={`flex-1 p-3 text-sm font-medium ${activeTab === 'integrações' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400'}`}>Integrações</button>
          <button onClick={() => handleTabChange('memória')} className={`flex-1 p-3 text-sm font-medium ${activeTab === 'memória' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400'}`}>Memória & Dados</button>
        </nav>

        <main className="p-4 flex-grow max-h-[70vh] overflow-y-auto">
          {renderTabContent()}
        </main>
        
        <footer className="flex-shrink-0 flex items-center justify-end p-4 border-t border-gray-700 gap-3">
            <button 
                onClick={onClose} 
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md transition-colors text-sm font-medium"
            >
                Cancelar
            </button>
            <button 
                onClick={handleSave} 
                disabled={saveStatus !== 'idle'}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-800 disabled:cursor-not-allowed rounded-md transition-colors text-sm font-medium w-36 text-center"
            >
                {saveStatus === 'idle' && 'Salvar Alterações'}
                {saveStatus === 'saving' && 'Salvando...'}
                {saveStatus === 'saved' && 'Salvo!'}
            </button>
        </footer>
      </div>
    </div>
  );
};