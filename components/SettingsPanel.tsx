import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
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
  userId: string;
}

type Tab = 'geral' | 'cérebro' | 'integrações' | 'memória';

// APRIMORAMENTO: Definindo as abas como um array de objetos para modularidade
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'geral', label: 'Geral', icon: '⚙️' },
  { id: 'cérebro', label: 'Cérebro', icon: '🧠' },
  { id: 'integrações', label: 'Integrações', icon: '📡' },
  { id: 'memória', label: 'Memória & Dados', icon: '💾' }
];

const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const panelVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: { type: 'spring', stiffness: 120, damping: 15 }
  },
};

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isVisible, settings, onSettingsChange, onClose, token, onLogout, userId }) => {
  const [activeTab, setActiveTab] = useState<Tab>('geral');
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);
  
  // APRIMORAMENTO: Este useEffect agora só roda uma vez na montagem
  useEffect(() => {
    const fetchVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices.filter(v => v.lang.startsWith('pt')));
      }
    };
    
    fetchVoices(); // Tenta buscar imediatamente
    window.speechSynthesis.onvoiceschanged = fetchVoices; // Adiciona o listener para o caso de não estarem prontas
    
    return () => {
      window.speechSynthesis.onvoiceschanged = null; // Limpa o listener
    };
  }, []); // Dependência vazia [] garante que rode apenas uma vez

  // Este useEffect para carregar conceitos sob demanda está ótimo.
  useEffect(() => {
    if (activeTab === 'memória') {
        db.getAllConcepts(userId).then(setConcepts);
    }
  }, [activeTab, userId]);
  
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
  }

  // --- (Handlers de mudança de estado - Mantidos, estão corretos) ---
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
            ...prev.behavior,
            permissions: {
                ...prev.behavior.permissions,
                [field]: value,
            }
        }
    }));
  };
  
  const handleSave = () => {
    setSaveStatus('saving');
    onSettingsChange(localSettings);
    // Simula o tempo de salvamento e fecha
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => {
        setSaveStatus('idle');
        onClose();
      }, 800);
    }, 400);
  };
  // --- (Fim dos Handlers) ---

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
                  userId={userId}
                  token={token}
                  onLogout={onLogout}
                  concepts={concepts}
                  setConcepts={setConcepts}
                />;
      default:
        return null;
    }
  };

  // A AnimatePresence deve envolver o elemento que pode desaparecer
  return (
    <AnimatePresence>
      {isVisible && (
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
            className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-xl m-4 flex flex-col max-h-[90vh]" // Aumentado para max-w-xl e max-h-90vh
            onClick={e => e.stopPropagation()}
            variants={panelVariants}
          >
            {/* APRIMORAMENTO: Bloco <style> removido. 
                A estilização do Toggle está agora no componente BrainSettings. 
            */}
            
            <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white">Configurações</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </header>
            
            {/* APRIMORAMENTO: Abas geradas por map() para limpeza e ícones */}
            <nav className="flex-shrink-0 flex border-b border-gray-700">
              {TABS.map(tab => (
                <button 
                  key={tab.id} 
                  onClick={() => handleTabChange(tab.id)} 
                  className={`flex-1 p-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                    activeTab === tab.id 
                      ? 'text-cyan-400 border-b-2 border-cyan-400' 
                      : 'text-gray-400 hover:text-white border-b-2 border-transparent'
                  }`}
                >
                  <span className="hidden sm:inline">{tab.icon}</span> {/* Ícone visível em telas pequenas (sm) ou maiores */}
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>

            <main className="p-4 flex-grow overflow-y-auto">
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
      )}
    </AnimatePresence>
  );
};