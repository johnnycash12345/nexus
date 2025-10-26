import React, { useState, useEffect } from 'react';
import { AppSettings, Concept } from '../types';
import { db } from '../services/indexedDBService';
import { syncDataToDrive, signIn, isSignedIn } from '../services/syncService';

interface SettingsPanelProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  onClose: () => void;
}

type Tab = 'voice' | 'memory' | 'behavior';

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onSettingsChange, onClose }) => {
  const [activeTab, setActiveTab] = useState<Tab>('voice');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [isUserSignedIn, setIsUserSignedIn] = useState(false);

  useEffect(() => {
    // Check initial sign-in state
    setIsUserSignedIn(isSignedIn());

    const fetchVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices.filter(v => v.lang.startsWith('pt')));
      }
    };
    
    fetchVoices();
    window.speechSynthesis.onvoiceschanged = fetchVoices;
    
    if (activeTab === 'memory') {
        db.getAllConcepts().then(setConcepts);
    }
  }, [activeTab]);
  
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
  }

  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSettingsChange({
      ...settings,
      voice: { ...settings.voice, voiceURI: e.target.value },
    });
  };

  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSettingsChange({
        ...settings,
        voice: { ...settings.voice, rate: parseFloat(e.target.value) },
    });
  };
  
  const handlePitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSettingsChange({
        ...settings,
        voice: { ...settings.voice, pitch: parseFloat(e.target.value) },
    });
  };
  
  const handleBehaviorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onSettingsChange({
          ...settings,
          behavior: { ...settings.behavior, [e.target.name]: e.target.checked }
      });
  };
  
  const handleDeleteConcept = async (name: string) => {
      if(window.confirm(`Tem certeza que quer que o Nexus esqueça sobre "${name}"?`)){
        await db.deleteConcept(name);
        setConcepts(await db.getAllConcepts());
      }
  };

  const handleSyncClick = async () => {
    setIsSyncing(true);
    setSyncMessage('Iniciando sincronização...');
    try {
        if (!isUserSignedIn) {
            setSyncMessage('Por favor, faça login com o Google...');
            await signIn();
            setIsUserSignedIn(true);
        }
        setSyncMessage('Sincronizando dados...');
        const fileId = await syncDataToDrive();
        if (fileId) {
            setSyncMessage(`Sincronização concluída! (ID: ${fileId.slice(0,10)}...)`);
        } else {
            throw new Error('Falha ao obter ID do arquivo.');
        }
    } catch (error) {
        console.error(error);
        setSyncMessage('Erro na sincronização.');
    } finally {
        setIsSyncing(false);
        setTimeout(() => setSyncMessage(''), 3000);
    }
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'voice':
        return (
          <div>
            <h3 className="text-lg font-semibold text-cyan-300 mb-4">Configurações de Voz</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="voice-select" className="block text-sm font-medium text-gray-300 mb-1">Voz</label>
                <select id="voice-select" value={settings.voice.voiceURI || ''} onChange={handleVoiceChange} className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500">
                  <option value="">Padrão do Sistema (PT-BR)</option>
                  {voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="voice-rate" className="block text-sm font-medium text-gray-300 mb-1">Velocidade ({settings.voice.rate.toFixed(1)})</label>
                <input id="voice-rate" type="range" min="0.5" max="2" step="0.1" value={settings.voice.rate} onChange={handleRateChange} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
              </div>
              <div>
                <label htmlFor="voice-pitch" className="block text-sm font-medium text-gray-300 mb-1">Tom ({settings.voice.pitch.toFixed(1)})</label>
                <input id="voice-pitch" type="range" min="0" max="2" step="0.1" value={settings.voice.pitch} onChange={handlePitchChange} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
              </div>
            </div>
          </div>
        );
      case 'memory':
        return (
          <div>
            <h3 className="text-lg font-semibold text-cyan-300 mb-4">Memória do Nexus</h3>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                {concepts.length > 0 ? concepts.map(c => (
                    <div key={c.name} className="bg-gray-700 p-3 rounded-md">
                        <div className="flex justify-between items-start">
                           <div>
                             <p className="font-semibold text-white">{c.name}</p>
                             <p className="text-sm text-gray-400">Confiança: {Math.round(c.confidence * 100)}%</p>
                           </div>
                           <button onClick={() => handleDeleteConcept(c.name)} className="text-red-400 hover:text-red-300 text-sm">Esquecer</button>
                        </div>
                    </div>
                )) : <p className="text-gray-400">O Nexus ainda não aprendeu nenhum conceito.</p>}
            </div>
          </div>
        );
      case 'behavior':
        return (
            <div>
                <h3 className="text-lg font-semibold text-cyan-300 mb-4">Comportamento e Dados</h3>
                <div className="space-y-4">
                    <label className="flex items-center justify-between p-3 bg-gray-700 rounded-md cursor-pointer">
                        <div>
                            <p className="font-medium text-white">Iniciativa Proativa</p>
                            <p className="text-sm text-gray-400">Permitir que o Nexus inicie conversas.</p>
                        </div>
                        <input type="checkbox" name="enableProactive" checked={settings.behavior.enableProactive} onChange={handleBehaviorChange} className="toggle-checkbox" />
                    </label>
                    <div className="p-3 bg-gray-700 rounded-md">
                        <p className="font-medium text-white">Sincronização de Dados</p>
                        <p className="text-sm text-gray-400 mb-2">Faça backup da memória do Nexus no Google Drive.</p>
                        <button onClick={handleSyncClick} disabled={isSyncing} className="w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-500 rounded-md transition-colors">
                            {isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}
                        </button>
                        {syncMessage && <p className="text-xs text-center text-gray-300 mt-2">{syncMessage}</p>}
                    </div>
                </div>
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
            </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-md m-4 flex flex-col" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Configurações</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </header>
        
        <nav className="flex-shrink-0 flex border-b border-gray-700">
          <button onClick={() => handleTabChange('voice')} className={`flex-1 p-3 text-sm font-medium ${activeTab === 'voice' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400'}`}>Voz</button>
          <button onClick={() => handleTabChange('memory')} className={`flex-1 p-3 text-sm font-medium ${activeTab === 'memory' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400'}`}>Memória</button>
          <button onClick={() => handleTabChange('behavior')} className={`flex-1 p-3 text-sm font-medium ${activeTab === 'behavior' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400'}`}>Comportamento</button>
        </nav>

        <main className="p-4 flex-grow">
          {renderTabContent()}
        </main>
      </div>
    </div>
  );
};