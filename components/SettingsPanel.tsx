
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppSettings, Concept, Permissions } from '../types';
import { db } from '../services/indexedDBService';
import { GeneralSettings } from './settings/GeneralSettings';
import { BrainSettings } from './settings/BrainSettings';
import { IntegrationsSettings } from './settings/IntegrationsSettings';
import { MemorySettings } from './settings/MemorySettings';

interface SettingsPanelProps {
  isVisible: boolean;
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  onClose: () => void;
  token: string | null;
  onLogout: () => void;
}

type Tab = 'geral' | 'cérebro' | 'integrações' | 'memória';

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const panelVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: { type: 'spring', stiffness: 120, damping: 15 }
  },
};

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isVisible, settings, onSettingsChange, onClose, token, onLogout }) => {
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

  const renderTabContent = () => {
    switch (activeTab) {
      case 'geral':
        return <GeneralSettings 
                    settings={localSettings} 
                    onSettingChange={handleSettingChange} 
                    onNestedSettingChange={handleNestedSettingChange} 
                    voices={voices} 
                />;
      case 'cérebro':
        return <BrainSettings 
                    settings={localSettings} 
                    onNestedSettingChange={handleNestedSettingChange} 
                    onPermissionChange={handlePermissionChange} 
                />;
      case 'integrações':
        return <IntegrationsSettings 
                    settings={localSettings} 
                    onSettingChange={handleSettingChange} 
                    onNestedSettingChange={handleNestedSettingChange} 
                />;
      case 'memória':
        return <MemorySettings 
                    token={token}
                    onLogout={onLogout}
                    concepts={concepts}
                    setConcepts={setConcepts}
                />;
    }
  };

  return (
    <motion.div 
      className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center backdrop-blur-sm" 
      onClick={onClose}
      variants={backdropVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
      transition={{ duration: 0.3 }}
    >
      <motion.div 
        className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-md m-4 flex flex-col" 
        onClick={e => e.stopPropagation()}
        variants={panelVariants}
      >
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
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={onClose} 
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md transition-colors text-sm font-medium"
            >
                Cancelar
            </motion.button>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={handleSave} 
                disabled={saveStatus !== 'idle'}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-800 disabled:cursor-not-allowed rounded-md transition-colors text-sm font-medium w-36 text-center"
            >
                {saveStatus === 'idle' && 'Salvar Alterações'}
                {saveStatus === 'saving' && 'Salvando...'}
                {saveStatus === 'saved' && 'Salvo!'}
            </motion.button>
        </footer>
      </motion.div>
    </motion.div>
  );
};
