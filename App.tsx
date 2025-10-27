
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AssistantStatus, ChatMessage, AppSettings, Emotion } from './types';
import { useGeminiVoice, TranscriptionTurn } from './hooks/useGeminiVoice';
import { useLlm } from './hooks/useLlm';
import { db } from './services/indexedDBService';
import { AvatarLayer } from './components/AvatarLayer';
import { Message } from './components/Message';
import { SettingsPanel } from './components/SettingsPanel';
import { createNexusBrain, NexusBrain } from './services/nexusBrain';
import { CameraView } from './components/CameraView';
import { StartScreen } from './components/StartScreen';
import { useGoogleSync } from './hooks/useGoogleSync';
import { useSpeech } from './hooks/useSpeech';
import { TodoList } from './components/TodoList';
import { InternalMap } from './components/InternalMap';


const App: React.FC = () => {
  const [status, setStatus] = useState<AssistantStatus>(AssistantStatus.IDLE);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isStarted, setIsStarted] = useState(false);
  const [thought, setThought] = useState<string | null>(null);
  const [isTodoListVisible, setIsTodoListVisible] = useState(false);
  const [isInternalMapVisible, setIsInternalMapVisible] = useState(false);

  const { token, status: syncStatus, login, logout } = useGoogleSync();
  const { speak: unstableSpeak, stop } = useSpeech(settings, status);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const brainRef = useRef<NexusBrain | null>(null);
  const isChatVisibleRef = useRef(isChatVisible);

  // Create a ref to hold the latest version of the speak function
  const speakRef = useRef(unstableSpeak);
  useEffect(() => {
    speakRef.current = unstableSpeak;
  }, [unstableSpeak]);

  // Create a stable version of the speak function that we can pass to dependencies
  const speak = useCallback((text: string, onEnd?: () => void) => {
    speakRef.current(text, onEnd);
  }, []);

  useEffect(() => {
    isChatVisibleRef.current = isChatVisible;
  }, [isChatVisible]);
  
  useEffect(() => {
    const handleThoughtUpdate = (event: CustomEvent) => {
        const { text } = event.detail;
        setThought(text);
        const timer = setTimeout(() => {
            setThought(null);
        }, 6000); // Hide after 6 seconds
        return () => clearTimeout(timer);
    };

    window.addEventListener('nexus-thought-update', handleThoughtUpdate as EventListener);

    return () => {
        window.removeEventListener('nexus-thought-update', handleThoughtUpdate as EventListener);
    };
  }, []);

  // Listen for emotion changes from the brain
  useEffect(() => {
    const handleEmotionUpdate = (event: CustomEvent) => {
        const { emotion } = event.detail as { emotion: Emotion };
        
        // Only change status if assistant is in a passive state
        if ([AssistantStatus.IDLE, AssistantStatus.SLEEPY, AssistantStatus.SUCCESS, AssistantStatus.ERROR, AssistantStatus.CURIOUS].includes(status)) {
            const emotionToStatusMap: Partial<Record<Emotion, AssistantStatus>> = {
                [Emotion.JOYFUL]: AssistantStatus.SUCCESS,
                [Emotion.UNCERTAIN]: AssistantStatus.CURIOUS,
                [Emotion.AFRAID]: AssistantStatus.ERROR,
                [Emotion.FOCUSED]: AssistantStatus.IDLE, // Focused is an internal state, visually idle is fine
                [Emotion.CURIOUS]: AssistantStatus.CURIOUS,
                [Emotion.CALM]: AssistantStatus.IDLE,
            };
            const newStatus = emotionToStatusMap[emotion];
            if (newStatus && newStatus !== status) {
                setStatus(newStatus);
            }
        }
    };

    window.addEventListener('nexus-emotion-update', handleEmotionUpdate as EventListener);

    return () => {
        window.removeEventListener('nexus-emotion-update', handleEmotionUpdate as EventListener);
    };
  }, [status]);


  // Auto-start app after successful sync
  useEffect(() => {
      if (token && (syncStatus.includes('sucesso') || syncStatus.includes('salvo'))) {
          const timer = setTimeout(() => setIsStarted(true), 2000); // Give user time to read status
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
      if (turn.user) {
          await addMessage({ role: 'user', text: turn.user, type: 'message' });
      }
      if (turn.model) {
          await addMessage({ role: 'model', text: turn.model, type: 'message' });
          // Note: audio is played by the voice service itself
      }
  }, [addMessage]);

  const { 
    isSessionActive, 
    isNexusSpeaking,
    currentUserTranscript,
    currentNexusTranscript,
    startSession,
    endSession 
  } = useGeminiVoice(handleNewTurn);
  
  const { generateResponse, generateVisionResponse } = useLlm(settings);
  
  // App Initialization
  useEffect(() => {
    const initializeApp = async () => {
      const history = await db.getChatHistory();
      setMessages(history);
      const loadedSettings = await db.getSettings();
      setSettings(loadedSettings);
      setIsInitializing(false);
    };
    initializeApp();
  }, [syncStatus]);
  
  // Brain Initialization
  useEffect(() => {
      if (isInitializing || !settings || !isStarted) return;

      const brain = createNexusBrain({
        speak, // Use speak from the useSpeech hook
        addMessage,
        setStatus,
        generateResponse,
        generateVisionResponse,
        getSettings: db.getSettings,
        getUserProfile: db.getUserProfile,
        setUserProfile: db.saveUserProfile,
      });
      brainRef.current = brain;
      
      brain.touchHeartbeat();
      brain.ensureDailyReflection();
      
      if (messages.length === 0) {
          brain.handleUserTurn("", []);
      }

      return () => {
        stop(); // Stop any speaking on cleanup
        brain.dispose();
      };
  }, [isInitializing, isStarted, settings, addMessage, generateResponse, generateVisionResponse, messages.length, speak, stop]);


  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isChatVisible, currentUserTranscript, currentNexusTranscript]);

  useEffect(() => {
    const thinking = status === AssistantStatus.THINKING;
    if (isSessionActive) {
        if (isNexusSpeaking) {
            setStatus(AssistantStatus.SPEAKING);
        } else {
            setStatus(AssistantStatus.LISTENING);
        }
    } else if (!thinking) {
        // This logic is complex because emotion can also set status.
        // Let's prevent this effect from overriding a recent emotional status update.
        if (status !== AssistantStatus.SUCCESS && status !== AssistantStatus.ERROR && status !== AssistantStatus.CURIOUS) {
            setStatus(AssistantStatus.IDLE);
        }
    }
  }, [isSessionActive, isNexusSpeaking, status]);

  const handleMicClick = () => {
    brainRef.current?.touchHeartbeat();
    if (status === AssistantStatus.SLEEPY) setStatus(AssistantStatus.IDLE);
    
    if (isSessionActive) {
        endSession();
    } else {
        setIsChatVisible(true);
        setHasNewMessage(false);
        startSession();
    }
  };
  
  const handleTextSubmit = async (e: React.FormEvent) => {
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
    
    await brainRef.current?.handleUserTurn(text, currentHistory);
  };
  
  const handleVisionSubmit = async (imageData: string, prompt: string) => {
      if(isSessionActive) endSession();
      setIsCameraOpen(false);
      const userMessage: ChatMessage = {
          role: 'user',
          text: prompt || 'O que você vê aqui?',
          type: 'message',
          imageUrl: imageData,
      };
      await addMessage(userMessage);

      setIsChatVisible(true);
      setHasNewMessage(false);
      const currentHistory = [...messages, userMessage];
      await brainRef.current?.handleUserTurn(prompt, currentHistory, imageData);
  };

  const onSettingsChange = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    await db.saveSettings(newSettings);
  };

  const handleMessageAction = async (action: string, payload: any) => {
    if (action === 'merge_concepts' && payload) {
        await brainRef.current?.performConceptMerge(payload);
        setMessages(prev => prev.filter(m => m.type !== 'concept_consolidation_prompt'));
    }
    if (action === 'ignore_consolidation') {
        setMessages(prev => prev.filter(m => m.type !== 'concept_consolidation_prompt'));
    }
  };
  
  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

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
        if (imageData) {
            await handleVisionSubmit(imageData, 'O que você vê nesta imagem?');
        }
    };
    reader.readAsDataURL(file);
    
    if (e.target) {
        e.target.value = '';
    }
  };


  if (isInitializing || !settings) {
    return <div className="h-screen w-screen bg-gray-900 flex items-center justify-center"><p>Despertando Nexus...</p></div>
  }

  return (
    <div className="h-screen w-screen bg-gray-900 text-white flex flex-col overflow-hidden relative">
      <style>{`
        @keyframes fade-in-out {
          0%, 100% { opacity: 0; transform: translateY(10px) scale(0.95); }
          10%, 90% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fade-in-out {
          animation: fade-in-out 6s ease-in-out forwards;
        }
        .animate-fade-in-slide-up {
          animation: fade-in-slide-up 0.3s ease-out forwards;
        }
        @keyframes fade-in-slide-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {!isStarted ? (
          <StartScreen 
              onStart={() => setIsStarted(true)} 
              onOpenSettings={() => setIsSettingsVisible(true)}
              token={token}
              syncStatus={syncStatus}
              onLogin={login}
          />
      ) : (
        <>
          <button 
            onClick={() => setIsSettingsVisible(true)}
            aria-label="Abrir configurações"
            className="absolute top-4 right-4 z-30 p-2 bg-gray-700/50 rounded-full text-gray-300 hover:bg-gray-600/80 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066 2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>

          <AvatarLayer 
            isChatOpen={isChatVisible} 
            appearance={settings?.appearance ?? 'neutral'}
            status={status}
          />
          
          {thought && !isChatVisible && (
            <div className="absolute top-1/2 -translate-y-[12rem] left-1/2 -translate-x-1/2 z-30 p-3 bg-gray-700/90 backdrop-blur-sm rounded-lg shadow-lg animate-fade-in-out max-w-xs text-center border border-gray-600">
                <p className="text-sm text-gray-300 italic">💭 {thought}</p>
            </div>
          )}

          {!isChatVisible && (
            <div className="absolute bottom-6 left-6 z-30 flex flex-col gap-3">
               <button
                  onClick={() => setIsInternalMapVisible(true)}
                  aria-label="Abrir mapa interno"
                  className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center shadow-lg hover:bg-gray-600 transition-all transform hover:scale-110"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
              </button>
              <button
                onClick={() => setIsTodoListVisible(true)}
                aria-label="Abrir lista de tarefas"
                className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center shadow-lg hover:bg-gray-600 transition-all transform hover:scale-110"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                   <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </button>
            </div>
          )}
          
          {!isChatVisible && (
            <button
              onClick={() => { setIsChatVisible(true); setHasNewMessage(false); }}
              aria-label="Abrir chat"
              className="absolute bottom-6 right-6 z-30 w-16 h-16 bg-cyan-600 rounded-full flex items-center justify-center shadow-lg hover:bg-cyan-500 transition-all transform hover:scale-110"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              {hasNewMessage && (
                <span className="absolute top-0 right-0 block h-4 w-4 rounded-full bg-red-500 border-2 border-white animate-pulse"></span>
              )}
            </button>
          )}

          <div className={`absolute bottom-0 left-0 right-0 h-[70vh] max-h-[600px] bg-gray-800/80 backdrop-blur-md rounded-t-2xl flex flex-col z-20 transition-transform duration-500 ease-in-out ${isChatVisible ? 'translate-y-0' : 'translate-y-full'}`}>
            <header className="flex-shrink-0 p-2 border-b border-gray-700/50 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-300 pl-2">Nexus</h3>
                <button
                    type="button"
                    onClick={() => setIsChatVisible(false)}
                    aria-label="Recolher chat"
                    className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-gray-700 hover:bg-gray-600 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
            </header>
            
            <div ref={chatContainerRef} className="flex-grow p-4 overflow-y-auto">
              <div className="flex flex-col space-y-4">
                {messages.map((msg, index) => (
                  <Message key={msg.id || index} {...msg} onAction={handleMessageAction} />
                ))}
                {currentUserTranscript && (
                    <div className="flex items-end justify-end animate-fade-in-slide-up">
                        <div className="max-w-xs md:max-w-md lg:max-w-lg px-4 py-3 rounded-2xl shadow-md bg-cyan-600/70 rounded-br-none opacity-70">
                            <p className="text-white whitespace-pre-wrap italic">{currentUserTranscript}...</p>
                        </div>
                    </div>
                )}
                 {currentNexusTranscript && (
                    <div className="flex items-end justify-start animate-fade-in-slide-up">
                        <div className="max-w-xs md:max-w-md lg:max-w-lg px-4 py-3 rounded-2xl shadow-md bg-gray-700/70 rounded-bl-none opacity-70">
                            <p className="text-white whitespace-pre-wrap italic">{currentNexusTranscript}...</p>
                        </div>
                    </div>
                )}
              </div>
            </div>
            
            <footer className="flex-shrink-0 p-2 border-t border-gray-700/50">
                <form onSubmit={handleTextSubmit} className="flex items-center gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept="image/*"
                    />
                    
                    <button
                        type="button"
                        onClick={handleAttachClick}
                        aria-label="Anexar imagem"
                        className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-gray-600 hover:bg-gray-500 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                           <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsCameraOpen(true)}
                        aria-label="Abrir câmera"
                        className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-gray-600 hover:bg-gray-500 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>
                    </button>

                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Digite uma mensagem..."
                        className="flex-grow bg-gray-700 rounded-full px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />

                    {inputValue.trim() ? (
                        <button
                            type="submit"
                            aria-label="Enviar mensagem"
                            className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-cyan-600 hover:bg-cyan-500 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform rotate-90" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.428A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleMicClick}
                            aria-label={isSessionActive ? 'Encerrar conversa' : 'Iniciar conversa por voz'}
                            className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center transition-colors ${isSessionActive ? 'bg-red-600 animate-pulse ring-4 ring-red-500/50' : 'bg-cyan-600 hover:bg-cyan-500'}`}
                        >
                        {isSessionActive ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5 5a1 1 0 011-1h8a1 1 0 011 1v8a1 1 0 01-1 1H6a1 1 0 01-1-1V5z" clipRule="evenodd" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm5 3a1 1 0 11-2 0V4a1 1 0 112 0v3zM4 9a1 1 0 011-1h.01a1 1 0 110 2H5a1 1 0 01-1-1zM15 8a1 1 0 100 2h.01a1 1 0 100-2H15zM4 12a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm11-1a1 1 0 100 2h1a1 1 0 100-2h-1zM7 12a1 1 0 011-1h2a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
                            )}
                        </button>
                    )}
                </form>
            </footer>
          </div>
        </>
      )}
      
      {isSettingsVisible && <SettingsPanel settings={settings} onSettingsChange={onSettingsChange} onClose={() => setIsSettingsVisible(false)} token={token} onLogout={logout} />}
      {isStarted && isCameraOpen && <CameraView onClose={() => setIsCameraOpen(false)} onSend={handleVisionSubmit} />}
      {isStarted && <TodoList isVisible={isTodoListVisible} onClose={() => setIsTodoListVisible(false)} />}
      {isStarted && <InternalMap isVisible={isInternalMapVisible} onClose={() => setIsInternalMapVisible(false)} />}
    </div>
  );
};

export default App;
