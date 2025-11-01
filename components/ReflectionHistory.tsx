import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { db } from '../services/indexedDBService';
import { Thought, CognitiveLog, AppSettings } from '../types';

// --- Tipos ---

interface CognitiveMonitorProps {
  onClose: () => void;
  isVisible: boolean;
  settings: AppSettings | null;
  userId: string;
}

type LogItem = (Thought & { logType: 'thought' }) | (CognitiveLog & { logType: 'action' });
type FilterType = 'all' | 'thought' | 'action' | 'evolution' | 'learning' | 'rollback';

// --- Animações ---

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
  exit: {
    x: "-100%",
    transition: { duration: 0.2 }
  }
};

// --- Lógica de Estilização ---

const getLogItemStyle = (item: LogItem) => {
  let IconComponent: React.ElementType;
  let colorClass, borderColorClass, bgColorClass, bgRingClass, title;

  if (item.logType === 'thought') {
    IconComponent = IconThought;
    colorClass = 'text-blue-400';
    borderColorClass = 'border-blue-500/50';
    bgColorClass = 'bg-blue-500';
    bgRingClass = 'bg-blue-500/30';
    title = `Pensamento: ${item.category}`;
  } else { // action
    switch (item.event) {
      case 'auto_evolution':
        IconComponent = IconEvolution;
        colorClass = 'text-green-400';
        borderColorClass = 'border-green-500/50';
        bgColorClass = 'bg-green-500';
        bgRingClass = 'bg-green-500/30';
        title = 'Auto-Evolução';
        break;
      case 'rollback':
        IconComponent = IconRollback;
        colorClass = 'text-red-400';
        borderColorClass = 'border-red-500/50';
        bgColorClass = 'bg-red-500';
        bgRingClass = 'bg-red-500/30';
        title = 'Rollback do Sistema';
        break;
      case 'new_learning':
      case 'knowledge_expansion':
        IconComponent = IconLearning;
        colorClass = 'text-yellow-400';
        borderColorClass = 'border-yellow-500/50';
        bgColorClass = 'bg-yellow-500';
        bgRingClass = 'bg-yellow-500/30';
        title = 'Novo Aprendizado';
        break;
      default:
        IconComponent = IconAction;
        colorClass = 'text-gray-400';
        borderColorClass = 'border-gray-600/50';
        bgColorClass = 'bg-gray-600';
        bgRingClass = 'bg-gray-600/30';
        title = `Ação: ${item.event}`;
        break;
    }
  }
  return { IconComponent, colorClass, borderColorClass, bgColorClass, bgRingClass, title };
};

// --- Dados dos Filtros ---

const filters: { key: FilterType, label: string, title: string }[] = [
  { key: 'all', label: 'Todos', title: 'Mostrar Todos' },
  { key: 'thought', label: '🧠', title: 'Filtrar por Pensamentos' },
  { key: 'action', label: '⚙️', title: 'Filtrar por Ações' },
  { key: 'evolution', label: '🟢', title: 'Filtrar por Evolução' },
  { key: 'learning', label: '💡', title: 'Filtrar por Aprendizado' },
  { key: 'rollback', label: '🔴', title: 'Filtrar por Rollbacks' }
];

// --- Componentes Filhos Memoizados ---

interface TimelineItemProps {
  item: LogItem;
  isExpanded: boolean;
  onToggle: () => void;
}

