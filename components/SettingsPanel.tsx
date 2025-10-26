
import React, { useState, useEffect } from 'react';
import { AppSettings, Concept } from '../types';
import { db } from '../services/indexedDBService';
import { signIn, signOut, isSignedIn, backupToGoogleDrive, restoreFromGoogleDrive } from '../services/syncService';

interface SettingsPanelProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  onClose: () => void;
}

type Tab = 'geral' | 'comportamento' | 'dados';

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onSettingsChange, onClose }) => {
  const [activeTab, setActiveTab] = useState<Tab>('geral');
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [isUserSignedIn, setIsUserSignedIn] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);
  
  useEffect(() => {
    const checkSignInStatus = () => setIsUserSignedIn(isSignedIn());
    checkSignInStatus();

    const fetchVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices.filter(v => v.lang.startsWith('pt')));
      }
    };
    
    fetchVoices();
    window.speechSynthesis.onvoiceschanged = fetchVoices;
    
    if (activeTab === 'dados') {
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

  const handleAuthClick = async () => {
    setIsSyncing(true);
    setSyncMessage('Aguardando autenticação...');
    try {
        if (isUserSignedIn) {
            await signOut();
            setIsUserSignedIn(false);
            setSyncMessage('Você foi desconectado.');
        } else {
            await signIn();
            setIsUserSignedIn(true);
            setSyncMessage('Login realizado com sucesso!');
        }
    } catch (error) {
        console.error("Auth Error", error);
        setSyncMessage('Erro na autenticação.');
    } finally {
        setIsSyncing(false);
        setTimeout(() => setSyncMessage(''), 3000);
    }
  };

  const handleBackup = async () => {
    setIsSyncing(true);
    setSyncMessage('Fazendo backup da memória...');
    try {
        const fileId = await backupToGoogleDrive();
        setSyncMessage(`Backup concluído! (ID: ${fileId.slice(0,10)}...)`);
    } catch (error) {
        console.error(error);
        setSyncMessage('Erro no backup.');
    } finally {
        setIsSyncing(false);
        setTimeout(() => setSyncMessage(''), 3000);
    }
  };

  const handleRestore = async () => {
      if (!window.confirm('Restaurar um backup substituirá TODA a memória local atual do Nexus. Deseja continuar?')) {
          return;
      }
      setIsSyncing(true);
      setSyncMessage('Restaurando memória do Google Drive...');
      try {
        await restoreFromGoogleDrive();
        setSyncMessage('Memória restaurada com sucesso! A aplicação será recarregada.');
        setTimeout(() => window.location.reload(), 2500);
      } catch (error: any) {
        console.error(error);
        setSyncMessage(`Erro ao restaurar: ${error.message}`);
        setIsSyncing(false);
        setTimeout(() => setSyncMessage(''), 3000);
      }
  };
  
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

  const renderTabContent = () => {
    switch (activeTab) {
      case 'geral':
        return (
          <div>
            <h3 className="text-lg font-semibold text-cyan-300 mb-4">Configurações de Voz</h3>
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
      case 'comportamento':
        return (
            <div>
                <h3 className="text-lg font-semibold text-cyan-300 mb-4">Comportamento e Personalidade</h3>
                <div className="space-y-3">
                    <label className="flex items-center justify-between p-3 bg-gray-700 rounded-md cursor-pointer">
                        <div>
                            <p className="font-medium text-white">Iniciativa Proativa</p>
                            <p className="text-sm text-gray-400">Permitir que o Nexus inicie conversas.</p>
                        </div>
                        <input type="checkbox" name="enableProactive" checked={localSettings.behavior.enableProactive} onChange={(e) => handleNestedSettingChange('behavior', 'enableProactive', e.target.checked)} className="toggle-checkbox" />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-gray-700 rounded-md cursor-pointer">
                        <div>
                            <p className="font-medium text-white">Curiosidade Autônoma</p>
                            <p className="text-sm text-gray-400">Permitir que o Nexus faça perguntas quando ocioso.</p>
                        </div>
                        <input type="checkbox" name="enableCuriosity" checked={localSettings.behavior.enableCuriosity} onChange={(e) => handleNestedSettingChange('behavior', 'enableCuriosity', e.target.checked)} className="toggle-checkbox" />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-gray-700 rounded-md cursor-pointer">
                        <div>
                            <p className="font-medium text-white">Diário e Reflexões</p>
                            <p className="text-sm text-gray-400">Habilitar o Nexus para manter um diário sobre as interações.</p>
                        </div>
                        <input type="checkbox" name="enableDiary" checked={localSettings.behavior.enableDiary} onChange={(e) => handleNestedSettingChange('behavior', 'enableDiary', e.target.checked)} className="toggle-checkbox" />
                    </label>
                </div>
            </div>
        );
      case 'dados':
        return (
          <div>
            <div className="p-3 bg-gray-700 rounded-md mb-4">
                <p className="font-medium text-white">Sincronização com Google Drive</p>
                <p className="text-sm text-gray-400 mb-3">Status: {isUserSignedIn ? 'Conectado' : 'Desconectado'}</p>
                <button onClick={handleAuthClick} disabled={isSyncing} className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-500 rounded-md transition-colors mb-2">
                    {isSyncing ? 'Processando...' : (isUserSignedIn ? 'Logout do Google' : 'Login com Google')}
                </button>
                {isUserSignedIn && (
                    <div className="flex gap-2">
                        <button onClick={handleBackup} disabled={isSyncing} className="w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-500 rounded-md transition-colors">
                            Fazer Backup Agora
                        </button>
                        <button onClick={handleRestore} disabled={isSyncing} className="w-full px-4 py-2 bg-cyan-700 hover:bg-cyan-600 disabled:bg-gray-500 rounded-md transition-colors">
                           Restaurar Backup
                        </button>
                    </div>
                )}
                {syncMessage && <p className="text-xs text-center text-gray-300 mt-2">{syncMessage}</p>}
            </div>

            <h3 className="text-lg font-semibold text-cyan-300 mb-2">Memória do Nexus (Conceitos)</h3>
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
                <h4 className="text-md font-semibold text-red-400 mb-2">Ações Destrutivas</h4>
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
          <button onClick={() => handleTabChange('comportamento')} className={`flex-1 p-3 text-sm font-medium ${activeTab === 'comportamento' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400'}`}>Comportamento</button>
          <button onClick={() => handleTabChange('dados')} className={`flex-1 p-3 text-sm font-medium ${activeTab === 'dados' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400'}`}>Dados</button>
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
