import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AssistantStatus, ChatMessage } from './types';
import { useSpeech } from './hooks/useSpeech';
import { getGeminiResponse } from './services/geminiService';
import { logAction } from './services/routineService';
import { Avatar } from './components/Avatar';
import { Message } from './components/Message';

const App: React.FC = () => {
  const [status, setStatus] = useState<AssistantStatus>(AssistantStatus.IDLE);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      text: "Olá! Eu sou o Nexus. Como posso ajudar você hoje?",
      type: 'message',
    }
  ]);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const { isListening, transcript, startListening, stopListening, speak } = useSpeech(
    // onResult callback from useSpeech
    (text: string) => handleUserInput(text)
  );

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    // Update status only if not in a transient state
    const transientStates = [AssistantStatus.THINKING, AssistantStatus.SPEAKING, AssistantStatus.SUCCESS, AssistantStatus.ERROR];
    if (!transientStates.includes(status)) {
      setStatus(isListening ? AssistantStatus.LISTENING : AssistantStatus.IDLE);
    }
  }, [isListening, status]);

  const handleUserInput = useCallback(async (prompt: string) => {
    if (!prompt || status === AssistantStatus.THINKING || status === AssistantStatus.SPEAKING) return;
    
    stopListening();
    
    const userMessage: ChatMessage = { role: 'user', text: prompt, type: 'message' };
    const thinkingMessage: ChatMessage = { role: 'model', text: 'Nexus está pensando...', type: 'status' };

    setMessages(prev => [...prev, userMessage, thinkingMessage]);
    setStatus(AssistantStatus.THINKING);

    try {
      const response = await getGeminiResponse(prompt, messages);
      
      if (response.functionCalls && response.functionCalls.length > 0) {
        setStatus(AssistantStatus.SUCCESS);
        const results = response.functionCalls.map(handleFunctionCall);
        const responseText = results.join('\n');
        
        // Wait for success animation to play
        setTimeout(() => {
            const finalModelMessage: ChatMessage = { role: 'model', text: responseText, type: 'message' };
            setMessages(prev => [...prev.filter(m => m.type !== 'status'), finalModelMessage]);
            setStatus(AssistantStatus.SPEAKING);
            speak(responseText, () => setStatus(AssistantStatus.IDLE));
        }, 1200);

      } else {
        const responseText = response.text;
        const finalModelMessage: ChatMessage = { role: 'model', text: responseText, type: 'message' };
        setMessages(prev => [...prev.filter(m => m.type !== 'status'), finalModelMessage]);
        setStatus(AssistantStatus.SPEAKING);
        speak(responseText, () => setStatus(AssistantStatus.IDLE));
      }

    } catch (error) {
      console.error("Error getting response from Gemini:", error);
      setMessages(prev => prev.filter(m => m.type !== 'status'));
      setStatus(AssistantStatus.ERROR);
      
      // Wait for error animation to play
      setTimeout(() => {
          const errorMessage: ChatMessage = { role: 'model', text: "Desculpe, ocorreu um erro ao processar sua solicitação.", type: 'message' };
          setMessages(prev => [...prev, errorMessage]);
          setStatus(AssistantStatus.IDLE);
      }, 1500);
    }
  }, [messages, speak, status, stopListening]);

  const handleFunctionCall = (fc: { name: string, args: any }): string => {
    let resultText = '';
    logAction(fc.name, fc.args); // Log action for routine learning

    switch (fc.name) {
      case 'open_app':
        const appName = fc.args.package_name || 'website';
        const url = `https://www.${appName.toLowerCase()}.com`;
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
      default:
        resultText = `Não consegui executar a ação: ${fc.name}`;
    }
    return resultText;
  };
  
  useEffect(() => {
    if (transcript) {
        handleUserInput(transcript);
    }
  }, [transcript, handleUserInput]);

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center p-4">
      <header className="w-full max-w-4xl text-center flex-shrink-0">
        <h1 className="text-4xl md:text-5xl font-bold text-cyan-400">Nexus</h1>
        <p className="text-gray-400 mt-2">Seu assistente pessoal inteligente</p>
      </header>

      <main className="flex-grow flex flex-col items-center w-full max-w-2xl my-4 md:my-6 min-h-0">
        <Avatar status={status} className="w-48 h-48 md:w-56 md:h-56 flex-shrink-0" />
        <div 
          ref={chatContainerRef}
          className="w-full flex-grow bg-gray-800/50 rounded-lg p-4 mt-4 md:mt-6 overflow-y-auto border border-gray-700 backdrop-blur-sm min-h-0"
        >
          <div className="flex flex-col space-y-4">
            {messages.map((msg, index) => (
              <Message key={index} role={msg.role} text={msg.text} type={msg.type} />
            ))}
          </div>
        </div>
      </main>

      <footer className="w-full flex flex-col items-center justify-center flex-shrink-0 py-4">
        <div className="relative">
          <button
            onClick={handleMicClick}
            aria-label={isListening ? 'Parar de ouvir' : 'Começar a ouvir'}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 transform scale-100 hover:scale-110 focus:outline-none focus:ring-4 focus:ring-opacity-50 ${
              isListening
                ? 'bg-red-500 shadow-lg shadow-red-500/50 focus:ring-red-400'
                : 'bg-cyan-500 shadow-lg shadow-cyan-500/50 focus:ring-cyan-400'
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-10 w-10 text-white"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm-1 5a4 4 0 004 4v2.586l.293.293a1 1 0 001.414-1.414L11 14.586V13a4 4 0 00-5-3.938V10zM13 9a1 1 0 10-2 0v1a1 1 0 102 0V9z" />
              <path d="M10 18a8 8 0 006.32-3.086A1 1 0 0015.337 14H4.663a1 1 0 00-.983.914A8 8 0 0010 18z" />
            </svg>
          </button>
          {isListening && (
              <div className="absolute inset-0 rounded-full bg-red-500/50 animate-ping -z-10"></div>
          )}
        </div>
        <p className="mt-4 text-gray-400 text-sm">{isListening ? 'Ouvindo...' : 'Pressione o microfone para falar'}</p>
      </footer>
    </div>
  );
};

export default App;