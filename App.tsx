
import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
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
// FIX: Add 'Thought' type to handle cognitive thought updates for the UI.
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
  // FIX: Update 'thought' state to be an object to match the component prop type.
  const [thought, setThought] = useState<Thought | null>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [emotion, setEmotion] = useState<Emotion>('CALM');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isEvolving, setIsEvolving] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('paulo-creator-001'); // Multi-user support

  const { token, status: syncStatus, login, logout } = useGoogleSync(currentUserId);
  const { speak: speakFromHook, stop } = useSpeech(settings, status);
  const { generateResponse, generateVisionResponse } = useLlm(settings);


  const orchestratorRef = useRef<CognitiveOrchestrator | null>(null);
  const isChatVisibleRef = useRef(isChatVisible);
  // FIX: Add a timer ref for managing the visibility of the 'thought' bubble.
  const thoughtTimer = useRef<number | null>(null);

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
  // Example usage (can be hooked to a UI button):
  // <button onClick={() => switchUser('standard-user-002')}>Switch to Standard User</button>
  
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

  // FIX: Add an effect to listen for and display cognitive thoughts from the Nexus core.
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
      // Ensure a user profile exists
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
        await orchestrator.awakenIfNeeded().catch(error => {
            console.error("Error during awakening sequence:", error);
        });
      };

      startNexus();

      return () => { orchestrator.dispose(); };
  }, [isInitializing, isStarted, settings, currentUserId, addMessage, speak, generateResponse, generateVisionResponse]); // Re-run when user changes

  // ... (rest of the component is largely the same, but actions now implicitly use `currentUserId`)

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text) return;
    setInputValue('');
    const userMessage: Omit<ChatMessage, 'userId' | 'timestamp'> = { role: 'user', text, type: 'message' };
    await addMessage(userMessage);
    setIsChatVisible(true);
    setHasNewMessage(false);
    const currentHistory = [...messages, { ...userMessage, userId: currentUserId, timestamp: Date.now() }];
    await orchestratorRef.current?.handleUserTurn(text, currentHistory);
  };
  
  const handleVisionSubmit = async (imageData: string, prompt: string) => {
      setActivePanel(null); // Close camera panel
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
              />
          )}
          {activePanel === 'camera' && <CameraView onClose={() => setActivePanel(null)} onSend={handleVisionSubmit} />}
          {activePanel === 'todo' && <TodoList onClose={() => setActivePanel(null)} isVisible={activePanel === 'todo'} userId={currentUserId} />}
          {activePanel === 'reflectionHistory' && <ReflectionHistory onClose={() => setActivePanel(null)} isVisible={activePanel === 'reflectionHistory'} settings={settings} userId={currentUserId} />}
          {activePanel === 'cognitiveStatus' && <CognitiveStatus onClose={() => setActivePanel(null)} isVisible={activePanel === 'cognitiveStatus'} userId={currentUserId} />}
      </Suspense>

      <div className="flex-grow flex items-center justify-center relative">
        {!isStarted ? (
            <StartScreen onStart={() => setIsStarted(true)} onOpenSettings={() => setActivePanel('settings')} token={token} syncStatus={syncStatus} onLogin={login}/>
        ) : (
            <>
              <AvatarLayer
                  isChatOpen={isChatVisible}
                  appearance={settings?.appearance ?? 'neutral'}
                  status={status}
                  intensity={settings?.cognitive?.emotionalIntensity ?? 1.0}
                  emotion={emotion}
                  // FIX: Pass the 'thought' state to the AvatarLayer component.
                  thought={thought}
              />

              <AnimatePresence>
                  {isChatVisible && (
                      <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 20 }}
                          className="absolute inset-0 flex flex-col p-4 bg-gray-900/50 backdrop-blur-sm"
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
        <footer className="flex-shrink-0 p-3 bg-gray-800/50 border-t border-gray-700/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <button onClick={() => setActivePanel('settings')} className="p-2 text-gray-400 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg></button>
                <button onClick={() => setActivePanel('camera')} className="p-2 text-gray-400 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg></button>
                <button onClick={() => setActivePanel('todo')} className="p-2 text-gray-400 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg></button>
                <button onClick={() => setActivePanel('reflectionHistory')} className="p-2 text-gray-400 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a4 4 0 00-4-4H3V9h2a4 4 0 004-4V3l4 4-4 4zm6 0v-2a4 4 0 014-4h2V9h-2a4 4 0 01-4-4V3l-4 4 4 4z" /></svg></button>
                <button onClick={() => setActivePanel('cognitiveStatus')} className="p-2 text-gray-400 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h7.5M8.25 12h7.5m-7.5 5.25h7.5m-11.25-2.25L4.5 13.5m0 0l-1.5-1.5M4.5 13.5V15m15-1.5L19.5 13.5m0 0l-1.5-1.5m1.5 1.5V15M3 12a9 9 0 1118 0 9 9 0 01-18 0z" /></svg></button>
            </div>
            <button
                onClick={() => { setIsChatVisible(!isChatVisible); setHasNewMessage(false); }}
                className="p-2 text-gray-400 hover:text-white relative"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                {hasNewMessage && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-cyan-500 rounded-full border-2 border-gray-800"></span>}
            </button>
        </footer>
      )}
    </div>
  );
};


export default App;
