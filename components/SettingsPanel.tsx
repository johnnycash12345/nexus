import React, { useState, useEffect } from 'react';
import { AppSettings, Concept, Permissions } from '../types';
import { db } from '../services/indexedDBService';
import { GeneralSettings } from './settings/GeneralSettings';
import { BrainSettings } from './settings/BrainSettings';
import { IntegrationsSettings } from './settings/IntegrationsSettings';
import { MemorySettings } from './settings/MemorySettings';

interface SettingsPanelProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  onClose: () => void;
  token: string | null;
  onLogout: () => void;
}

type Tab = 'geral' | 'cérebro' | 'integrações' | 'memória';

const AuthModal: React.FC<{ onAuth: (success: boolean) => void; error: string }> = ({ onAuth, error }) => {
    const [password, setPassword] = useState('');
    const inputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 100);
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === 'kristine2024') {
            onAuth(true);
        } else {
            onAuth(false);
        }
    };
    return (
        <div className="absolute inset-0 bg-gray-900/80 z-50 flex items-center justify-center backdrop-blur-sm">
            <div className="bg-gray-800 border border-cyan-500/30 p-6 rounded-lg shadow-2xl w-full max-w-sm">
                <h3 className="text-lg font-bold text-cyan-400 mb-2">Acesso Restrito</h3>
                <p className="text-sm text-gray-400 mb-4">Por favor, insira a senha de administrador para modificar configurações críticas.</p>
                <form onSubmit={handleSubmit}>
                    <input
                        ref={inputRef}
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white placeholder-gray-500 focus:ring-cyan-500 focus:border-cyan-500"
                        placeholder="Senha"
                    />
                    {error && <p className="text-red-400 text-sm mt-2">🔐 {error}</p>}
                    <button type="submit" className="w-full mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-md transition-colors font-semibold">
                        Desbloquear
                    </button>
                </form>
            </div>
        </div>
    );
};


export const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onSettingsChange, onClose, token, onLogout }) => {
  const [activeTab, setActiveTab] = useState<Tab>('geral');
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  
  const [isUnlocked, setIsUnlocked] = useState(sessionStorage.getItem('nexus_admin_unlocked') === 'true');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authError, setAuthError] = useState('');

  const handleLock = () => {
    setIsUnlocked(false);
    sessionStorage.removeItem('nexus_admin_unlocked');
  };

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

  const handlePermissionChange = (field: keyof Permissions, value: boolean) => {
    setLocalSettings(prev => ({
        ...prev,
        behavior: {
            ...(prev.behavior ?? {}),
            permissions: {
                ...(prev.behavior?.permissions ?? { allowApiAccess: true, allowAutonomousDecision: true, allowSelfModification: false }),
                [field]: value,
            }
        }
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
  
  const requestAuth = () => {
      setShowAuthModal(true);
      setAuthError('');
  };

  const handleAuth = (success: boolean) => {
      if (success) {
          setIsUnlocked(true);
          sessionStorage.setItem('nexus_admin_unlocked', 'true');
          setAuthError('');
          setShowAuthModal(false);
      } else {
          setAuthError('Acesso negado. Apenas o criador pode desbloquear esta função.');
      }
  };

  const renderTabContent = () => {
    const commonProps = {
        settings: localSettings,
        onNestedSettingChange: handleNestedSettingChange,
        onPermissionChange: handlePermissionChange,
        isUnlocked,
        requestAuth,
    };
    switch (activeTab) {
      case 'geral':
        return <GeneralSettings 
                    settings={localSettings} 
                    onSettingChange={handleSettingChange} 
                    onNestedSettingChange={handleNestedSettingChange} 
                    voices={voices} 
                />;
      case 'cérebro':
        return <BrainSettings {...commonProps} />;
      case 'integrações':
        return <IntegrationsSettings {...commonProps} onSettingChange={handleSettingChange} token={token}/>;
      case 'memória':
        return <MemorySettings 
                    token={token}
                    onLogout={onLogout}
                    concepts={concepts}
                    setConcepts={setConcepts}
                    isUnlocked={isUnlocked}
                    requestAuth={requestAuth}
                />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-md m-4 flex flex-col relative" onClick={e => e.stopPropagation()}>
         {showAuthModal && <AuthModal onAuth={handleAuth} error={authError} />}
        <style>{`
            .toggle-checkbox {
                appearance: none; width: 40px; height: 20px; background-color: #4a5568;
                border-radius: 10px; position: relative; cursor: pointer; transition: background-color 0.2s;
            }
            .toggle-checkbox:disabled { background-color: #2d3748; cursor: not-allowed; }
            .toggle-checkbox:checked { background-color: #22d3ee; }
            .toggle-checkbox::before {
                content: ''; position: absolute; width: 16px; height: 16px;
                background-color: white; border-radius: 50%; top: 2px; left: 2px;
                transition: transform 0.2s;
            }
            .toggle-checkbox:checked::before { transform: translateX(20px); }
        `}</style>
        <header className="flex items-center justify-between p-4 border-b border-gray-700">
            <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">Configurações</h2>
                {isUnlocked ? (
                     <button
                        onClick={handleLock}
                        title="Clique para bloquear as funções de administrador"
                        className="cursor-pointer px-2 py-0.5 bg-green-500/20 text-green-300 text-xs font-bold rounded-full hover:bg-green-500/40 transition-colors flex items-center gap-1"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M14.5 9V5.5a4.5 4.5 0 10-9 0V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5zm-2.5 0V5.5a3 3 0 10-6 0V9h6z" /></svg>
                        ADMIN
                    </button>
                ) : (
                    <button
                        onClick={requestAuth}
                        title="Clique para desbloquear as funções de administrador"
                        className="cursor-pointer px-2 py-0.5 bg-yellow-500/20 text-yellow-300 text-xs font-bold rounded-full hover:bg-yellow-500/40 transition-colors flex items-center gap-1"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" /></svg>
                        PROTEGIDO
                    </button>
                )}
            </div>
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