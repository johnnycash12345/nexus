import React, { useState, useEffect } from 'react';
import { db } from '../services/indexedDBService';
import { DiaryEntry, EvolutionLog, SystemMemory } from '../types';

interface ReflectionHistoryProps {
  onClose: () => void;
  isVisible: boolean;
}

type Thought = {
  id: string;
  type: 'reflection' | 'diary' | 'evolution';
  content: string;
  timestamp: number;
};

const ThoughtIcon: React.FC<{ type: Thought['type'] }> = ({ type }) => {
    switch (type) {
        case 'diary':
            return <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>;
        case 'evolution':
            return <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>;
        case 'reflection':
        default:
            return <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>;
    }
};

const ThoughtCard: React.FC<{ thought: Thought }> = ({ thought }) => {
    const getTitle = () => {
        switch (thought.type) {
            case 'diary': return 'Entrada do Diário';
            case 'evolution': return 'Evolução Cognitiva';
            case 'reflection': return 'Reflexão Interna';
        }
    };

    return (
        <li className="bg-gray-700/50 p-3 rounded-lg animate-fade-in-slide-up">
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">{<ThoughtIcon type={thought.type} />}</div>
                <div>
                    <div className="flex items-baseline justify-between">
                        <h4 className="font-semibold text-white">{getTitle()}</h4>
                        <span className="text-xs text-gray-500 ml-4">{new Date(thought.timestamp).toLocaleString('pt-BR')}</span>
                    </div>
                    <p className="text-sm text-gray-300 mt-1 whitespace-pre-wrap">{thought.content}</p>
                </div>
            </div>
        </li>
    );
};


export const ReflectionHistory: React.FC<ReflectionHistoryProps> = ({ onClose, isVisible }) => {
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isVisible) {
      setIsLoading(true);
      Promise.all([
        db.getSystemMemory(),
        db.getDiary(),
        db.getLatestEvolutionLogs(10)
      ]).then(([systemMemory, diary, evolutionLogs]) => {
        const allThoughts: Thought[] = [];

        // Add diary entries
        Object.values(diary).forEach(d => {
            allThoughts.push({
                id: `diary-${d.dayKey}`,
                type: 'diary',
                content: d.entry,
                timestamp: d.createdAt
            });
        });

        // Add reflections
        systemMemory?.memory?.reflective?.forEach((r, i) => {
            allThoughts.push({
                id: `ref-${systemMemory.lastReflectionAt || 0}-${i}`,
                type: 'reflection',
                content: r,
                timestamp: (systemMemory.lastReflectionAt || Date.now()) - (i * 1000) // approximate timestamp
            });
        });

        // Add evolution logs
        evolutionLogs.forEach(log => {
            const changeDesc = log.changes.map(c => `Diretiva '${c.target}' atualizada.`).join(' ');
            allThoughts.push({
                id: `evo-${log.id}`,
                type: 'evolution',
                content: `Iniciei um ciclo de auto-aperfeiçoamento. ${changeDesc}`,
                timestamp: log.timestamp
            });
        });

        // Remove duplicates and sort
        const uniqueThoughts = Array.from(new Map(allThoughts.map(t => [t.id, t])).values());
        uniqueThoughts.sort((a, b) => b.timestamp - a.timestamp);
        
        setThoughts(uniqueThoughts);
        setIsLoading(false);
      });
    }
  }, [isVisible]);

  return (
    <div className={`fixed inset-0 bg-black/60 z-30 flex justify-start backdrop-blur-sm transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose}>
        <style>{`
            @keyframes fade-in-slide-up {
                from { opacity: 0; transform: translateY(5px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .animate-fade-in-slide-up {
                animation: fade-in-slide-up 0.4s ease-out forwards;
            }
        `}</style>
      <div 
        className={`bg-gray-800/90 shadow-2xl w-full max-w-sm h-full flex flex-col transition-transform duration-300 ease-in-out ${isVisible ? 'translate-x-0' : '-translate-x-full'}`} 
        onClick={e => e.stopPropagation()}
      >
        <header className="flex-shrink-0 p-4 border-b border-gray-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            <h2 className="text-xl font-bold text-white">Pensamentos do Nexus</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </header>

        <main className="flex-grow p-4 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              Acessando memórias...
            </div>
          ) : thoughts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="font-semibold">Nenhum pensamento registrado.</p>
              <p className="text-sm">Interaja com o Nexus para começar.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {thoughts.map(thought => (
                <ThoughtCard key={thought.id} thought={thought} />
              ))}
            </ul>
          )}
        </main>
      </div>
    </div>
  );
};