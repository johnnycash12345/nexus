import React from 'react';
import { Avatar } from './Avatar';
import { AssistantStatus } from '../types';

interface StartScreenProps {
  onStart: () => void;
  onOpenSettings: () => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({ onStart, onOpenSettings }) => {
  const handleDownload = () => {
    // In a real scenario, this would point to the APK file.
    // For now, we'll just show an alert.
    alert('O download para Android estará disponível em breve!');
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center text-center p-4 animate-fade-in">
        <style>{`
            @keyframes fade-in {
                from { opacity: 0; transform: scale(0.95); }
                to { opacity: 1; transform: scale(1); }
            }
            .animate-fade-in { animation: fade-in 0.8s ease-out forwards; }
        `}</style>
      <div className="mb-8">
        <Avatar status={AssistantStatus.SLEEPY} className="w-48 h-48" />
      </div>
      <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">Nexus</h1>
      <p className="text-lg text-gray-400 mb-10">Seu assistente pessoal inteligente.</p>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
        <button
          onClick={onStart}
          className="w-full px-6 py-3 bg-cyan-600 text-white font-semibold rounded-lg shadow-lg hover:bg-cyan-500 transition-all transform hover:scale-105"
        >
          Iniciar Nexus
        </button>
      </div>
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm mt-4">
         <button
          onClick={handleDownload}
          className="w-full px-6 py-3 bg-gray-700 text-white font-semibold rounded-lg shadow-lg hover:bg-gray-600 transition-all"
        >
          Baixar para Android
        </button>
        <button
          onClick={onOpenSettings}
          className="w-full px-6 py-3 bg-transparent border-2 border-gray-600 text-gray-300 font-semibold rounded-lg hover:bg-gray-800 hover:text-white transition-all"
        >
          Configurações
        </button>
      </div>
    </div>
  );
};