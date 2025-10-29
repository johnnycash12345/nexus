import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { AssistantStatus, ChatMessage, AppSettings, Emotion, SimpleFunctionCall } from '@/types';
import { useGeminiVoice, TranscriptionTurn } from '@/hooks/useGeminiVoice';
import { useLlm } from '@/hooks/useLlm';
import { db } from '@/services/indexedDBService';
import { AvatarLayer } from '@/components/AvatarLayer';
import { Message } from '@/components/Message';
import { CognitiveOrchestrator } from '@/services/nexusCore';
import { StartScreen } from '@/components/StartScreen';
import { useGoogleSync } from '@/hooks/useGoogleSync';
import { useSpeech } from '@/hooks/useSpeech';
import { selfRepairSystem } from '@/services/selfRepairSystem';
import { systemMonitor } from '@/services/systemMonitor';
import { reflectionEngine } from '@/services/reflectionEngine';
import { cognitiveMonitor } from '@/services/cognitiveMonitor';
import type { Tab as SettingsTab } from '@/components/SettingsPanel';


const SettingsPanel = lazy(() => import('@/components/SettingsPanel').then(m => ({ default: m.SettingsPanel })));
const CameraView = lazy(() => import('@/components/CameraView').then(m => ({ default: m.CameraView })));
const TodoList = lazy(() => import('@/components/TodoList').then(m => ({ default: m.TodoList })));

type ActivePanel = 'settings' | 'camera' | 'todo' | null;
type Thought = { text: string; type: 'symbolic_log' | 'error' };

