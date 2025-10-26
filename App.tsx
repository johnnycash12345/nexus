import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AssistantStatus, ChatMessage, AppSettings, UserProfile } from './types';
import { useSpeech } from './hooks/useSpeech';
import { useLlmOffline } from './hooks/useLlmOffline';
import { db } from './services/indexedDBService';
import { Avatar } from './components/Avatar';
import { Message } from './components/Message';
import { SettingsPanel } from './components/SettingsPanel';
import { initGoogleClient } from './services/syncService';
import { createNexusBrain, NexusBrain } from './services/nexusBrain';


const App: React.FC = () => {
  const [status, setStatus] = useState<AssistantStatus>(AssistantStatus.IDLE);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

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
     if (!isChatVisibleRef.current && message.role === 'model') {
       setHasUnreadMessages(true);
     }
  }, []);

  const { isListening, startListening, stopListening, speak } = useSpeech(
    (text: string) => brainRef.current?.handleUserTurn(text, messages),
    settings?.voice
  );
  
  const { generateResponse } = useLlmOffline();
  
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
      if (isInitializing || !settings) return;

      const brain = createNexusBrain({
        speak,
        addMessage,
        setStatus,
        generateResponse,
        getSettings: db.getSettings,
        getUserProfile: db.getUserProfile,
        setUserProfile: db.saveUserProfile,
        behavior: settings.behavior,
        webEnabled: true,
      });
      brainRef.current = brain;
      
      // Initial heartbeat
      brain.touchHeartbeat();
      
      // Check for daily reflection on startup
      brain.ensureDailyReflection();
      
      // Trigger birth sequence on first interaction if needed
      if (messages.length === 0) {
          brain.handleUserTurn("", []);
      }

      return () => {
        brain.dispose();
      };
  }, [isInitializing, settings, speak, addMessage, generateResponse, messages.length]);


  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

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
    if (!isChatVisible) setIsChatVisible(true);
    if (isListening) {
        stopListening();
    } else {
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
    
    const currentHistory = [...messages, userMessage];
    
    await brainRef.current?.handleUserTurn(text, currentHistory);
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
      <button 
        onClick={() => setIsSettingsVisible(true)}
        aria-label="Abrir configurações"
        className="absolute top-4 right-4 z-30 p-2 bg-gray-700/50 rounded-full text-gray-300 hover:bg-gray-600/80 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
      </button>

      <main className={`flex-grow flex items-center justify-center transition-all duration-500 ease-in-out h-full`}>
        <div className="w-64 h-64">
          <Avatar status={status} />
        </div>
      </main>
      
      {!isChatVisible && (
        <div className="absolute bottom-0 left-0 right-0 p-4 flex flex-col items-center">
          <button 
            onClick={() => { setIsChatVisible(true); setHasUnreadMessages(false); }}
            className="flex items-center gap-2 mb-4 px-4 py-2 bg-gray-700/90 backdrop-blur-sm rounded-full text-sm text-cyan-300 shadow-lg border border-gray-600/50 relative"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clipRule="evenodd" /></svg>
            Mostrar Chat
            {hasUnreadMessages && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-gray-800 animate-pulse"></span>}
          </button>
          
          <div className="relative">
            <button
              onClick={handleMicClick}
              aria-label={isListening ? 'Parar de ouvir' : 'Começar a ouvir'}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 transform scale-100 hover:scale-110 focus:outline-none focus:ring-4 focus:ring-opacity-50 ${
                isListening ? 'bg-red-500 shadow-lg shadow-red-500/50 focus:ring-red-400' : 'bg-cyan-500 shadow-lg shadow-cyan-500/50 focus:ring-cyan-400'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" viewBox="0 0 20 20" fill="currentColor"><path d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm-1 5a4 4 0 004 4v2.586l.293.293a1 1 0 001.414-1.414L11 14.586V13a4 4 0 00-5-3.938V10zM13 9a1 1 0 10-2 0v1a1 1 0 102 0V9z" /><path d="M10 18a8 8 0 006.32-3.086A1 1 0 0015.337 14H4.663a1 1 0 00-.983.914A8 8 0 0010 18z" /></svg>
            </button>
            {isListening && <div className="absolute inset-0 rounded-full bg-red-500/50 animate-ping -z-10"></div>}
          </div>
          <p className="mt-4 text-gray-400 text-sm">{isListening ? 'Ouvindo...' : 'Pressione o microfone para falar'}</p>
        </div>
      )}

      <div 
        className={`absolute bottom-0 left-0 right-0 w-full max-w-4xl mx-auto h-[67%] bg-gray-800/90 backdrop-blur-md rounded-t-2xl flex flex-col z-20 transition-transform duration-500 ease-in-out transform ${
          isChatVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex-shrink-0 w-full text-center py-2 border-b border-gray-700/50 cursor-pointer" onClick={() => setIsChatVisible(false)}>
          <div className="w-10 h-1.5 bg-gray-600 rounded-full mx-auto"></div>
        </div>
        
        <div ref={chatContainerRef} className="flex-grow p-4 overflow-y-auto">
          <div className="flex flex-col space-y-4">
            {messages.map((msg, index) => (
              <Message key={msg.id || index} role={msg.role} text={msg.text} type={msg.type} />
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
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-cyan-600 hover:bg-cyan-500 transition-colors disabled:bg-gray-600"
                    disabled={!inputValue.trim()}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform rotate-90" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.428A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                </button>
                <button
                    type="button"
                    onClick={handleMicClick}
                    aria-label={isListening ? 'Parar de ouvir' : 'Começar a ouvir'}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isListening ? 'bg-red-500' : 'bg-cyan-600 hover:bg-cyan-500'}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm5 3a1 1 0 11-2 0V4a1 1 0 112 0v3zM4 9a1 1 0 011-1h.01a1 1 0 110 2H5a1 1 0 01-1-1zM15 8a1 1 0 100 2h.01a1 1 0 100-2H15zM4 12a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm11-1a1 1 0 100 2h1a1 1 0 100-2h-1zM7 12a1 1 0 011-1h2a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
                </button>
            </form>
        </footer>
      </div>
      
      {isSettingsVisible && <SettingsPanel settings={settings} onSettingsChange={onSettingsChange} onClose={() => setIsSettingsVisible(false)} />}
    </div>
  );
};

export default App;