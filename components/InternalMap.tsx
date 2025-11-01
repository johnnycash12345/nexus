import { useState, useEffect } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { db } from '../services/indexedDBService';
import { Concept, Synapse } from '../types';

// --- Props e Tipos ---

interface InternalMapProps {
  onClose: () => void;
  isVisible: boolean;
  userId: string;
}

interface ConceptWithSynapses extends Concept {
  synapses: Synapse[];
}

// --- Variantes de Animação ---

const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
};

const sidebarVariants: Variants = {
  hidden: { x: "-100%" },
  visible: { x: 0, transition: { duration: 0.3, ease: "easeInOut" } },
};

const listVariants: Variants = {
  hidden: { transition: { staggerChildren: 0.05, staggerDirection: -1 } },
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

// --- Componente Principal ---

export const InternalMap = ({ onClose, isVisible, userId }: InternalMapProps) => {
  const [concepts, setConcepts] = useState<ConceptWithSynapses[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Efeito para carregar os dados
  useEffect(() => {
    if (!isVisible) return;

    let isMounted = true;

    const loadMemory = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [allConcepts, systemMemory] = await Promise.all([
          db.getAllConcepts(userId),
          db.getSystemMemory(userId)
        ]);

        const synapses = systemMemory.synapses || [];
        
        // Otimização: Criar um mapa de lookup para sinapses
        const synapseMap = new Map<string, Synapse[]>();
        for (const synapse of synapses) {
          // Adiciona à lista do 'source'
          if (!synapseMap.has(synapse.source)) synapseMap.set(synapse.source, []);
          synapseMap.get(synapse.source)!.push(synapse);

          // Adiciona à lista do 'target' (se for diferente)
          if (synapse.source !== synapse.target) {
            if (!synapseMap.has(synapse.target)) synapseMap.set(synapse.target, []);
            synapseMap.get(synapse.target)!.push(synapse);
          }
        }

        // Processa os conceitos usando o mapa
        const conceptsWithSynapses = allConcepts.map(concept => {
          const relatedSynapses = synapseMap.get(concept.name) || [];
          // Clona, ordena e fatia as sinapses relacionadas
          const topSynapses = [...relatedSynapses] 
            .sort((a, b) => b.strength - a.strength)
            .slice(0, 3);
          
          return { ...concept, synapses: topSynapses };
        });
        
        // Ordena os conceitos principais por confiança
        conceptsWithSynapses.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

        if (isMounted) {
          setConcepts(conceptsWithSynapses);
        }

      } catch (err) {
        console.error("Failed to load internal map:", err);
        if (isMounted) {
          setError("Falha ao carregar a memória. Tente novamente.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadMemory();

    return () => {
      isMounted = false;
    };
  }, [isVisible, userId]);

  // Efeito para fechar o modal com a tecla 'Escape'
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isVisible, onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 bg-black/60 z-30 flex justify-start backdrop-blur-sm"
          onClick={onClose}
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          <motion.div
            className="bg-gray-800/90 shadow-2xl w-full max-w-sm h-full flex flex-col"
            onClick={e => e.stopPropagation()}
            variants={sidebarVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="internal-map-title"
          >
            <Header onClose={onClose} />
            <Content isLoading={isLoading} error={error} concepts={concepts} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// --- Componentes de UI Internos ---

const Header: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <header className="flex-shrink-0 p-4 border-b border-gray-700/80 flex items-center justify-between">
    <div className="flex items-center gap-3">
      <IconMapPin />
      <h2 id="internal-map-title" className="text-xl font-bold text-white">
        Mapa Interno do Nexus
      </h2>
    </div>
    <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Fechar mapa interno">
      <IconClose />
    </button>
  </header>
);

interface ContentProps {
  isLoading: boolean;
  error: string | null;
  concepts: ConceptWithSynapses[];
}

const Content: React.FC<ContentProps> = ({ isLoading, error, concepts }) => (
  <main className="flex-grow p-4 overflow-y-auto">
    {isLoading ? (
      <div className="flex items-center justify-center h-full text-gray-400">
        Carregando memória...
      </div>
    ) : error ? (
      <div className="flex flex-col items-center justify-center h-full text-red-400 text-center px-4">
        <IconError />
        <p className="font-semibold mt-4">Erro ao Carregar</p>
        <p className="text-sm">{error}</p>
      </div>
    ) : concepts.length === 0 ? (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <IconEmpty />
        <p className="font-semibold mt-4">Memória vazia.</p>
        <p className="text-sm">Nenhum conceito aprendido ainda.</p>
      </div>
    ) : (
      <motion.ul className="space-y-3" variants={listVariants} initial="hidden" animate="visible" exit="hidden">
        {concepts.map(concept => (
          <ConceptItem key={concept.name} concept={concept} />
        ))}
      </motion.ul>
    )}
  </main>
);

const ConceptItem: React.FC<{ concept: ConceptWithSynapses }> = ({ concept }) => (
  <motion.li variants={itemVariants} className="bg-gray-700/50 p-3 rounded-lg">
    <p className="font-semibold text-white capitalize">{concept.name}</p>
    <div className="flex items-center gap-2 mt-1">
      <div className="w-full bg-gray-600 rounded-full h-2.5">
        <div 
          className="bg-cyan-500 h-2.5 rounded-full" 
          style={{ width: `${(concept.confidence || 0) * 100}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-300">
        {Math.round((concept.confidence || 0) * 100)}%
      </span>
    </div>
    {concept.synapses.length > 0 && (
      <div className="mt-2 pt-2 pl-2 border-l-2 border-gray-600">
        <h4 className="text-xs font-bold text-gray-400">Conexões Fortes:</h4>
        <ul className="text-xs text-gray-300 list-disc list-inside">
          {concept.synapses.map((syn) => (
            <li key={`${syn.source}-${syn.target}`} className="capitalize">
              {syn.source === concept.name ? '→' : '←'} {syn.source === concept.name ? syn.target : syn.source} 
              <span className="text-gray-400"> ({Math.round(syn.strength * 100)}%)</span>
            </li>
          ))}
        </ul>
      </div>
    )}
  </motion.li>
);

// --- Componentes de Ícone ---

const IconMapPin = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const IconClose = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const IconEmpty = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconError = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);