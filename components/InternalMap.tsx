import React, { useState, useEffect } from 'react';
// FIX: Import `Variants` type from framer-motion to correctly type animation variants.
import { motion, type Variants } from 'framer-motion';
import { db } from '../services/indexedDBService';
import { Concept, Synapse } from '../types';

interface InternalMapProps {
  onClose: () => void;
  isVisible: boolean;
  userId: string;
}

interface ConceptWithSynapses extends Concept {
    synapses: Synapse[];
}

const listVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.07,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', stiffness: 100 }
  },
};

export const InternalMap: React.FC<InternalMapProps> = ({ onClose, isVisible, userId }) => {
  const [concepts, setConcepts] = useState<ConceptWithSynapses[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isVisible) {
      setIsLoading(true);
      Promise.all([
// FIX: Pass userId to getAllConcepts as required by the multi-user database schema.
        db.getAllConcepts(userId),
// FIX: Pass userId to getSystemMemory as required by the multi-user database schema.
        db.getSystemMemory(userId)
      ]).then(([allConcepts, systemMemory]) => {
        const synapses = systemMemory.synapses || [];
        const conceptsWithSynapses = allConcepts.map(concept => {
            const conceptSynapses = synapses
                .filter(s => s.source === concept.name || s.target === concept.name)
                .sort((a, b) => b.strength - a.strength)
                .slice(0, 3);
            return { ...concept, synapses: conceptSynapses };
        });
        
        conceptsWithSynapses.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
        setConcepts(conceptsWithSynapses);
        setIsLoading(false);
      });
    }
  }, [isVisible, userId]);

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
            <motion.ul className="space-y-3" variants={listVariants} initial="hidden" animate="visible">
              {concepts.map(concept => (
                <motion.li key={concept.name} variants={itemVariants} className="bg-gray-700/50 p-3 rounded-lg">
                    <p className="font-semibold text-white capitalize">{concept.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <div className="w-full bg-gray-600 rounded-full h-2.5">
                            <div className="bg-cyan-500 h-2.5 rounded-full" style={{ width: `${(concept.confidence || 0) * 100}%` }}></div>
                        </div>
                        <span className="text-xs font-medium text-gray-300">{Math.round((concept.confidence || 0) * 100)}%</span>
                    </div>
                    {concept.synapses.length > 0 && (
                        <div className="mt-2 pt-2 pl-2 border-l-2 border-gray-600">
                            <h4 className="text-xs font-bold text-gray-400">Conexões Fortes:</h4>
                            <ul className="text-xs text-gray-300 list-disc list-inside">
                                {concept.synapses.map((syn, i) => (
                                    <li key={i} className="capitalize">
                                        {syn.source === concept.name ? '→' : '←'} {syn.source === concept.name ? syn.target : syn.source} ({Math.round(syn.strength * 100)}%)
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </motion.li>
              ))}
            </motion.ul>
          )}
        </main>
      </div>
    </div>
  );
};