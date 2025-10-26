import React from 'react';
import { ChatMessage } from '../types';

interface MessageProps extends ChatMessage {}

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

export const Message: React.FC<MessageProps> = ({ role, text, type = 'message', imageUrl }) => {
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
      </div>
    </div>
  );
};