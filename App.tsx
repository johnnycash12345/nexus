import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AssistantStatus, ChatMessage, AppSettings, UserProfile } from './types';
import { useSpeech } from './hooks/useSpeech';
import { getGeminiResponse, generateCuriosityQuestion, generateDiaryEntry } from './services/geminiService';
import { learnConcept, strengthenConcept, saveDiaryEntry, getDiary, getSettings, saveSettings, getUserProfile, saveUserProfile } from './services/memoryService';
import { visionService } from './services/visionService';
import { Avatar } from './components/Avatar';
import { Message } from './components/Message';
import { SettingsPanel } from './components/SettingsPanel';

const App: React.FC = () => {
  const [status, setStatus] = useState<AssistantStatus>(AssistantStatus.IDLE);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [expectingAnswerTo, setExpectingAnswerTo] = useState<string | null>(null);
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const [userProfile, setUserProfile] = useState<UserProfile | null>(getUserProfile());
  const [isAwaitingName, setIsAwaitingName] = useState(!getUserProfile()?.name);
  const [detectedObjects, setDetectedObjects] = useState<string[]>([]);
  const [isVisionActive, setIsVisionActive] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isChatVisibleRef = useRef(isChatVisible);

  useEffect(() => {
    isChatVisibleRef.current = isChatVisible;
  }, [isChatVisible]);

  const { isListening, startListening, stopListening, speak } = useSpeech(
    (text: string) => handleUserInput(text),
    settings.voice
  );
  
  // Onboarding flow
  useEffect(() => {
    if (isAwaitingName) {
      const welcomeMessage: ChatMessage = { role: 'model', text: 'Olá! Eu sou o Nexus. Para começarmos, como posso te chamar?', type: 'message' };
      setMessages([welcomeMessage]);
      setTimeout(() => speak(welcomeMessage.text), 500);
    } else if (messages.length === 0) {
      setMessages([{ role: 'model', text: `Olá, ${userProfile?.name}! O que vamos descobrir hoje?`, type: 'message' }]);
    }
  }, [isAwaitingName]);


  // Vision Mode Effect
  useEffect(() => {
    const startVision = async () => {
      if (settings.behavior.enableVision && videoRef.current) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
          await visionService.init();
          visionService.start(videoRef.current, (labels) => {
            setDetectedObjects(labels);
          });
          setIsVisionActive(true);
        } catch (err) {
          console.error("Error accessing camera for Vision Mode:", err);
          // Revert setting if permission is denied
          onSettingsChange({ ...settings, behavior: { ...settings.behavior, enableVision: false } });
        }
      }
    };

    const stopVision = () => {
      visionService.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setIsVisionActive(false);
      setDetectedObjects([]);
    };

    if (settings.behavior.enableVision) {
      startVision();
    } else {
      stopVision();
    }

    return () => {
      stopVision();
    };
  }, [settings.behavior.enableVision]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const transientStates = [AssistantStatus.THINKING, AssistantStatus.SPEAKING, AssistantStatus.SUCCESS, AssistantStatus.ERROR];
    if (!transientStates.includes(status)) {
      setStatus(isListening ? AssistantStatus.LISTENING : AssistantStatus.IDLE);
    }
  }, [isListening, status]);

  // Proactive behaviors (diary, curiosity)
  useEffect(() => {
    const runProactiveChecks = async () => {
      if(isAwaitingName) return;

      // Daily Diary
      if (settings.behavior.enableDiary) {
        const diary = getDiary();
        const todayKey = new Date().toISOString().split('T')[0];
        if (!diary[todayKey]) {
          const diaryEntryText = await generateDiaryEntry();
          if (diaryEntryText) {
            saveDiaryEntry(diaryEntryText);
            const diaryMessage: ChatMessage = { role: 'model', text: diaryEntryText, type: 'diary_entry' };
            setMessages(prev => [...prev, diaryMessage]);
            if (!isChatVisibleRef.current) setHasUnreadMessages(true);
          }
        }
      }

      // Curiosity Questions
      if (settings.behavior.enableCuriosity && Math.random() < 0.2) {
          const question = await generateCuriosityQuestion();
          if (question) {
              const conceptInQuestion = question.match(/o que é um?a? ([^\?]+)\??/i)?.[1] ||
                                    question.match(/sobre ([^\?]+)\??/i)?.[1];

              if (conceptInQuestion) setExpectingAnswerTo(conceptInQuestion.trim().replace(/\.$/, ''));
              
              const curiosityMessage: ChatMessage = { role: 'model', text: question, type: 'curiosity_prompt' };
              setMessages(prev => [...prev, curiosityMessage]);
              if (!isChatVisibleRef.current) setHasUnreadMessages(true);
          }
      }
    };
    const timer = setTimeout(runProactiveChecks, 5000);
    return () => clearTimeout(timer);
  }, [settings.behavior.enableDiary, settings.behavior.enableCuriosity, isAwaitingName]);

  const handleUserInput = useCallback(async (prompt: string) => {
    if (!prompt.trim() || status === AssistantStatus.THINKING || status === AssistantStatus.SPEAKING) return;
    
    stopListening();

    const userMessage: ChatMessage = { role: 'user', text: prompt, type: 'message' };

    if (isAwaitingName) {
      const profile = { name: prompt };
      saveUserProfile(profile);
      setUserProfile(profile);
      setIsAwaitingName(false);
      const greeting = `Prazer em te conhecer, ${prompt}! Como posso te ajudar hoje?`;
      setMessages(prev => [...prev, userMessage, { role: 'model', text: greeting }]);
      speak(greeting);
      return;
    }
    
    if (expectingAnswerTo) {
        strengthenConcept(expectingAnswerTo, prompt);
        setExpectingAnswerTo(null);
    }
    
    if(!isChatVisible) setIsChatVisible(true);

    const thinkingMessage: ChatMessage = { role: 'model', text: 'Nexus está pensando...', type: 'status' };
    setMessages(prev => [...prev, userMessage, thinkingMessage]);
    setStatus(AssistantStatus.THINKING);

    try {
      const visionContext = detectedObjects.length > 0 ? `Contexto Visual: Eu vejo os seguintes objetos por perto: ${detectedObjects.join(', ')}.` : '';
      const response = await getGeminiResponse(prompt, messages, visionContext, userProfile);
      let finalResponseText = response.text;
      const hasFunctionCalls = response.functionCalls && response.functionCalls.length > 0;

      if (hasFunctionCalls) {
        setStatus(AssistantStatus.SUCCESS);
        const callResults = response.functionCalls.map(fc => handleFunctionCall(fc, prompt));
        const actionResults = callResults.filter(r => r.isActionResult);
        if (actionResults.length > 0) {
            finalResponseText = actionResults.map(r => r.text).join('\n');
        }
      }
      
      if (!finalResponseText && !hasFunctionCalls) {
        finalResponseText = "Hmm, não tenho certeza de como responder a isso. Podemos falar sobre outra coisa?";
      }

      const delay = hasFunctionCalls ? 1200 : 0;

      if (finalResponseText) {
        setTimeout(() => {
            const finalModelMessage: ChatMessage = { role: 'model', text: finalResponseText, type: 'message' };
            setMessages(prev => [...prev.filter(m => m.type !== 'status'), finalModelMessage]);
            if (!isChatVisibleRef.current) setHasUnreadMessages(true);
            setStatus(AssistantStatus.SPEAKING);
            speak(finalResponseText, () => setStatus(AssistantStatus.IDLE));
        }, delay);
      } else {
        setTimeout(() => {
          setMessages(prev => prev.filter(m => m.type !== 'status'));
          setStatus(AssistantStatus.IDLE);
        }, delay);
      }

    } catch (error) {
      console.error("Error getting response from Gemini:", error);
      setMessages(prev => prev.filter(m => m.type !== 'status'));
      setStatus(AssistantStatus.ERROR);
      
      setTimeout(() => {
          const errorMessage: ChatMessage = { role: 'model', text: "Desculpe, ocorreu um erro.", type: 'message' };
          setMessages(prev => [...prev, errorMessage]);
          if (!isChatVisibleRef.current) setHasUnreadMessages(true);
          setStatus(AssistantStatus.IDLE);
      }, 1500);
    }
  }, [messages, speak, status, stopListening, expectingAnswerTo, isChatVisible, isAwaitingName, detectedObjects, userProfile]);

  const handleFunctionCall = (fc: { name: string, args: any }, evidence: string): { text: string, isActionResult: boolean } => {
    let resultText = '';
    let isActionResult = true;

    switch (fc.name) {
      case 'open_app':
        const appName = fc.args.package_name || 'website';
        const url = `https://www.${appName.toLowerCase().replace(/\s+/g, '')}.com`;
        window.open(url, '_blank');
        resultText = `Abrindo ${appName}...`;
        break;
      case 'set_reminder':
        resultText = `Ok, lembrete definido para ${fc.args.time}: ${fc.args.message}`;
        break;
      case 'search_web':
        const query = encodeURIComponent(fc.args.query);
        window.open(`https://www.google.com/search?q=${query}`, '_blank');
        resultText = `Buscando por "${fc.args.query}" na web.`;
        break;
      case 'learn_concept':
        learnConcept(fc.args.concept, fc.args.metadata || {}, evidence);
        resultText = `Aprendi sobre: ${fc.args.concept}.`;
        isActionResult = false;
        break;
      case 'save_user_profile':
        const profile = { name: fc.args.name };
        saveUserProfile(profile);
        setUserProfile(profile);
        setIsAwaitingName(false);
        resultText = `Ok, vou te chamar de ${fc.args.name} de agora em diante.`;
        break;
      default:
        resultText = `Não consegui executar a ação: ${fc.name}`;
    }
    return { text: resultText, isActionResult };
  };
  
  const handleMicClick = () => {
    if (!isChatVisible) setIsChatVisible(true);
    if (isListening) stopListening();
    else startListening();
  };
  
  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleUserInput(inputValue);
    setInputValue('');
  };

  const onSettingsChange = (newSettings: AppSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  return (
    <div className="h-screen w-screen bg-gray-900 flex flex-col overflow-hidden relative">
      <video ref={videoRef} autoPlay playsInline muted className="absolute w-px h-px opacity-0 -z-10" />

      {isVisionActive && (
          <div className="absolute top-4 left-4 z-30 p-2 bg-gray-700/50 rounded-full text-cyan-300 animate-pulse" aria-label="Modo Visão ativo">
              <svg xmlns="http://www.w.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
          </div>
      )}
      
      <button 
        onClick={() => setIsSettingsVisible(true)}
        aria-label="Abrir configurações"
        className="absolute top-4 right-4 z-30 p-2 bg-gray-700/50 rounded-full text-gray-300 hover:bg-gray-600/80 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
      </button>

      <main className={`flex-grow flex items-center justify-center transition-all duration-500 ease-in-out ${isChatVisible ? 'flex-grow-0 h-[33%]' : 'flex-grow h-full'}`}>
        <Avatar 
          status={status} 
          className={`transition-all duration-500 ease-in-out ${isChatVisible ? 'w-28 h-28 md:w-32 md:h-32' : 'w-48 h-48 md:w-56 md:h-56'}`}
        />
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
              <Message key={index} role={msg.role} text={msg.text} type={msg.type} />
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