const TimelineItem = memo(({ item, isExpanded, onToggle }: TimelineItemProps) => {
  const { IconComponent, colorClass, borderColorClass, bgColorClass, bgRingClass, title } = getLogItemStyle(item);
  const content = item.logType === 'thought' ? item.summary : item.description;

  return (
    <motion.li
      variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
      className="pl-8 relative pb-6"
    >
      <div className={`absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full flex items-center justify-center ${bgRingClass}`}>
        <div className={`w-2 h-2 rounded-full ${bgColorClass}`} />
      </div>
      <div onClick={onToggle} className={`p-3 rounded-lg cursor-pointer transition-all duration-300 bg-gray-700/50 hover:bg-gray-700/80 border-l-2 ${borderColorClass}`}>
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 mt-0.5 ${colorClass}`}><IconComponent /></div>
          <div>
            <div className="flex items-baseline justify-between flex-wrap">
              <h4 className="font-semibold text-white capitalize">{title.replace(/_/g, ' ')}</h4>
              <span className="text-xs text-gray-500 ml-4 flex-shrink-0">{new Date(item.timestamp).toLocaleString('pt-BR')}</span>
            </div>
            <p className="text-sm text-gray-300 mt-1">{content}</p>
          </div>
        </div>
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: '12px' }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="overflow-hidden"
            >
              <div className="border-t border-gray-600/50 pt-3 text-xs space-y-1 font-mono text-gray-400">
                {item.logType === 'thought' ? (
                  <>
                    <p><span className="font-semibold text-cyan-400">Contexto:</span> {item.context}</p>
                    <p><span className="font-semibold text-cyan-400">Emoção:</span> {item.emotional_state}</p>
                    <p><span className="font-semibold text-cyan-400">Confiança:</span> {Math.round(item.confidence * 100)}%</p>
                  </>
                ) : (
                  <>
                    <p><span className="font-semibold text-cyan-400">Estágio:</span> {item.stage}</p>
                    <p><span className="font-semibold text-cyan-400">Impacto:</span> {item.impact}</p>
                    <p><span className="font-semibold text-cyan-400">Resultado:</span> {item.result}</p>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.li>
  );
});

// --- Componente Principal ---

export const CognitiveMonitor = ({ onClose, isVisible, settings, userId }: CognitiveMonitorProps) => {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [stats, setStats] = useState({ thoughts: 0, actions: 0, lastEvolution: 'N/A' });

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [thoughts, actions] = await Promise.all([
        db.getThoughtLogs(userId, 100),
        db.getCognitiveLogs(userId, 100)
      ]);

      const allLogs: LogItem[] = [
        ...thoughts.map(t => ({ ...t, logType: 'thought' as const })),
        ...actions.map(a => ({ ...a, logType: 'action' as const }))
      ];
      allLogs.sort((a, b) => b.timestamp - a.timestamp);

      setLogs(allLogs);

      const lastEvo = actions.find(a => a.event === 'auto_evolution');
      setStats({
        thoughts: thoughts.length,
        actions: actions.length,
        lastEvolution: lastEvo ? new Date(lastEvo.timestamp).toLocaleDateString('pt-BR') : 'Nenhuma'
      });
    } catch (err) {
      console.error("Failed to load cognitive logs:", err);
      setError("Falha ao acessar as memórias. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Efeito para carregar logs quando visível
  useEffect(() => {
    if (isVisible) {
      loadLogs();
    }
  }, [isVisible, loadLogs]);

  // Efeito para atualizar logs em tempo real
  useEffect(() => {
    const handleNewLog = () => {
      if (isVisible) {
        loadLogs();
      }
    };
    window.addEventListener('nexus-cognitive-log-added', handleNewLog);
    return () => window.removeEventListener('nexus-cognitive-log-added', handleNewLog);
  }, [isVisible, loadLogs]);

  // Efeito para fechar com "Escape"
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isVisible) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isVisible, onClose]);

  // Memoiza a lista de logs filtrados
  const filteredLogs = useMemo(() => {
    const isFullTransparency = settings?.behavior?.permissions?.transparencyMode;

    return logs.filter(log => {
      if (!isFullTransparency && log.logType === 'action') {
        if (!['auto_evolution', 'rollback', 'new_learning', 'knowledge_expansion', 'code_rewrite'].includes(log.event)) {
          return false;
        }
      }
      if (filter === 'all') return true;
      if (filter === 'thought') return log.logType === 'thought';
      if (filter === 'action') return log.logType === 'action';
      if (filter === 'evolution') return log.logType === 'action' && log.event === 'auto_evolution';
      if (filter === 'learning') return log.logType === 'action' && ['new_learning', 'knowledge_expansion'].includes(log.event);
      if (filter === 'rollback') return log.logType === 'action' && log.event === 'rollback';
      return false;
    });
  }, [logs, filter, settings]);

  const handleToggle = useCallback((id: string) => {
    setExpandedId(prevId => (prevId === id ? null : id));
  }, []);

  const renderContent = () => {
    if (isLoading) {
      return <div className="flex items-center justify-center h-full text-gray-400">Acessando memórias...</div>;
    }
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-red-400 text-center">
          <IconError />
          <p className="font-semibold mt-4">Erro ao Carregar</p>
          <p className="text-sm">{error}</p>
        </div>
      );
    }
    if (filteredLogs.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 text-center">
          <IconEmptyLogs />
          <p className="font-semibold">Nenhum log encontrado</p>
          <p className="text-sm">Os pensamentos e ações do Nexus aparecerão aqui.</p>
        </div>
      );
    }
    return (
      <div className="relative">
        <div className="absolute left-[6px] top-0 h-full w-0.5 bg-gray-700/50"></div>
        <motion.ul variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }} initial="hidden" animate="visible">
          {filteredLogs.map(log => (
            <TimelineItem
              key={`${log.logType}-${log.id}`}
              item={log}
              isExpanded={expandedId === `${log.logType}-${log.id}`}
              onToggle={() => handleToggle(`${log.logType}-${log.id}`)}
            />
          ))}
        </motion.ul>
      </div>
    );
  };

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
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="bg-gray-800/95 shadow-2xl w-full max-w-sm h-full flex flex-col"
            onClick={e => e.stopPropagation()}
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cognitive-monitor-title"
          >
            <header className="flex-shrink-0 p-4 border-b border-gray-700/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <IconCognitive />
                <h2 id="cognitive-monitor-title" className="text-xl font-bold text-white">Monitor Cognitivo</h2>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Fechar monitor cognitivo">
                <IconClose />
              </button>
            </header>

            <div className="flex-shrink-0 p-3 border-b border-gray-700/80 grid grid-cols-3 gap-2 text-center">
              <div><p className="text-lg font-bold text-white">{stats.thoughts}</p><p className="text-xs text-gray-400">Pensamentos</p></div>
              <div><p className="text-lg font-bold text-white">{stats.actions}</p><p className="text-xs text-gray-400">Ações</p></div>
              <div><p className="text-lg font-bold text-white">{stats.lastEvolution}</p><p className="text-xs text-gray-400">Última Evolução</p></div>
            </div>

            <nav className="flex-shrink-0 p-2 border-b border-gray-700/80">
              <div className="flex items-center justify-center gap-2">
                {filters.map(f => (
                  <button key={f.key} onClick={() => setFilter(f.key)} title={f.title} className={`px-4 py-1.5 text-sm font-medium rounded-full ${filter === f.key ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </nav>

            <main className="flex-grow p-4 overflow-y-auto">
              {renderContent()}
              {!settings?.behavior?.permissions?.transparencyMode && (
                <div className="mt-4 p-3 bg-gray-700/50 border border-yellow-500/30 rounded-lg text-center text-xs text-yellow-300">
                  O modo de Transparência Cognitiva está desativado. Apenas eventos importantes estão sendo exibidos.
                </div>
              )}
            </main>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// --- Componentes de Ícones ---

const IconCognitive = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a4 4 0 00-4-4H3V9h2a4 4 0 004-4V3l4 4-4 4zm6 0v-2a4 4 0 014-4h2V9h-2a4 4 0 01-4-4V3l-4 4 4 4z" /></svg>;
const IconClose = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
const IconEmptyLogs = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" /></svg>;
const IconError = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>;
const IconThought = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>;
const IconEvolution = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>;
const IconRollback = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const IconLearning = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 14l9-5-9-5-9 5 9 5z" /><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /><path d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>;
const IconAction = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0 3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>;