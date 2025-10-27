
import React, { useState, useEffect } from 'react';
import { db } from '../services/indexedDBService';
import { Concept } from '../types';

interface InternalMapProps {
  onClose: () => void;
  isVisible: boolean;
}

export const InternalMap: React.FC<InternalMapProps> = ({ onClose, isVisible }) => {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isVisible) {
      setIsLoading(true);
      db.getAllConcepts().then(allConcepts => {
        allConcepts.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
        setConcepts(allConcepts);
        setIsLoading(false);
      });
    }
  }, [isVisible]);

  return (
    <div className={`fixed inset-0 bg-black/60 z-30 flex justify-start backdrop-blur-sm transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose}>
      <div 
        className={`bg-gray-800/90 shadow-2xl w-full max-w-sm h-full flex flex-col transition-transform duration-300 ease-in-out ${isVisible ? 'translate-x-0' : '-translate-x-full'}`} 
        onClick={e => e.stopPropagation()}
      >
        <header className="flex-shrink-0 p-4 border-b border-gray-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h2 className="text-xl font-bold text-white">Mapa Interno do Nexus</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </header>

        <main className="flex-grow p-4 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              Carregando memória...
            </div>
          ) : concepts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="font-semibold">Memória vazia.</p>
              <p className="text-sm">Nenhum conceito aprendido ainda.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {concepts.map(concept => (
                <li key={concept.name} className="bg-gray-700/50 p-3 rounded-lg">
                    <p className="font-semibold text-white capitalize">{concept.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <div className="w-full bg-gray-600 rounded-full h-2.5">
                            <div className="bg-cyan-500 h-2.5 rounded-full" style={{ width: `${(concept.confidence || 0) * 100}%` }}></div>
                        </div>
                        <span className="text-xs font-medium text-gray-300">{Math.round((concept.confidence || 0) * 100)}%</span>
                    </div>
                     <p className="text-xs text-gray-400 mt-1.5">Última atualização: {new Date(concept.updatedAt).toLocaleDateString()}</p>
                </li>
              ))}
            </ul>
          )}
        </main>
      </div>
    </div>
  );
};
