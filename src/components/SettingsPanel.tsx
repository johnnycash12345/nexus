import React, { useState, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { AppSettings, UserRole } from '@/types';
import { db } from '@/services/indexedDBService';
import { GeneralSettings } from './settings/GeneralSettings';
import { BrainSettings } from './settings/BrainSettings';
import { IntegrationsSettings } from './settings/IntegrationsSettings';
import { MemorySettings } from './settings/MemorySettings';

// FIX: Corrected lazy import to properly handle the named export of CreatorPanel.
const CreatorPanel = lazy(() => import('./settings/CreatorPanel').then(m => ({ default: m.CreatorPanel })));
const CognitiveStatus = lazy(() => import('@/components/CognitiveStatus').then(m => ({ default: m.CognitiveStatus })));
const ReflectionHistory = lazy(() => import('@/components/ReflectionHistory').then(m => ({ default: m.ReflectionHistory })));


interface SettingsPanelProps {
  isVisible: boolean;
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  onClose: () => void;
  token: string | null;
  onLogout: () => void;
  userId: string;
  // FIX: Add 'initialTab' prop to allow setting the initial tab from App.tsx.
  initialTab?: Tab;
}

// FIX: Export the Tab type so it can be used in other components like App.tsx
export type Tab = 'geral' | 'cérebro' | 'integrações' | 'memória' | 'gerenciamento' | 'arquitetura' | 'monitor';

const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const panelVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { type: 'spring', stiffness: 150, damping: 25, mass: 0.8 }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.2 }
  }
};

const contentVariants: Variants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const baseNavItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'geral', label: 'Geral', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0 3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
    { id: 'cérebro', label: 'Cérebro', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8.25 6.75h7.5M8.25 12h7.5m-7.5 5.25h7.5m-11.25-2.25L4.5 13.5m0 0l-1.5-1.5M4.5 13.5V15m15-1.5L19.5 13.5m0 0l-1.5-1.5m1.5 1.5V15M3 12a9 9 0 1118 0 9 9 0 01-18 0z" /></svg> },
    { id: 'integrações', label: 'Integrações', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg> },
    { id: 'memória', label: 'Dados', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7a8 8 0 0116 0" /></svg> },
    { id: 'arquitetura', label: 'Arquitetura', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h7.5M8.25 12h7.5m-7.5 5.25h7.5m-11.25-2.25L4.5 13.5m0 0l-1.5-1.5M4.5 13.5V15m15-1.5L19.5 13.5m0 0l-1.5-1.5m1.5 1.5V15M3 12a9 9 0 1118 0 9 9 0 01-18 0z" /></svg> },
    { id: 'monitor', label: 'Monitor', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a4 4 0 00-4-4H3V9h2a4 4 0 004-4V3l4 4-4 4zm6 0v-2a4 4 0 014-4h2V9h-2a4 4 0 01-4-4V3l-4 4 4 4z" /></svg> },
];

const creatorNavItem: { id: Tab; label: string; icon: React.ReactNode } = { id: 'gerenciamento', label: 'Gerenciamento', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg> };


export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isVisible, settings, onSettingsChange, onClose, token, onLogout, userId, initialTab = 'geral' }) => {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [userRole, setUserRole] = useState<UserRole>('Standard');

  useEffect(() => {
    setLocalSettings(settings);
    db.getUserProfile(userId).then(profile => {
      if (profile) setUserRole(profile.role);
    });
  }, [settings, userId]);
  
  useEffect(() => {
    if (isVisible) {
      setActiveTab(initialTab);
    }
  }, [isVisible, initialTab]);
  
  const handleSave = () => {
    setSaveStatus('saving');
    onSettingsChange(localSettings);
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => {
        setSaveStatus('idle');
        onClose();
      }, 1200);
    }, 500);
  };
  
  const renderTabContent = () => {
    switch (activeTab) {
      case 'geral': return <GeneralSettings settings={localSettings} setSettings={setLocalSettings} />;
      case 'cérebro': return <BrainSettings settings={localSettings} setSettings={setLocalSettings} />;
      case 'integrações': return <IntegrationsSettings settings={localSettings} setSettings={setLocalSettings} />;
      case 'memória': return <MemorySettings userId={userId} token={token} onLogout={onLogout} />;
      // FIX: The CognitiveStatus component is now rendered as a tab content, so it no longer needs panel-specific props like 'onClose' or 'isVisible'.
      case 'arquitetura': return <CognitiveStatus userId={userId} />;
      // FIX: The ReflectionHistory component is now rendered as a tab content, so it no longer needs panel-specific props like 'onClose' or 'isVisible'.
      case 'monitor': return <ReflectionHistory settings={localSettings} userId={userId} />;
      case 'gerenciamento': return userRole === 'Creator' ? <CreatorPanel settings={localSettings} setSettings={setLocalSettings} userId={userId} /> : null;
      default: return null;
    }
  };

  const navItems = userRole === 'Creator' ? [...baseNavItems, creatorNavItem] : baseNavItems;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div 
          className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center backdrop-blur-sm p-4" 
          onClick={onClose}
          variants={backdropVariants} initial="hidden" animate="visible" exit="hidden"
        >
          <motion.div 
            className="bg-gray-800/80 border border-gray-700/80 rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] max-h-[700px] flex overflow-hidden" 
            onClick={e => e.stopPropagation()}
            variants={panelVariants} initial="hidden" animate="visible" exit="exit"
          >
            {/* Sidebar */}
            <nav className="w-56 bg-gray-900/50 p-4 border-r border-gray-700/50 flex flex-col">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 16v-2m8-8h2M4 12H2m15.364 6.364l-1.414-1.414M6.343 6.343l-1.414-1.414m12.728 0l-1.414 1.414M6.343 17.657l-1.414 1.414M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                    </div>
                    <h2 className="text-xl font-bold text-white">Nexus</h2>
                </div>
                <ul className="space-y-2">
                    {navItems.map(item => (
                        <li key={item.id}>
                            <button
                                onClick={() => setActiveTab(item.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors relative ${
                                    activeTab === item.id ? 'text-white' : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
                                }`}
                            >
                                {activeTab === item.id && (
                                    <motion.div layoutId="active-nav-indicator" className="absolute inset-0 bg-cyan-500/20 rounded-md" />
                                )}
                                <span className="relative z-10">{item.icon}</span>
                                <span className="relative z-10">{item.label}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>

            {/* Content */}
            <div className="flex-1 flex flex-col">
              <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-700/50 h-16">
                <h2 className="text-xl font-bold text-white capitalize">{activeTab}</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </header>
              <main className="flex-grow p-6 overflow-y-auto">
                <AnimatePresence mode="wait">
                    <motion.div key={activeTab} variants={contentVariants} initial="hidden" animate="visible" exit="hidden">
                         <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-400">Carregando painel...</div>}>
                            {renderTabContent()}
                        </Suspense>
                    </motion.div>
                </AnimatePresence>
              </main>
              <footer className="flex-shrink-0 flex items-center justify-end p-4 border-t border-gray-700/50 gap-3 bg-gray-800/50 h-20">
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
                      {saveStatus === 'idle' && 'Salvar e Fechar'}
                      {saveStatus === 'saving' && <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin mx-auto"></div>}
                      {saveStatus === 'saved' && 'Salvo!'}
                  </motion.button>
              </footer>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};