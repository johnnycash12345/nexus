import React, { useState, useEffect, useRef, useCallback, lazy, Suspense, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// Adicionado SimpleFunctionCall para o hook de voz
import { AssistantStatus, ChatMessage, AppSettings, Emotion, SimpleFunctionCall } from './types'; 
import { useGeminiVoice, TranscriptionTurn } from './hooks/useGeminiVoice';
import { useLlm } from './hooks/useLlm';
import { db } from './services/indexedDBService';
import { AvatarLayer } from './components/AvatarLayer';
import { Message } from './components/Message';
import { CognitiveOrchestrator } from './services/nexusCore';
import { StartScreen } from './components/StartScreen';
import { useGoogleSync } from './hooks/useGoogleSync';
import { useSpeech } from './hooks/useSpeech';
import { selfRepairSystem } from './services/selfRepairSystem';
import { useProactiveAgent } from '@/hooks/useProactiveAgent'; 

// --- (Lazy Imports e Tipos) ---
const SettingsPanel = lazy(() => import('./components/SettingsPanel').then(m => ({ default: m.SettingsPanel })));
const CameraView = lazy(() => import('./components/CameraView').then(m => ({ default: m.CameraView })));
const TodoList = lazy(() => import('./components/TodoList').then(m => ({ default: m.TodoList })));
const ReflectionHistory = lazy(() => import('./components/ReflectionHistory').then(m => ({ default: m.ReflectionHistory })));
const CognitiveStatus = lazy(() => import('./components/CognitiveStatus').then(m => ({ default: m.CognitiveStatus })));

type ActivePanel = 'settings' | 'camera' | 'todo' | 'reflectionHistory' | 'cognitiveStatus' | null;
type Thought = { text: string; type: 'symbolic_log' | 'error' };
// --- (Fim dos imports e tipos) ---

// ----------------------------------------------------------------------
// Ícones SVG embutidos (sem necessidade de npm install)
// ----------------------------------------------------------------------
const IconCog = () => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.242 1.417l-1.07 1.07c-.098.098-.176.21-.233.327.022.109.034.224.034.341s-.012.232-.034.341c.057.117.135.229.233.327l1.07 1.07c.418.418.63.96.484 1.487l-.004.017a1.125 1.125 0 01-.242 1.417l-1.296 2.247a1.125 1.125 0 01-1.37.49l-1.217-.456c-.355-.133-.75-.072-1.075.124a6.57 6.57 0 01-.22.128c-.332.183-.582.495-.645.87l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.063-.374-.313-.686-.645-.87a6.52 6.52 0 01-.22-.127c-.324-.196-.72-.257-1.075-.124l-1.217.456a1.125 1.125 0 01-1.37-.49l-1.296-2.247a1.125 1.125 0 01.242-1.417l1.07-1.07c.098-.098.176-.21.233-.327a7.025 7.025 0 00-.034-.341c0-.117.012-.232.034-.341a.7.7 0 00-.233-.326l-1.07-1.07a1.125 1.125 0 01-.484-1.487l.004-.017a1.125 1.125 0 01.242-1.417l1.296-2.247a1.125 1.125 0 011.37-.49l1.217.456c.355.133.75.072 1.075-.124.072-.044.146-.087.22-.128.332-.183.582-.495.645-.87l.213-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>);
const IconCamera = () => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.04l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" /></svg>);
const IconTodo = () => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>);
const IconReflections = () => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.898 20.64l-.218-1.035a3.375 3.375 0 00-2.455-2.456L13.2 16.125l1.035-.218a3.375 3.375 0 002.456-2.456l.218-1.035L18 13.5l.218 1.035a3.375 3.375 0 002.456 2.456l1.035.218-.218 1.035a3.375 3.375 0 00-2.456 2.456L18 21l-.218-1.035z" /></svg>);
const IconCognitive = () => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M8.25 21v-1.5M21 15.75h-1.5M15.75 3v1.5M3 15.75h1.5M15.75 21v-1.5m-3.375-3.375L12 17.25l-1.125.375-3.375 3.375-1.5-1.5 3.375-3.375L6.75 12l.375-1.125L3 7.5l1.5-1.5 3.375 3.375L8.25 6l1.125-.375L12 3l1.125.375 3.375-3.375 1.5 1.5-3.375 3.375L17.25 12l-.375 1.125 3.375 3.375 1.5-1.5-3.375-3.375L15.75 18l-1.125.375L12 21.375l-1.125-.375-3.375-3.375z" /></svg>);
const IconChat = () => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-2.138a1.125 1.125 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>);
const IconMic = () => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15a3 3 0 01-3-3V4.5a3 3 0 016 0v7.5a3 3 0 01-3 3z" /></svg>);
// ----------------------------------------------------------------------


