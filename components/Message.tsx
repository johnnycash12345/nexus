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

export const Message: React.FC<MessageProps> = ({ role, text, type = 'message' }) => {
  const isUser = role === 'user';
  
  if (type === 'status') {
    return (
      <div className="flex justify-center animate-fade-in-slide-up">
        <p className="text-sm text-gray-400 italic">{text}</p>
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
        <p className="text-white whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
};
