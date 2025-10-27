import React, { useState, useEffect } from 'react';
import { db } from '../services/indexedDBService';
import { SystemMemory } from '../types';

interface CognitiveStatusProps {
  onClose: () => void;
  isVisible: boolean;
}

interface ModuleData {
    name: string;
    description: string;
    // FIX: Replaced JSX.Element with React.ReactNode to resolve namespace issue.
    icon: React.ReactNode;
    metric?: string;
    value?: string | number;
}

const ModuleCard: React.FC<ModuleData> = ({ name, description, icon, metric, value }) => (
    <div className="bg-gray-700/50 p-4 rounded-lg flex items-start gap-4 animate-fade-in-slide-up">
        <div className="flex-shrink-0 w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center text-cyan-400">
            {icon}
        </div>
        <div>
            <h3 className="font-bold text-white">{name}</h3>
            <p className="text-sm text-gray-400 mt-1">{description}</p>
            {metric && value !== undefined && (
                <p className="text-xs text-cyan-300 mt-2 font-mono bg-gray-800/50 px-2 py-1 rounded inline-block">
                    <span className="font-semibold">{metric}:</span> {value}
                </p>
            )}
        </div>
    </div>
);

export const CognitiveStatus: React.FC<CognitiveStatusProps> = ({ onClose, isVisible }) => {
  const [systemMemory, setSystemMemory] = useState<SystemMemory | null>(null);
  const [conceptCount, setConceptCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isVisible) {
      setIsLoading(true);
      Promise.all([
        db.getSystemMemory(),
        db.getAllConcepts(),
      ]).then(([memory, concepts]) => {
        setSystemMemory(memory);
        setConceptCount(concepts.length);
        setIsLoading(false);
      });
    }
  }, [isVisible]);

  const modules: ModuleData[] = [
    {
        name: 'Núcleo de Identidade (Consciousness Core)',
        description: systemMemory?.identityOverride?.selfDescription ?? 'O modelo interno que o Nexus tem de si mesmo.',
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>,
        metric: 'Identidade Ativa',
        value: systemMemory?.identityOverride?.name ?? 'N/A',
    },
    {
      name: 'Percepção (Input Processor)',
      description: 'Interpreta entradas do usuário e do ambiente, convertendo-as em frames cognitivos.',
      icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
      metric: 'Status',
      value: 'Online',
    },
    {
      name: 'Memória (Memory Core)',
      description: 'Armazena experiências, conceitos e aprendizados em níveis de curto, médio e longo prazo.',
      icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7a8 8 0 0116 0" /></svg>,
      metric: 'Conceitos Aprendidos',
      value: conceptCount,
    },
    {
        name: 'Grafo Cognitivo (Cognitive Graph)',
        description: 'Rede dinâmica de conceitos e relações que permite aprendizado associativo.',
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
        metric: 'Sinapses Ativas',
        value: systemMemory?.synapses?.length ?? 0,
    },
    {
        name: 'Raciocínio e Reflexão (Reasoning Engine)',
        description: 'Analisa a própria lógica e processos, identificando oportunidades de otimização.',
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
        metric: 'Última Reflexão',
        value: systemMemory?.lastReflectionAt ? new Date(systemMemory.lastReflectionAt).toLocaleString('pt-BR') : 'N/A',
    },
     {
        name: 'Autoaperfeiçoamento (Self-Evolution Engine)',
        description: 'Permite ao Nexus reescrever suas próprias diretivas e comportamentos de forma segura.',
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
        metric: 'Última Evolução',
        value: systemMemory?.lastEvolutionAt ? new Date(systemMemory.lastEvolutionAt).toLocaleString('pt-BR') : 'N/A',
    },
    {
        name: 'Metacognição (Self-Model)',
        description: 'O modelo interno que o Nexus tem de si mesmo para avaliar progresso e planejar evoluções.',
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a4 4 0 00-4-4H3V9h2a4 4 0 004-4V3l4 4-4 4zm6 0v-2a4 4 0 014-4h2V9h-2a4 4 0 01-4-4V3l-4 4 4 4z" /></svg>,
        metric: 'Foco Atual',
        value: systemMemory?.evolutionGoal?.currentFocus ?? 'Inicializando...',
    },
  ];

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
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h7.5M8.25 12h7.5m-7.5 5.25h7.5m-11.25-2.25L4.5 13.5m0 0l-1.5-1.5M4.5 13.5V15m15-1.5L19.5 13.5m0 0l-1.5-1.5m1.5 1.5V15M3 12a9 9 0 1118 0 9 9 0 01-18 0z" /></svg>
            <h2 className="text-xl font-bold text-white">Arquitetura Cognitiva</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </header>

        <main className="flex-grow p-4 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              Carregando estado interno...
            </div>
          ) : (
            <div className="space-y-4">
                {modules.map((mod, i) => (
                    <ModuleCard key={i} {...mod} />
                ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};