import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AssistantStatus, ChatMessage, AppSettings } from './types';
import { useSpeech } from './hooks/useSpeech';
import { useLlmOffline } from './hooks/useLlmOffline';
import { db } from './services/indexedDBService';
import { Avatar } from './components/Avatar';
import { Message } from './components/Message';
import { SettingsPanel } from './components/SettingsPanel';
import { initGoogleClient } from './services/syncService';
import { createNexusBrain, NexusBrain } from './services/nexusBrain';
import { CameraView } from './components/CameraView';
import { StartScreen } from './components/StartScreen';


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

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const brainRef = useRef<NexusBrain | null>(null);
  const isChatVisibleRef = useRef(isChatVisible);

  useEffect(() => {
    isChatVisibleRef.current = isChatVisible;
  }, [isChatVisible]);

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

  const { isListening, startListening, stopListening, speak } = useSpeech(
    (text: string) => brainRef.current?.handleUserTurn(text, messages),
    settings?.voice
  );
  
  const { generateResponse, generateVisionResponse } = useLlmOffline(settings?.apiKeys?.deepseekApiKey);
  
  // App Initialization
  useEffect(() => {
    const initializeApp = async () => {
      const history = await db.getChatHistory();
      setMessages(history);
      const loadedSettings = await db.getSettings();
      setSettings(loadedSettings);
      initGoogleClient();
      setIsInitializing(false);
    };
    initializeApp();
  }, []);
  
  // Brain Initialization
  useEffect(() => {
      if (isInitializing || !settings || !isStarted) return;

      const brain = createNexusBrain({
        speak,
        addMessage,
        setStatus,
        generateResponse,
        generateVisionResponse,
        getSettings: db.getSettings,
        getUserProfile: db.getUserProfile,
        setUserProfile: db.saveUserProfile,
        behavior: settings.behavior,
        webEnabled: true,
      });
      brainRef.current = brain;
      
      brain.touchHeartbeat();
      brain.ensureDailyReflection();
      
      if (messages.length === 0) {
          brain.handleUserTurn("", []);
      }

      return () => {
        brain.dispose();
      };
  }, [isInitializing, isStarted, settings, speak, addMessage, generateResponse, generateVisionResponse, messages.length]);


  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isChatVisible]);

  useEffect(() => {
    if (status !== AssistantStatus.IDLE && status !== AssistantStatus.SLEEPY) {
      brainRef.current?.touchHeartbeat();
    }
    if(llmStatus !== 'working') {
       setStatus(isListening ? AssistantStatus.LISTENING : status === AssistantStatus.SLEEPY ? AssistantStatus.SLEEPY : AssistantStatus.IDLE);
    }
  }, [isListening, status]);
  
  const llmStatus = status === AssistantStatus.THINKING ? 'working' : 'idle';


  const handleMicClick = () => {
    brainRef.current?.touchHeartbeat();
    if (status === AssistantStatus.SLEEPY) setStatus(AssistantStatus.IDLE);
    if (isListening) {
        stopListening();
    } else {
        setIsChatVisible(true);
        setHasNewMessage(false);
        startListening();
    }
  };
  
  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text) return;
    
    stopListening();
    setInputValue('');
    
    const userMessage: ChatMessage = { role: 'user', text, type: 'message' };
    await addMessage(userMessage);
    
    setIsChatVisible(true);
    setHasNewMessage(false);
    const currentHistory = [...messages, userMessage];
    
    await brainRef.current?.handleUserTurn(text, currentHistory);
  };
  
  const handleVisionSubmit = async (imageData: string, prompt: string) => {
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

  if (isInitializing || !settings) {
    return <div className="h-screen w-screen bg-gray-900 flex items-center justify-center"><p>Despertando Nexus...</p></div>
  }

  return (
    <div className="h-screen w-screen bg-gray-900 flex flex-col overflow-hidden relative">
      {!isStarted ? (
          <StartScreen onStart={() => setIsStarted(true)} onOpenSettings={() => setIsSettingsVisible(true)} />
      ) : (
        <>
          <button 
            onClick={() => setIsSettingsVisible(true)}
            aria-label="Abrir configurações"
            className="absolute top-4 right-4 z-30 p-2 bg-gray-700/50 rounded-full text-gray-300 hover:bg-gray-600/80 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>

          <main className="flex-grow flex items-center justify-center transition-all duration-500 ease-in-out">
            <div className={`transition-transform duration-500 ease-in-out ${isChatVisible ? 'scale-100' : 'scale-125'}`}>
              <Avatar status={status} />
            </div>
          </main>
          
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

          <div className={`absolute bottom-0 left-0 right-0 h-[60vh] bg-gray-800/90 backdrop-blur-md rounded-t-2xl flex flex-col z-20 transition-transform duration-500 ease-in-out ${isChatVisible ? 'translate-y-0' : 'translate-y-full'}`}>
            <div ref={chatContainerRef} className="flex-grow p-4 overflow-y-auto">
              <div className="flex flex-col space-y-4">
                {messages.map((msg, index) => (
                  <Message key={msg.id || index} role={msg.role} text={msg.text} type={msg.type} imageUrl={msg.imageUrl} />
                ))}
              </div>
            </div>
            
            <footer className="flex-shrink-0 p-2 border-t border-gray-700/50">
                <form onSubmit={handleTextSubmit} className="flex items-center gap-2">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Digite uma mensagem..."
                        className="flex-grow bg-gray-700 rounded-full px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <button
                        type="submit"
                        aria-label="Enviar mensagem"
                        className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-cyan-600 hover:bg-cyan-500 transition-colors disabled:bg-gray-600"
                        disabled={!inputValue.trim()}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform rotate-90" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.428A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                    </button>
                    <button
                        type="button"
                        onClick={handleMicClick}
                        aria-label={isListening ? 'Parar de ouvir' : 'Começar a ouvir'}
                        className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center transition-colors ${isListening ? 'bg-red-500' : 'bg-cyan-600 hover:bg-cyan-500'}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm5 3a1 1 0 11-2 0V4a1 1 0 112 0v3zM4 9a1 1 0 011-1h.01a1 1 0 110 2H5a1 1 0 01-1-1zM15 8a1 1 0 100 2h.01a1 1 0 100-2H15zM4 12a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm11-1a1 1 0 100 2h1a1 1 0 100-2h-1zM7 12a1 1 0 011-1h2a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
                    </button>
                    <button
                        type="button"
                        onClick={() => { setIsChatVisible(true); setHasNewMessage(false); setIsCameraOpen(true); }}
                        aria-label="Abrir câmera"
                        className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-gray-600 hover:bg-gray-500 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>
                    </button>
                     <button
                        type="button"
                        onClick={() => setIsChatVisible(false)}
                        aria-label="Recolher chat"
                        className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-gray-600 hover:bg-gray-500 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </form>
            </footer>
          </div>
        </>
      )}
      
      {isSettingsVisible && <SettingsPanel settings={settings} onSettingsChange={onSettingsChange} onClose={() => setIsSettingsVisible(false)} />}
      {isStarted && isCameraOpen && <CameraView onClose={() => setIsCameraOpen(false)} onSend={handleVisionSubmit} />}
    </div>
  );
};

export default App;