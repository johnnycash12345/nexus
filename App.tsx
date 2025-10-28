



import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
// FIX: Import `Variants` type from framer-motion to correctly type animation variants.
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { AssistantStatus, ChatMessage, AppSettings, Emotion, VisualState, SimpleFunctionCall } from './types';
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

const SettingsPanel = lazy(() => import('./components/SettingsPanel').then(m => ({ default: m.SettingsPanel })));
const CameraView = lazy(() => import('./components/CameraView').then(m => ({ default: m.CameraView })));
const TodoList = lazy(() => import('./components/TodoList').then(m => ({ default: m.TodoList })));
const ReflectionHistory = lazy(() => import('./components/ReflectionHistory').then(m => ({ default: m.ReflectionHistory })));
const CognitiveStatus = lazy(() => import('./components/CognitiveStatus').then(m => ({ default: m.CognitiveStatus })));

type ActivePanel = 'settings' | 'camera' | 'todo' | 'reflectionHistory' | 'cognitiveStatus' | null;

const withVibration = <T extends (...args: any[]) => any>(fn: T) => {
    return (...args: Parameters<T>): ReturnType<T> => {
        if (navigator.vibrate) {
            navigator.vibrate(15);
        }
        return fn(...args);
    };
};

const fabContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const fabItemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 120 }
  },
};