// ----------------------------------------------------------------------
// Subcomponente NavButton (Aprimorado para aceitar classes de tema)
// ----------------------------------------------------------------------
interface NavButtonProps {
  onClick: () => void;
  isActive: boolean;
  children: React.ReactNode;
  label: string; 
  className?: string;
  activeClasses: string; // APRIMORAMENTO: Classes de tema dinâmico
}

const NavButton: React.FC<NavButtonProps> = ({ onClick, isActive, children, label, className = '', activeClasses }) => (
  <button
    onClick={onClick}
    title={label}
    className={`p-3 rounded-lg transition-all duration-200 ${
      isActive
        ? activeClasses // Usa as classes de tema dinâmico
        : 'text-gray-400 hover:text-white hover:bg-gray-700/50' // Inativo
    } ${className}`}
  >
    {children}
  </button>
);
// ----------------------------------------------------------------------


const App: React.FC = () => {
  // --- (Hooks de Estado) ---
  const [status, setStatus] = useState<AssistantStatus>('IDLE');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isStarted, setIsStarted] = useState(false);
  const [thought, setThought] = useState<Thought | null>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [emotion, setEmotion] = useState<Emotion>('CALM');
  const [isOnline] = useState(navigator.onLine);
  const [isEvolving, setIsEvolving] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('paulo-creator-001');

  const [isVoiceListening, setIsVoiceListening] = useState(false);

  const { isThinking, lastReflection, lastInsight } = useProactiveAgent(currentUserId);
  const { token, status: syncStatus, login, logout } = useGoogleSync(currentUserId);
  const { speak: speakFromHook } = useSpeech(settings, status);
  const { generateResponse, generateVisionResponse } = useLlm(settings);

  const orchestratorRef = useRef<CognitiveOrchestrator | null>(null);
  const isChatVisibleRef = useRef(isChatVisible);
  const thoughtTimer = useRef<number | null>(null);
  const messagesRef = useRef(messages);

  // ----------------------------------------------------------------------
  // APRIMORAMENTO: Hook de Tema Dinâmico
  // ----------------------------------------------------------------------
  const appTheme = useMemo(() => {
    const appearance = settings?.appearance || 'neutral';
    if (appearance === 'feminine') {
      // Tema Rosa ("não muito forte")
      return {
        text: 'text-pink-300',
        bg: 'bg-pink-600/50',
        focusRing: 'focus:ring-pink-500',
        submitBg: 'bg-pink-600 hover:bg-pink-500',
        notificationBg: 'bg-pink-500',
      };
    }
    // Padrão (neutral/masculine) - Tema Ciano
    return {
      text: 'text-cyan-300',
      bg: 'bg-cyan-600/50',
      focusRing: 'focus:ring-cyan-500',
      submitBg: 'bg-cyan-600 hover:bg-cyan-500',
      notificationBg: 'bg-cyan-500',
    };
  }, [settings?.appearance]);
  // ----------------------------------------------------------------------

  // --- (Funções de Callback e Efeitos - Sem alteração) ---
  const speak = useCallback((text: string, onEnd?: () => void) => {
    speakFromHook(text, onEnd);
  }, [speakFromHook]);

  useEffect(() => {
    isChatVisibleRef.current = isChatVisible;
  }, [isChatVisible]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const addMessage = useCallback(async (message: Omit<ChatMessage, 'userId' | 'timestamp'>) => {
    const messageWithTimestamp: ChatMessage = { ...message, userId: currentUserId, timestamp: Date.now() };
    setMessages(prev => {
      const newMessages = [...prev.filter(m => m.type !== 'status'), messageWithTimestamp];
      db.addChatMessage(currentUserId, messageWithTimestamp);
      return newMessages;
    });
    if (message.role === 'model' && !isChatVisibleRef.current) {
      setHasNewMessage(true);
    }
  }, [currentUserId]);

  useEffect(() => {
    const handleThought = (event: CustomEvent<Thought>) => {
      setThought(event.detail);
      if (thoughtTimer.current) clearTimeout(thoughtTimer.current);
      thoughtTimer.current = window.setTimeout(() => setThought(null), 5000);
    };
    window.addEventListener('nexus-thought-update', handleThought as EventListener);
    return () => {
      window.removeEventListener('nexus-thought-update', handleThought as EventListener);
      if (thoughtTimer.current) clearTimeout(thoughtTimer.current);
    };
  }, []);

  useEffect(() => {
    const initializeApp = async () => {
      selfRepairSystem.autoHealOnCrash();
      await db.getOrCreateUser(currentUserId, { 
        name: currentUserId === 'paulo-creator-001' ? 'Paulo' : 'Usuário Padrão',
        role: currentUserId === 'paulo-creator-001' ? 'Creator' : 'Standard'
      });
      const history = await db.getChatHistory(currentUserId);
      setMessages(history);
      const loadedSettings = await db.getSettings(currentUserId);
      setSettings(loadedSettings);
      setIsInitializing(false);
    };
    initializeApp();
  }, [currentUserId]);

  useEffect(() => {
    if (isInitializing || !settings || !isStarted) return;
    const orchestrator = new CognitiveOrchestrator({
      userId: currentUserId,
      speak, addMessage, setStatus,
      generateResponse: (prompt, history, options) => generateResponse(prompt, history, options),
      generateVisionResponse: (prompt, imageUrl) => generateVisionResponse(prompt, imageUrl),
    });
    orchestratorRef.current = orchestrator;
    const startNexus = async () => {
      await orchestrator.initialize();
      await orchestrator.awakenIfNeeded().catch(error => {
        console.error("Error during awakening sequence:", error);
      });
    };
    startNexus();
    return () => { orchestrator.dispose(); };
  }, [isInitializing, isStarted, settings, currentUserId, addMessage, speak, generateResponse, generateVisionResponse]);

  // --- (Lógica de Chat por Voz - Sem alteração) ---
  const handleVoiceTranscription = useCallback(async (turn: TranscriptionTurn) => {
    if (turn.isFinal && turn.text && orchestratorRef.current) {
      const text = turn.text;
      const userMessage: Omit<ChatMessage, 'userId' | 'timestamp'> = { role: 'user', text, type: 'message' };
      await addMessage(userMessage);
      setIsChatVisible(true);
      setHasNewMessage(false);
      const currentHistory = [...messagesRef.current, { ...userMessage, userId: currentUserId, timestamp: Date.now() }];
      await orchestratorRef.current.handleUserTurn(text, currentHistory);
    }
  }, [currentUserId, addMessage]);

  const handleVoiceFunctionCall = useCallback(async (call: SimpleFunctionCall) => {
    if (orchestratorRef.current) {
      const { result } = await orchestratorRef.current.executeFunctionCall(call);
      return result;
    }
    return { error: 'Orchestrator not ready.' };
  }, []);

  const handleVoiceStatusChange = useCallback((voiceStatus: 'idle' | 'listening' | 'speaking' | 'processing') => {
    if (voiceStatus === 'listening') {
      setStatus('LISTENING');
      setIsVoiceListening(true);
    } else if (voiceStatus === 'speaking') {
      setStatus('SPEAKING');
      setIsVoiceListening(false);
    } else if (voiceStatus === 'processing') {
      setStatus('THINKING');
      setIsVoiceListening(false);
    } else {
      setStatus('IDLE');
      setIsVoiceListening(false);
    }
  }, []);

  const { startListening, stopListening } = useGeminiVoice({
    apiKey: settings?.googleApiKey || '',
    onTranscription: handleVoiceTranscription,
    onFunctionCall: handleVoiceFunctionCall,
    onStatusChange: handleVoiceStatusChange,
    onError: (e) => {
      console.error('Voice Error:', e);
      addMessage({ role: 'model', text: `Erro de voz: ${e.message}`, type: 'status' });
      setIsVoiceListening(false);
      setStatus('ERROR');
    },
  });

  const handleToggleVoice = () => {
    if (isVoiceListening) {
      stopListening();
    } else {
      startListening();
    }
  };
  // ----------------------------------------------------------------------

  // --- (Callbacks de Submit/Ação - Sem alteração) ---
  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text) return;
    setInputValue('');
    const userMessage: Omit<ChatMessage, 'userId' | 'timestamp'> = { role: 'user', text, type: 'message' };
    await addMessage(userMessage);
    setIsChatVisible(true);
    setHasNewMessage(false);
    const currentHistory = [...messagesRef.current, { ...userMessage, userId: currentUserId, timestamp: Date.now() }];
    await orchestratorRef.current?.handleUserTurn(text, currentHistory);
  };

  const handleVisionSubmit = async (imageData: string, prompt: string) => {
    setActivePanel(null);
    const userMessage: Omit<ChatMessage, 'userId' | 'timestamp'> = {
      role: 'user', text: prompt || 'O que você vê aqui?', type: 'message', imageUrl: imageData,
    };
    await addMessage(userMessage);
    setIsChatVisible(true);
    setHasNewMessage(false);
    const currentHistory = [...messagesRef.current, { ...userMessage, userId: currentUserId, timestamp: Date.now() }];
    await orchestratorRef.current?.handleUserTurn(prompt, currentHistory, imageData);
  };

  const onSettingsChange = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    await db.saveSettings(currentUserId, newSettings);
  };

  const handleMessageAction = async (action: string, payload: any) => {
    if (!orchestratorRef.current) return;
    switch (action) {
      // ... (cases mantidos)
      case 'merge_concepts':
        await orchestratorRef.current.performConceptMerge(payload);
        setMessages(prev => prev.filter(m => m.type !== 'concept_consolidation_prompt'));
        break;
      case 'ignore_consolidation':
        setMessages(prev => prev.filter(m => m.type !== 'concept_consolidation_prompt'));
        break;
      case 'apply_code_change':
        await orchestratorRef.current.applyCodeModification();
        setMessages(prev => prev.filter(m => m.type !== 'code_proposal_prompt'));
        break;
      case 'reject_code_change':
        await orchestratorRef.current.rejectCodeModification();
        setMessages(prev => prev.filter(m => m.type !== 'code_proposal_prompt'));
        break;
    }
  };

  const handlePanelClick = (panel: ActivePanel) => {
    setActivePanel(current => (current === panel ? null : panel));
  };
  // --- (Fim das Funções de Callback) ---


  // ----------------------------------------------------------------------
  // RENDERIZAÇÃO (JSX APRIMORADO COM TEMA DINÂMICO)
  // ----------------------------------------------------------------------
  return (
    <div className="h-screen w-screen bg-gray-900 text-white flex flex-col overflow-hidden relative">
      {/* --- Painéis de Overlay (Configurações, Câmera, etc.) --- */}
      <Suspense fallback={<div className="flex-grow flex items-center justify-center">Carregando...</div>}>
        {activePanel === 'settings' && settings && (
          <SettingsPanel 
            isVisible={activePanel === 'settings'}
            settings={settings}
            onSettingsChange={onSettingsChange}
            onClose={() => setActivePanel(null)}
            token={token}
            onLogout={logout}
            userId={currentUserId}
          />
        )}
        {activePanel === 'camera' && <CameraView onClose={() => setActivePanel(null)} onSend={handleVisionSubmit} />}
        {activePanel === 'todo' && <TodoList onClose={() => setActivePanel(null)} isVisible={activePanel === 'todo'} userId={currentUserId} />}
        {activePanel === 'reflectionHistory' && <ReflectionHistory onClose={() => setActivePanel(null)} isVisible={activePanel === 'reflectionHistory'} settings={settings} userId={currentUserId} />}
        {activePanel === 'cognitiveStatus' && <CognitiveStatus onClose={() => setActivePanel(null)} isVisible={activePanel === 'cognitiveStatus'} userId={currentUserId} />}
      </Suspense>

      {/* --- Contêiner Principal (Avatar, Chat, Painel Cognitivo) --- */}
      <div className="flex-grow flex items-center justify-center relative">
        {!isStarted ? (
          <StartScreen onStart={() => setIsStarted(true)} onOpenSettings={() => setActivePanel('settings')} token={token} syncStatus={syncStatus} onLogin={login}/>
        ) : (
          <>
            <AvatarLayer
              isChatOpen={isChatVisible}
              appearance={settings?.appearance ?? 'neutral'} // Passa a aparência para o avatar
              status={status}
              intensity={settings?.cognitive?.emotionalIntensity ?? 1.0}
              emotion={emotion}
              thought={thought}
              className="transition-all duration-500" 
            />

            {/* Painel Cognitivo (Movido para a esquerda) */}
            <AnimatePresence>
              {isStarted && !isChatVisible && (
                <motion.div
                  initial={{ opacity: 0, x: -50 }} 
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                  className="fixed bottom-6 left-6 bg-gray-900/60 backdrop-blur-lg p-3 rounded-xl text-xs text-gray-300 shadow-xl border border-gray-700/50 max-w-xs z-10"
                >
                  {isThinking ? (
                    <p>🤔 Nexus está refletindo...</p>
                  ) : (
                    <p>🧘 Nexus está em repouso cognitivo.</p>
                  )}
                  {lastReflection && (
                    <p className="mt-2 text-gray-400">
                      💭 <span className="font-medium">Última reflexão:</span> {lastReflection.slice(0, 100)}...
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Painel de Chat (com Cores Dinâmicas) */}
            <AnimatePresence>
              {isChatVisible && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="absolute inset-0 flex flex-col p-4 bg-gray-900/50 backdrop-blur-sm z-20"
                >
                  <div className="flex-grow overflow-y-auto space-y-4 pr-2">
                    {messages.map((msg, index) => <Message key={msg.id || index} {...msg} onAction={handleMessageAction} />)}
                  </div>
                  <form onSubmit={handleTextSubmit} className="mt-4 flex items-center gap-2">
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="Converse com o Nexus..."
                      // APLICA O TEMA DE FOCO
                      className={`flex-grow bg-gray-800 rounded-full px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 ${appTheme.focusRing}`}
                    />
                    <button 
                      type="submit" 
                      // APLICA O TEMA DE SUBMIT
                      className={`w-10 h-10 rounded-full flex-shrink-0 ${appTheme.submitBg} flex items-center justify-center`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* --- Footer (Barra de Ferramentas com Cores Dinâmicas) --- */}
      {isStarted && (
        <footer 
          className="flex-shrink-0 p-2 sm:p-3 bg-black/30 backdrop-blur-lg border-t border-gray-700/50 flex items-center justify-between z-30"
        >
          {/* Botões de Ferramentas (Esquerda) */}
          <div className="flex items-center gap-1 sm:gap-2">
            <NavButton label="Configurações" isActive={activePanel === 'settings'} onClick={() => handlePanelClick('settings')} activeClasses={`${appTheme.bg} ${appTheme.text}`}>
              <IconCog />
            </NavButton>
            <NavButton label="Câmera" isActive={activePanel === 'camera'} onClick={() => handlePanelClick('camera')} activeClasses={`${appTheme.bg} ${appTheme.text}`}>
              <IconCamera />
            </NavButton>
            <NavButton label="Tarefas" isActive={activePanel === 'todo'} onClick={() => handlePanelClick('todo')} activeClasses={`${appTheme.bg} ${appTheme.text}`}>
              <IconTodo />
            </NavButton>
            <NavButton label="Reflexões" isActive={activePanel === 'reflectionHistory'} onClick={() => handlePanelClick('reflectionHistory')} activeClasses={`${appTheme.bg} ${appTheme.text}`}>
              <IconReflections />
            </NavButton>
            <NavButton label="Status Cognitivo" isActive={activePanel === 'cognitiveStatus'} onClick={() => handlePanelClick('cognitiveStatus')} activeClasses={`${appTheme.bg} ${appTheme.text}`}>
              <IconCognitive />
            </NavButton>
          </div>
          
          {/* Botões de Ação (Direita) */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Botão de Microfone */}
            <NavButton 
              label={isVoiceListening ? "Parar de ouvir" : "Ativar voz"} 
              isActive={isVoiceListening} 
              onClick={handleToggleVoice}
              activeClasses={`${appTheme.bg} ${appTheme.text}`} // Usa o tema ativo (mas será sobrescrito pelo vermelho)
              className={isVoiceListening ? '!bg-red-600/70 !text-red-100 animate-pulse' : ''} 
            >
              <IconMic />
            </NavButton>
            
            {/* Botão de Chat */}
            <NavButton
              label={isChatVisible ? "Fechar Chat" : "Abrir Chat"}
              isActive={isChatVisible}
              onClick={() => { setIsChatVisible(!isChatVisible); setHasNewMessage(false); }}
              className="relative"
              activeClasses={`${appTheme.bg} ${appTheme.text}`} // Aplica o tema ativo
            >
              <IconChat />
              {hasNewMessage && (
                // APLICA O TEMA DE NOTIFICAÇÃO
                <span className={`absolute top-2 right-2 w-2.5 h-2.5 ${appTheme.notificationBg} rounded-full border-2 border-gray-900 animate-pulse`}></span>
              )}
            </NavButton>
          </div>
        </footer>
      )}
    </div>
  );
};

export default App;