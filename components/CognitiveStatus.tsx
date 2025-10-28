import React, { useState, useEffect } from 'react';
// FIX: Import `Variants` type from framer-motion to correctly type animation variants.
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { db } from '../services/indexedDBService';
import { SystemMemory, EvolutionLog, EvolutionCyclePhase } from '../types';

interface CognitiveStatusProps {
  onClose: () => void;
  isVisible: boolean;
}

interface ModuleData {
    name: string;
    description: string;
    icon: React.ReactNode;
    metric?: string;
    value?: string | number;
}

const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const panelVariants: Variants = {
  hidden: { x: "-100%" },
  visible: { 
    x: "0%",
    transition: { type: 'spring', stiffness: 120, damping: 20 }
  },
};

const listVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
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

const ModuleCard: React.FC<ModuleData> = ({ name, description, icon, metric, value }) => (
    <motion.div variants={itemVariants} className="bg-gray-700/50 p-4 rounded-lg flex items-start gap-4">
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
    </motion.div>
);

const EvolutionLogItem: React.FC<{ log: EvolutionLog }> = ({ log }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    return (
        <motion.div variants={itemVariants} className="bg-gray-700/50 p-3 rounded-lg text-sm">
            <div className="flex justify-between items-start cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div>
                    <p className="font-semibold text-green-300">{log.changes[0]?.target.split('.').pop()}: "{log.changes[0]?.newValue}"</p>
                    <p className="text-xs text-gray-400">{new Date(log.timestamp).toLocaleString('pt-BR')}</p>
                </div>
                <div className="flex flex-col items-end">
                     <p className="text-xs font-mono text-white bg-green-500/30 px-2 py-0.5 rounded-full">Confiança: {Math.round(log.confidence * 100)}%</p>
                     <svg className={`w-4 h-4 text-gray-400 mt-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </div>
            </div>
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginTop: '12px' }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        className="overflow-hidden border-t border-gray-600/50 pt-3 text-xs space-y-2 font-mono text-gray-300"
                    >
                        <p><span className="font-semibold text-cyan-400">Análise:</span> {log.analysis}</p>
                        <p><span className="font-semibold text-cyan-400">Raciocínio:</span> {log.reasoning}</p>
                        <p><span className="font-semibold text-cyan-400">Simulação:</span> {log.simulationResult}</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}

export const CognitiveStatus: React.FC<CognitiveStatusProps> = ({ onClose, isVisible }) => {
  const [systemMemory, setSystemMemory] = useState<SystemMemory | null>(null);
  const [evolutionLogs, setEvolutionLogs] = useState<EvolutionLog[]>([]);
  const [conceptCount, setConceptCount] = useState(0);
  const [cognitiveExpansionFactor, setCognitiveExpansionFactor] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPhase, setCurrentPhase] = useState<EvolutionCyclePhase>('IDLE');

  useEffect(() => {
    if (isVisible) {
      setIsLoading(true);
      Promise.all([
        db.getSystemMemory(),
        db.getAllConcepts(),
        db.getLatestEvolutionLogs(5),
      ]).then(([memory, concepts, logs]) => {
        setSystemMemory(memory);
        setConceptCount(concepts.length);
        setEvolutionLogs(logs);

        const synapses = memory.synapses || [];
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        const newSynapses = synapses.filter(s => s.createdAt && (now - s.createdAt < oneDay));
        const factor = newSynapses.length / 24;
        setCognitiveExpansionFactor(factor);

        setIsLoading(false);
      });
    }
    
    const handleEvolutionStatus = (event: CustomEvent) => {
        setCurrentPhase(event.detail.phase);
    };

    window.addEventListener('nexus-evolution-status-update', handleEvolutionStatus as EventListener);
    return () => {
        window.removeEventListener('nexus-evolution-status-update', handleEvolutionStatus as EventListener);
    };

  }, [isVisible]);
  
  const phaseText: Record<EvolutionCyclePhase, string> = {
    IDLE: 'Ocioso',
    OBSERVING: 'Observando...',
    ANALYZING: 'Analisando...',
    REASONING: 'Raciocinando...',
    SANDBOXING: 'Simulando...',
    INTEGRATING: 'Integrando...',
    PAUSED: 'Pausado',
  };

  const modules: ModuleData[] = [
    {
        name: 'Núcleo de Identidade (Identity Core)',
        description: 'A autopercepção do Nexus, construída a partir de suas experiências e reflexões.',
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>,
        metric: 'Identidade Ativa',
        value: systemMemory?.identityManifest?.active_identity ?? 'Nexus',
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
        description: 'A rede de sinapses que conecta conceitos, formando a base do conhecimento.',
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6.002l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.368a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" /></svg>,
        metric: 'Fator de Expansão (FEC)',
        value: `${cognitiveExpansionFactor.toFixed(2)} sinapses/h`,
    },
     {
        name: 'Autoaperfeiçoamento (Self-Evolution Engine)',
        description: 'Permite ao Nexus reescrever suas próprias diretivas e comportamentos de forma segura.',
        icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
        metric: 'Status do Ciclo',
        value: phaseText[currentPhase],
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
    <motion.div 
      className="fixed inset-0 bg-black/60 z-30 flex justify-start backdrop-blur-sm" 
      onClick={onClose}
      variants={backdropVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
      transition={{ duration: 0.3 }}
    >
      <motion.div 
        className="bg-gray-800/90 shadow-2xl w-full max-w-sm h-full flex flex-col" 
        onClick={e => e.stopPropagation()}
        variants={panelVariants}
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
                <motion.div className="space-y-4" variants={listVariants} initial="hidden" animate="visible">
                    {modules.map((mod, i) => (
                        <ModuleCard key={i} {...mod} />
                    ))}
                </motion.div>
                
                <div className="mt-6">
                    <h3 className="text-lg font-semibold text-cyan-300 mb-2">Heurísticas Comportamentais</h3>
                    <motion.div variants={listVariants} initial="hidden" animate="visible" className="space-y-2">
                        {systemMemory?.behavioralHeuristics && systemMemory.behavioralHeuristics.length > 0 ? (
                            systemMemory.behavioralHeuristics.map((heuristic, index) => (
                                <motion.div key={index} variants={itemVariants} className="bg-gray-700/50 p-3 rounded-lg text-sm text-gray-300 flex items-start gap-2">
                                    <span className="text-cyan-400 font-bold">§</span>
                                    <p>{heuristic}</p>
                                </motion.div>
                            ))
                        ) : (
                             <p className="text-sm text-gray-500 italic">Nenhuma heurística definida.</p>
                        )}
                    </motion.div>
                </div>
                
                <div className="mt-6">
                    <h3 className="text-lg font-semibold text-cyan-300 mb-2">Histórico de Evolução Recente</h3>
                    {evolutionLogs.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">Nenhuma evolução registrada ainda.</p>
                    ) : (
                        <motion.div className="space-y-3" variants={listVariants} initial="hidden" animate="visible">
                           {evolutionLogs.map(log => <EvolutionLogItem key={log.id} log={log} />)}
                        </motion.div>
                    )}
                </div>
            </div>
          )}
        </main>
      </motion.div>
    </motion.div>
  );
};