const App: React.FC = () => {
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
  const [initialSettingsTab, setInitialSettingsTab] = useState<SettingsTab>('geral');
  const [emotion, setEmotion] = useState<Emotion>('CALM');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isEvolving, setIsEvolving] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('paulo-creator-001'); // Multi-user support

  const { token, status: syncStatus, login, logout } = useGoogleSync(currentUserId);
  const { speak: speakFromHook, stop } = useSpeech(settings, status);
  const { generateResponse, generateVisionResponse } = useLlm(settings);

  const orchestratorRef = useRef<CognitiveOrchestrator | null>(null);
  const isChatVisibleRef = useRef(isChatVisible);
  const thoughtTimer = useRef<number | null>(null);

  const handleNewTurn = useCallback(async (turn: TranscriptionTurn) => {
    if (turn.user) {
        // Voice-based user messages are handled by the voice service, just update history.
        await addMessage({ role: 'user', text: turn.user, type: 'message' });
    }
    // Model's voice response text will be added to history via the orchestrator logic
  }, []);

  const handleFunctionCall = useCallback(async (call: SimpleFunctionCall) => {
    if (orchestratorRef.current) {
        return await orchestratorRef.current.executeFunctionCall(call);
    }
    return { result: { summary: 'Orquestrador não está pronto.' } };
  }, []);
  
  const { isSessionActive, startSession, endSession, currentUserTranscript, currentNexusTranscript } = useGeminiVoice(handleNewTurn, handleFunctionCall);

  useEffect(() => {
    setStatus(isSessionActive ? 'LISTENING' : 'IDLE');
  }, [isSessionActive]);


  // Switch user function for demonstration
  const switchUser = (userId: string) => {
      console.log(`Switching to user: ${userId}`);
      if (orchestratorRef.current) {
          orchestratorRef.current.dispose();
          orchestratorRef.current = null;
      }
      setMessages([]);
      setSettings(null);
      setCurrentUserId(userId);
      setIsInitializing(true); // Re-initialize for the new user
  };
  
  const speak = useCallback((text: string, onEnd?: () => void) => {
    speakFromHook(text, onEnd);
  }, [speakFromHook]);

  useEffect(() => {
    isChatVisibleRef.current = isChatVisible;
  }, [isChatVisible]);
  
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
  
  // App Initialization for the current user
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
      await cognitiveMonitor.initialize(currentUserId, loadedSettings);
      setSettings(loadedSettings);
      setIsInitializing(false);
    };
    initializeApp();
  }, [currentUserId]);
  
  // Nexus Core Initialization
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
        systemMonitor.start(currentUserId, () => token); // START MONITOR
        await orchestrator.awakenIfNeeded().catch(error => {
            console.error("Error during awakening sequence:", error);
        });
      };

      startNexus();

      return () => { 
          orchestrator.dispose(); 
          systemMonitor.stop(); // STOP MONITOR
        };
  }, [isInitializing, isStarted, settings, currentUserId, addMessage, speak, generateResponse, generateVisionResponse, token]);
  
  // Background reflection engine
  useEffect(() => {
    if (!isStarted || isInitializing || !settings || !settings.behavior.enableReflection) {
        return; // Do nothing if not started, initializing, or reflection is disabled
    }

    const reflectNow = () => {
        console.log('[App] Triggering background reflection...');
        reflectionEngine.reflect(currentUserId, generateResponse, settings);
    };
    
    const intervalMs = (settings.cognitive.reflectionFrequencyMinutes || 10) * 60 * 1000;
    const reflectionInterval = setInterval(reflectNow, intervalMs);

    return () => {
        clearInterval(reflectionInterval);
    };
  }, [isStarted, isInitializing, settings, currentUserId, generateResponse]);


  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || isSessionActive) return;
    setInputValue('');
    const userMessage: Omit<ChatMessage, 'userId' | 'timestamp'> = { role: 'user', text, type: 'message' };
    await addMessage(userMessage);
    setIsChatVisible(true);
    setHasNewMessage(false);
    const currentHistory = [...messages, { ...userMessage, userId: currentUserId, timestamp: Date.now() }];
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
      const currentHistory = [...messages, { ...userMessage, userId: currentUserId, timestamp: Date.now() }];
      await orchestratorRef.current?.handleUserTurn(prompt, currentHistory, imageData);
  };

  const onSettingsChange = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    await db.saveSettings(currentUserId, newSettings);
    cognitiveMonitor.updateSettings(newSettings);
  };
  
  const handleMessageAction = async (action: string, payload: any) => {
    if (orchestratorRef.current) {
        switch (action) {
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
    }
  };
  
  const openSettingsWithTab = (tab: SettingsTab) => {
    setInitialSettingsTab(tab);
    setActivePanel('settings');
  };

  return (
    <div className="h-screen w-screen bg-gray-900 text-white flex flex-col overflow-hidden relative">
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
                  initialTab={initialSettingsTab}
              />
          )}
          {activePanel === 'camera' && <CameraView onClose={() => setActivePanel(null)} onSend={handleVisionSubmit} />}
          {activePanel === 'todo' && <TodoList onClose={() => setActivePanel(null)} isVisible={activePanel === 'todo'} userId={currentUserId} />}
      </Suspense>

      <div className="flex-grow flex items-center justify-center relative">
        {!isStarted ? (
            <StartScreen onStart={() => setIsStarted(true)} onOpenSettings={() => openSettingsWithTab('geral')} token={token} syncStatus={syncStatus} onLogin={login}/>
        ) : (
            <>
              <AvatarLayer
                  isChatOpen={isChatVisible}
                  appearance={settings?.appearance ?? 'neutral'}
                  status={status}
                  intensity={settings?.cognitive?.emotionalIntensity ?? 1.0}
                  emotion={emotion}
                  thought={thought}
              />
              
              <AnimatePresence>
                {(currentUserTranscript || currentNexusTranscript) && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-x-0 bottom-1/2 translate-y-1/2 flex flex-col items-center justify-center p-4 pointer-events-none z-20"
                  >
                    <p className="text-xl md:text-2xl text-white/80 font-medium text-center drop-shadow-lg">{currentUserTranscript}</p>
                    <p className="text-2xl md:text-4xl text-cyan-300 font-bold text-center drop-shadow-lg mt-2">{currentNexusTranscript}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                  {isChatVisible && (
                      <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 20 }}
                          className="absolute inset-0 flex flex-col p-4 bg-gray-900/50 backdrop-blur-sm z-10"
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
                                  className="flex-grow bg-gray-800 rounded-full px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                              />
                              <button type="submit" className="w-10 h-10 rounded-full flex-shrink-0 bg-cyan-600 hover:bg-cyan-500 flex items-center justify-center">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                              </button>
                          </form>
                      </motion.div>
                  )}
              </AnimatePresence>
            </>
        )}
      </div>

      {isStarted && (
        <footer className="flex-shrink-0 p-3 bg-gray-800/50 border-t border-gray-700/50 flex items-center justify-around z-20">
            <div className="flex items-center gap-3">
                 <button onClick={() => openSettingsWithTab('geral')} className="relative group p-2 text-gray-400 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0 3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg><span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-xs text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Configurações</span></button>
                 <button onClick={() => setActivePanel('camera')} className="relative group p-2 text-gray-400 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg><span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-xs text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Câmera</span></button>
                 <button onClick={() => setActivePanel('todo')} className="relative group p-2 text-gray-400 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg><span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-xs text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Tarefas</span></button>
            </div>
            <button
                onMouseDown={startSession}
                onMouseUp={endSession}
                onTouchStart={startSession}
                onTouchEnd={endSession}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${isSessionActive ? 'bg-red-500 scale-110' : 'bg-cyan-600 hover:bg-cyan-500'}`}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            </button>
            <div className="flex items-center gap-3">
                <button onClick={() => openSettingsWithTab('monitor')} className="relative group p-2 text-gray-400 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a4 4 0 00-4-4H3V9h2a4 4 0 004-4V3l4 4-4 4zm6 0v-2a4 4 0 014-4h2V9h-2a4 4 0 01-4-4V3l-4 4 4 4z" /></svg><span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-xs text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Monitor Cognitivo</span></button>
                <button onClick={() => openSettingsWithTab('arquitetura')} className="relative group p-2 text-gray-400 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h7.5M8.25 12h7.5m-7.5 5.25h7.5m-11.25-2.25L4.5 13.5m0 0l-1.5-1.5M4.5 13.5V15m15-1.5L19.5 13.5m0 0l-1.5-1.5m1.5 1.5V15M3 12a9 9 0 1118 0 9 9 0 01-18 0z" /></svg><span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-xs text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Arquitetura</span></button>
                <button
                    onClick={() => { setIsChatVisible(!isChatVisible); setHasNewMessage(false); }}
                    className="relative group p-2 text-gray-400 hover:text-white"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    {hasNewMessage && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-cyan-500 rounded-full border-2 border-gray-800"></span>}
                     <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-xs text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Chat</span>
                </button>
            </div>
        </footer>
      )}
    </div>
  );
};

export default App;
