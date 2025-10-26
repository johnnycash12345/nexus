

import React from 'react';
import { ChatMessage, Concept, NewsArticle } from '../types';

interface MessageProps extends ChatMessage {
  onAction?: (action: string, payload: any) => void;
}

const MessageStyles: React.FC = () => (
  <style>{`
    @keyframes fade-in-slide-up {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .animate-fade-in-slide-up {
      animation: fade-in-slide-up 0.3s ease-out forwards;
    }
  `}</style>
);

export const Message: React.FC<MessageProps> = ({ role, text, type = 'message', imageUrl, consolidationOptions, onAction, sources, articles }) => {
  const isUser = role === 'user';
  
  if (type === 'status') {
    return (
      <div className="flex justify-center animate-fade-in-slide-up">
        <p className="text-sm text-gray-400 italic">{text}</p>
      </div>
    );
  }
  
  if (type === 'diary_entry') {
      return (
          <div className="flex justify-center animate-fade-in-slide-up my-2">
              <div className="w-full max-w-md bg-gray-700/80 border border-cyan-500/30 rounded-lg p-4 shadow-lg backdrop-blur-sm">
                  <h3 className="font-bold text-cyan-400 mb-2">Diário do Nexus</h3>
                  <p className="text-gray-300 italic whitespace-pre-wrap">"{text}"</p>
              </div>
          </div>
      );
  }
  
  if (type === 'curiosity_prompt') {
      return (
          <div className="flex justify-start animate-fade-in-slide-up">
              <div className="max-w-xs md:max-w-md lg:max-w-lg px-4 py-3 rounded-2xl shadow-md bg-yellow-600/80 rounded-bl-none border border-yellow-400/50">
                   <p className="text-white whitespace-pre-wrap"><span className="font-bold">Pergunta para você:</span> {text}</p>
              </div>
          </div>
      );
  }

  if (type === 'concept_consolidation_prompt') {
    return (
      <div className="flex justify-start animate-fade-in-slide-up my-2">
          <div className="w-full max-w-md bg-gray-700/80 border border-yellow-500/30 rounded-lg p-4 shadow-lg backdrop-blur-sm">
              <h3 className="font-bold text-yellow-400 mb-2">🧠 Organizando Ideias</h3>
              <p className="text-gray-300 mb-4">{text}</p>
              <div className="flex justify-end gap-3">
                  <button 
                      onClick={() => onAction?.('ignore_consolidation', consolidationOptions)}
                      className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded-md transition-colors text-sm font-medium"
                  >
                      Ignorar
                  </button>
                  <button
                      onClick={() => onAction?.('merge_concepts', consolidationOptions)}
                      className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 rounded-md transition-colors text-sm font-medium"
                  >
                      Sim, Unificar
                  </button>
              </div>
          </div>
      </div>
    );
  }

  if (type === 'news_summary') {
    return (
      <div className="flex justify-start animate-fade-in-slide-up my-2">
        <div className="w-full max-w-md bg-gray-700/80 border border-gray-600/50 rounded-lg p-4 shadow-lg backdrop-blur-sm">
          <p className="text-gray-300 mb-4">{text}</p>
          <div className="space-y-3">
            {articles?.map((article, index) => (
              <a key={index} href={article.url} target="_blank" rel="noopener noreferrer" className="block p-3 bg-gray-800/60 rounded-lg hover:bg-gray-800 transition-colors">
                <h4 className="font-bold text-cyan-400 mb-1">{article.title}</h4>
                <p className="text-xs text-gray-400 mb-2 font-medium">{article.sourceName}</p>
                <p className="text-sm text-gray-300 leading-snug">{article.description}</p>
              </a>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-end animate-fade-in-slide-up ${isUser ? 'justify-end' : 'justify-start'}`}>
      <MessageStyles />
      <div
        className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-3 rounded-2xl shadow-md ${
          isUser
            ? 'bg-cyan-600 rounded-br-none'
            : 'bg-gray-700 rounded-bl-none'
        }`}
      >
        {imageUrl && (
            <img src={imageUrl} alt="User upload" className="rounded-lg mb-2 max-h-48 w-full object-cover" />
        )}
        <p className="text-white whitespace-pre-wrap">{text}</p>
        {sources && sources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-600/50">
                <h4 className="text-xs font-bold text-gray-300 mb-2">Fontes:</h4>
                <ul className="text-xs space-y-1">
                    {sources.map((source, index) => (
                    <li key={index} className="truncate">
                        <a 
                            href={source.uri} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-cyan-300 hover:underline hover:text-cyan-200 flex items-center gap-1.5"
                            title={source.title}
                        >
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                           <span>{source.title}</span>
                        </a>
                    </li>
                    ))}
                </ul>
            </div>
        )}
      </div>
    </div>
  );
};