const FloatingActionButtons: React.FC<{ onOpenPanel: (panel: ActivePanel) => void, onOpenChat: () => void, hasNewMessage: boolean }> = React.memo(({ onOpenPanel, onOpenChat, hasNewMessage }) => (
    <motion.div 
      className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-6 z-30 flex flex-col items-end gap-3"
      variants={fabContainerVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
    >
        <motion.button variants={fabItemVariants} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
            onClick={withVibration(() => onOpenPanel('cognitiveStatus'))} aria-label="Abrir status cognitivo"
            className="w-16 h-16 bg-gray-700/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-gray-600 transition-colors"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h7.5M8.25 12h7.5m-7.5 5.25h7.5m-11.25-2.25L4.5 13.5m0 0l-1.5-1.5M4.5 13.5V15m15-1.5L19.5 13.5m0 0l-1.5-1.5m1.5 1.5V15M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
            </svg>
        </motion.button>
        <motion.button variants={fabItemVariants} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
            onClick={withVibration(() => onOpenPanel('reflectionHistory'))} aria-label="Abrir monitor cognitivo"
            className="w-16 h-16 bg-gray-700/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-gray-600 transition-colors"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
        </motion.button>
        <motion.button variants={fabItemVariants} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
            onClick={withVibration(() => onOpenPanel('todo'))} aria-label="Abrir lista de tarefas"
            className="w-16 h-16 bg-gray-700/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-gray-600 transition-colors"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
        </motion.button>
        <motion.button variants={fabItemVariants} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
            onClick={withVibration(onOpenChat)} aria-label="Abrir chat"
            className="w-16 h-16 bg-cyan-600 rounded-full flex items-center justify-center shadow-lg hover:bg-cyan-500 transition-colors"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            {hasNewMessage && (<span className="absolute top-0 right-0 block h-4 w-4 rounded-full bg-red-500 border-2 border-white animate-pulse"></span>)}
        </motion.button>
    </motion.div>
));

const App: React.FC = () => {
  const [status, setStatus] = useState<AssistantStatus>('IDLE');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isStarted, setIsStarted] = useState(false);
  const [thought, setThought] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [emotionIntensity, setEmotionIntensity] = useState(1.0);
  const [emotion, setEmotion] = useState<Emotion>('CALM');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isEvolving, setIsEvolving] = useState(false);

  const { token, status: syncStatus, login, logout } = useGoogleSync();
  const { speak: speakFromHook, stop } = useSpeech(settings, status);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const orchestratorRef = useRef<CognitiveOrchestrator | null>(null);
  const isChatVisibleRef = useRef(isChatVisible);
  const consecutiveErrorsRef = useRef(0);
  const CONSECUTIVE_ERROR_THRESHOLD = 3;


  const speak = useCallback((text: string, onEnd?: () => void) => {
    speakFromHook(text, onEnd);
  }, [speakFromHook]);

  useEffect(() => {
    isChatVisibleRef.current = isChatVisible;
  }, [isChatVisible]);
  
  // Thought bubble handler
  useEffect(() => {
    const handleThoughtUpdate = (event: CustomEvent) => {
        const { text, type } = event.detail;
        let formattedText = text;
        if (type === 'symbolic_log') {
            // Shorten symbolic logs for the thought bubble
            formattedText = text.replace('[LOG]', '📝').substring(0, 80) + '...';
        } else if (type === 'error') {
            formattedText = `❗ ${text}`;
        }
        setThought(formattedText);
        const timer = setTimeout(() => setThought(null), 6000);
        return () => clearTimeout(timer);
    };
    window.addEventListener('nexus-thought-update', handleThoughtUpdate as EventListener);
    return () => window.removeEventListener('nexus-thought-update', handleThoughtUpdate as EventListener);
  }, []);

  // Visual state handler (for future UI integration)
  useEffect(() => {
    const handleVisualStateUpdate = (event: CustomEvent<VisualState>) => {
        console.log("Visual State Update:", event.detail);
        // Here you would pass event.detail to a 3D visualization component
    };
    window.addEventListener('nexus-visual-state-update', handleVisualStateUpdate as EventListener);
    return () => window.removeEventListener('nexus-visual-state-update', handleVisualStateUpdate as EventListener);
  }, []);


  // Emotion change handler
  useEffect(() => {
    const handleEmotionUpdate = (event: CustomEvent) => {
        const { emotion, intensity } = event.detail as { emotion: Emotion, intensity?: number };
        setEmotion(emotion);
        setEmotionIntensity(intensity ?? 1.0);
        
        const nonEmotionalStatuses: AssistantStatus[] = ['IDLE', 'SLEEPY', 'SUCCESS', 'ERROR', 'CURIOUS'];
        if (nonEmotionalStatuses.includes(status)) {
            const emotionToStatusMap: Partial<Record<Emotion, AssistantStatus>> = {
                'JOYFUL': 'SUCCESS',
                'UNCERTAIN': 'CURIOUS',
                'AFRAID': 'ERROR',
                'FOCUSED': 'IDLE',
                'CURIOUS': 'CURIOUS',
                'CALM': 'IDLE',
            };
            const newStatus = emotionToStatusMap[emotion];
            if (newStatus && newStatus !== status) setStatus(newStatus);
        }
    };
    window.addEventListener('nexus-emotion-update', handleEmotionUpdate as EventListener);
    return () => window.removeEventListener('nexus-emotion-update', handleEmotionUpdate as EventListener);
  }, [status]);


  // Auto-start app after successful sync
  useEffect(() => {
      if (token && (syncStatus.includes('sucesso') || syncStatus.includes('salvo'))) {
          const timer = setTimeout(() => setIsStarted(true), 2000);
          return () => clearTimeout(timer);
      }
  }, [token, syncStatus]);

  const addMessage = useCallback(async (message: ChatMessage) => {
    const messageWithTimestamp = { ...message, timestamp: Date.now() };
    setMessages(prev => {
        const newMessages = [...prev.filter(m => m.type !== 'status'), messageWithTimestamp];
        db.addChatMessage(messageWithTimestamp);
        return newMessages;
    });
    if (message.role === 'model' && !isChatVisibleRef.current) {
        setHasNewMessage(true);
    }
  }, []);

  const handleNewTurn = useCallback(async (turn: TranscriptionTurn) => {
      if (turn.user) await addMessage({ role: 'user', text: turn.user, type: 'message' });
      if (turn.model) await addMessage({ role: 'model', text: turn.model, type: 'message' });
  }, [addMessage]);

  const handleFunctionCall = useCallback(async (call: SimpleFunctionCall) => {
    if (orchestratorRef.current) {
      return await orchestratorRef.current.executeFunctionCall(call);
    }
    return { result: "O orquestrador cognitivo não está pronto." };
  }, []);

  const { 
    isSessionActive, 
    isNexusSpeaking,
    currentUserTranscript,
    currentNexusTranscript,
    startSession,
    endSession 
  } = useGeminiVoice(handleNewTurn, handleFunctionCall);
  
  const { generateResponse, generateVisionResponse } = useLlm(settings);
  
  // App Initialization
  useEffect(() => {
    const initializeApp = async () => {
      selfRepairSystem.autoHealOnCrash();
      const history = await db.getChatHistory();
      setMessages(history);
      const loadedSettings = await db.getSettings();
      setSettings(loadedSettings);
      setIsInitializing(false);
    };
    initializeApp();
  }, []);
  
  // Nexus Core Initialization
  useEffect(() => {
      if (isInitializing || !settings || !isStarted) return;
      const stableSpeak = (text: string, onEnd?: () => void) => speak(text, onEnd);

      const orchestrator = new CognitiveOrchestrator({
        speak: stableSpeak, addMessage, setStatus, generateResponse, generateVisionResponse,
        getSettings: db.getSettings, getUserProfile: db.getUserProfile, setUserProfile: db.saveUserProfile,
      });
      
      orchestrator.initialize();
      orchestratorRef.current = orchestrator;
      
      // Trigger awakening sequence if needed. The orchestrator checks internally.
      orchestrator.awakenIfNeeded().catch(error => {
          console.error("Error during awakening sequence:", error);
      });

      return () => { orchestrator.dispose(); };
  }, [isInitializing, isStarted, settings, addMessage, generateResponse, generateVisionResponse, speak, stop]);
  
  // --- Online Auto-Evolution Control ---
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleEvolutionStatus = (event: CustomEvent) => setIsEvolving(event.detail.isEvolving);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('nexus-evolution-status-update', handleEvolutionStatus as EventListener);
    
    // Stop evolution when tab is closed
    const handleBeforeUnload = () => orchestratorRef.current?.evolutionService.stop();
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        window.removeEventListener('nexus-evolution-status-update', handleEvolutionStatus as EventListener);
        window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
      if (!isStarted || !orchestratorRef.current) return;
      
      const evolutionService = orchestratorRef.current.evolutionService;
      if (isOnline && settings?.behavior?.permissions?.autoEvolutionEnabled) {
          evolutionService.start();
      } else {
          evolutionService.stop();
      }
  }, [isOnline, settings, isStarted]);


  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isChatVisible, currentUserTranscript, currentNexusTranscript]);

  useEffect(() => {
    const activeCognitiveStates = new Set<AssistantStatus>([
        'THINKING', 'REWRITING_CODE',
        'SELF_ANALYSIS', 'SEARCHING_WEB'
    ]);
    if (isSessionActive) {
        setStatus(isNexusSpeaking ? 'SPEAKING' : 'LISTENING');
    } else if (!activeCognitiveStates.has(status)) {
        if (status !== 'SUCCESS' && status !== 'ERROR' && status !== 'CURIOUS' && status !== 'ROLLBACK') {
            setStatus('IDLE');
        }
    }
  }, [isSessionActive, isNexusSpeaking, status]);

  const handleMicClick = withVibration(() => {
    orchestratorRef.current?.touchHeartbeat();
    if (status === 'SLEEPY') setStatus('IDLE');
    if (isSessionActive) { endSession(); } 
    else { setIsChatVisible(true); setHasNewMessage(false); startSession(); }
  });
  
  const handleTurn = async (text: string, currentHistory: ChatMessage[], imageData?: string) => {
    try {
        await orchestratorRef.current?.handleUserTurn(text, currentHistory, imageData);
        consecutiveErrorsRef.current = 0; // Reset on success
    } catch (error) {
        console.error("Caught error in App.tsx from handleUserTurn", error);
        consecutiveErrorsRef.current += 1;
        if (consecutiveErrorsRef.current >= CONSECUTIVE_ERROR_THRESHOLD) {
            console.warn(`[NEXUS-APP] Reached ${CONSECUTIVE_ERROR_THRESHOLD} consecutive errors. Triggering rollback.`);
            await orchestratorRef.current?.performRollback();
            consecutiveErrorsRef.current = 0; // Reset after rollback
        }
    }
  };

  const handleTextSubmit = withVibration(async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text) return;
    if(isSessionActive) endSession();
    setInputValue('');
    const userMessage: ChatMessage = { role: 'user', text, type: 'message' };
    await addMessage(userMessage);
    setIsChatVisible(true);
    setHasNewMessage(false);
    const currentHistory = [...messages, userMessage];
    await handleTurn(text, currentHistory);
  });
  
  const handleVisionSubmit = async (imageData: string, prompt: string) => {
      if(isSessionActive) endSession();
      setActivePanel(null); // Close camera panel
      const userMessage: ChatMessage = {
          role: 'user', text: prompt || 'O que você vê aqui?', type: 'message', imageUrl: imageData,
      };
      await addMessage(userMessage);
      setIsChatVisible(true);
      setHasNewMessage(false);
      const currentHistory = [...messages, userMessage];
      await handleTurn(prompt, currentHistory, imageData);
  };

  const onSettingsChange = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    await db.saveSettings(newSettings);
  };

  const handleMessageAction = async (action: string, payload: any) => {
    if (action === 'merge_concepts' && payload) {
        await orchestratorRef.current?.performConceptMerge(payload);
        setMessages(prev => prev.filter(m => m.type !== 'concept_consolidation_prompt'));
    }
    if (action === 'ignore_consolidation') {
        setMessages(prev => prev.filter(m => m.type !== 'concept_consolidation_prompt'));
    }
    if (action === 'apply_code_change') {
        await orchestratorRef.current?.applyCodeModification();
        setMessages(prev => prev.filter(m => m.type !== 'code_proposal_prompt'));
    }
    if (action === 'reject_code_change') {
        await orchestratorRef.current?.rejectCodeModification();
        setMessages(prev => prev.filter(m => m.type !== 'code_proposal_prompt'));
    }
  };
  
  const handleAttachClick = withVibration(() => {
    fileInputRef.current?.click();
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        addMessage({ role: 'model', text: 'Por favor, selecione um arquivo de imagem.', type: 'status' });
        return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
        const imageData = event.target?.result as string;
        if (imageData) await handleVisionSubmit(imageData, 'O que você vê nesta imagem?');
    };
    reader.onerror = () => {
        addMessage({ role: 'model', text: 'Desculpe, não consegui ler o arquivo de imagem.', type: 'status' });
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = '';
  };

  const chatPanelVariants: Variants = {
    hidden: { y: "100%" },
    visible: { y: "0%" },
  };

  const openChat = useCallback(() => {
    setIsChatVisible(true);
    setHasNewMessage(false);
  }, []);

  if (isInitializing || !settings) {
    return <div className="h-screen w-screen bg-gray-900 flex items-center justify-center"><p>Despertando Nexus...</p></div>
  }
  
  const statusInfo = {
    color: isOnline ? (isEvolving ? 'bg-green-400' : 'bg-blue-400') : 'bg-red-500',
    text: isOnline ? (isEvolving ? 'Evoluindo' : 'Online') : 'Offline'
  };

  return (
    <div className="h-screen w-screen bg-gray-900 text-white flex flex-col overflow-hidden relative">
      <style>{`
        @keyframes fade-in-out { 0%, 100% { opacity: 0; transform: translateY(10px) scale(0.95); } 10%, 90% { opacity: 1; transform: translateY(0) scale(1); } }
        .animate-fade-in-out { animation: fade-in-out 6s ease-in-out forwards; }
        .bg-gradient-radial { background-image: radial-gradient(circle, var(--tw-gradient-stops)); }
        .mic-listening-glow { animation: mic-listening-glow-kf 2s ease-in-out infinite; }
        @keyframes mic-listening-glow-kf { 0%, 100% { box-shadow: 0 0 8px 2px rgba(239, 68, 68, 0.7); } 50% { box-shadow: 0 0 16px 4px rgba(239, 68, 68, 0.4); } }
      `}</style>
      {!isStarted ? (
          <StartScreen 
              onStart={() => setIsStarted(true)} onOpenSettings={() => setActivePanel('settings')}
              token={token} syncStatus={syncStatus} onLogin={login}
          />
      ) : (
        <>
           <motion.div 
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 100, delay: 0.5 }}
            className="fixed top-4 left-4 z-30 p-2 bg-gray-800/70 backdrop-blur-sm rounded-lg text-sm flex items-center gap-2 shadow-lg border border-gray-700/50"
          >
            <span className={`w-3 h-3 rounded-full ${statusInfo.color} ${isEvolving ? 'animate-pulse' : ''} transition-colors`}></span>
            <span className="text-gray-300 font-medium">{statusInfo.text}</span>
          </motion.div>

          <motion.div 
            className="fixed inset-0 flex items-center justify-center z-20 pointer-events-none"
            animate={{ y: isChatVisible ? '-15vh' : '0vh' }}
            transition={{ type: 'spring', stiffness: 100, damping: 15 }}
          >
            <AvatarLayer 
              isChatOpen={isChatVisible} appearance={settings?.appearance ?? 'neutral'}
              status={status} intensity={emotionIntensity} emotion={emotion}
            />
             {thought && !isChatVisible && (
              <div className="absolute top-1/2 -translate-y-[12rem] left-1/2 -translate-x-1/2 z-30 p-3 bg-gray-700/90 backdrop-blur-sm rounded-lg shadow-lg animate-fade-in-out max-w-xs text-center border border-gray-600 pointer-events-auto">
                  <p className="text-sm text-gray-300 italic">{thought}</p>
              </div>
            )}
          </motion.div>

          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
            onClick={withVibration(() => setActivePanel('settings'))} aria-label="Abrir configurações"
            className="fixed top-4 right-4 z-30 p-2 bg-gray-700/50 rounded-full text-gray-300 hover:bg-gray-600/80 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066 2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </motion.button>
          
          <AnimatePresence>
            {!isChatVisible && (
              <FloatingActionButtons 
                  onOpenPanel={setActivePanel} 
                  onOpenChat={openChat}
                  hasNewMessage={hasNewMessage}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isChatVisible && (
              <motion.div 
                className="fixed bottom-0 left-0 right-0 max-h-[70vh] bg-gray-800/85 backdrop-blur-md rounded-t-2xl shadow-[0_-10px_30px_rgba(0,0,0,0.5)] flex flex-col z-10"
                variants={chatPanelVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              >
                <header className="flex-shrink-0 p-2 border-b border-gray-700/50 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-300 pl-2">Nexus</h3>
                    <button type="button" onClick={withVibration(() => setIsChatVisible(false))} aria-label="Recolher chat"
                        className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-gray-700 hover:bg-gray-600 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                </header>
                
                <div ref={chatContainerRef} className="flex-grow p-4 overflow-y-auto scroll-smooth pb-[calc(4rem+env(safe-area-inset-bottom))]">
                  <div className="flex flex-col space-y-4">
                    {messages.map((msg, index) => <Message key={msg.id || index} {...msg} onAction={handleMessageAction} />)}
                    {currentUserTranscript && (
                         <Message role="user" text={`${currentUserTranscript}...`} type="message" />
                    )}
                    {currentNexusTranscript && (
                        <Message role="model" text={`${currentNexusTranscript}...`} type="message" />
                    )}
                  </div>
                </div>
                
                <footer className="flex-shrink-0 p-2 border-t border-gray-700/50 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
                     <form onSubmit={handleTextSubmit} className="flex items-center gap-2">
                        <div className="flex-shrink-0 flex items-center gap-2">
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                            <motion.button type="button" onClick={handleAttachClick} aria-label="Anexar imagem" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                                className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-gray-600 hover:bg-gray-500 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                            </motion.button>
                            <motion.button type="button" onClick={withVibration(() => setActivePanel('camera'))} aria-label="Abrir câmera" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                                className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-gray-600 hover:bg-gray-500 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>
                            </motion.button>
                        </div>
                        <div className="relative flex-grow">
                             <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="Digite uma mensagem..."
                                className="w-full bg-gray-700 rounded-full pl-4 pr-12 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                            <div className="absolute right-1 top-1/2 -translate-y-1/2">
                                <AnimatePresence>
                                {inputValue.trim() ? (
                                    <motion.button type="submit" aria-label="Enviar mensagem"
                                        initial={{ scale: 0.5, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0.5, opacity: 0 }}
                                        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                                        className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-cyan-600 hover:bg-cyan-500 transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform rotate-90" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.428A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                                    </motion.button>
                                ) : (
                                    <motion.button type="button" onClick={handleMicClick} aria-label={isSessionActive ? 'Encerrar conversa' : 'Iniciar conversa por voz'}
                                        initial={{ scale: 0.5, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0.5, opacity: 0 }}
                                        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                                        className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center transition-all duration-300 ${isSessionActive ? 'bg-red-600 mic-listening-glow' : 'bg-cyan-600 hover:bg-cyan-500'}`}>
                                    {isSessionActive ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 5a1 1 0 011-1h8a1 1 0 011 1v8a1 1 0 01-1 1H6a1 1 0 01-1-1V5z" clipRule="evenodd" /></svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm5 3a1 1 0 11-2 0V4a1 1 0 112 0v3zM4 9a1 1 0 011-1h.01a1 1 0 110 2H5a1 1 0 01-1-1zM15 8a1 1 0 100 2h.01a1 1 0 100-2H15zM4 12a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm11-1a1 1 0 100 2h1a1 1 0 100-2h-1zM7 12a1 1 0 011-1h2a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
                                    )}
                                    </motion.button>
                                )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </form>
                </footer>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
      
      <Suspense fallback={null}>
        <AnimatePresence>
          {activePanel === 'settings' && <SettingsPanel isVisible={true} settings={settings} onSettingsChange={onSettingsChange} onClose={() => setActivePanel(null)} token={token} onLogout={logout} />}
          {isStarted && activePanel === 'camera' && <CameraView onClose={() => setActivePanel(null)} onSend={handleVisionSubmit} />}
          {isStarted && activePanel === 'todo' && <TodoList isVisible={activePanel === 'todo'} onClose={() => setActivePanel(null)} />}
          {isStarted && activePanel === 'reflectionHistory' && <ReflectionHistory settings={settings} isVisible={activePanel === 'reflectionHistory'} onClose={() => setActivePanel(null)} />}
          {isStarted && activePanel === 'cognitiveStatus' && <CognitiveStatus isVisible={activePanel === 'cognitiveStatus'} onClose={() => setActivePanel(null)} />}
        </AnimatePresence>
      </Suspense>
    </div>
  );
};

export default App;