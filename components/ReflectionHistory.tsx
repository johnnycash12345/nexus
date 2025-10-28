
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { db } from '../services/indexedDBService';
import { Thought, CognitiveLog, AppSettings } from '../types';

interface CognitiveMonitorProps {
  onClose: () => void;
  isVisible: boolean;
  settings: AppSettings | null;
}

type LogItem = (Thought & { logType: 'thought' }) | (CognitiveLog & { logType: 'action' });
type FilterType = 'all' | 'thought' | 'action' | 'evolution' | 'learning' | 'rollback';

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const panelVariants = {
  hidden: { x: "-100%" },
  visible: { 
    x: "0%",
    transition: { type: 'spring', stiffness: 120, damping: 20 }
  },
};

const listVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 100 }
  },
};

const LogIcon: React.FC<{ item: LogItem }> = ({ item }) => {
    let iconSvg, colorClass;

    if (item.logType === 'thought') {
        iconSvg = <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>;
        colorClass = 'text-blue-400';
    } else { // action
        switch (item.event) {
            case 'auto_evolution':
                iconSvg = <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>;
                colorClass = 'text-green-400';
                break;
            case 'rollback':
                iconSvg = <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
                colorClass = 'text-red-400';
                break;
            case 'new_learning':
            case 'knowledge_expansion':
                iconSvg = <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 14l9-5-9-5-9 5 9 5z" /><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>;
                colorClass = 'text-yellow-400';
                break;
            default:
                iconSvg = <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>;
                colorClass = 'text-gray-400';
                break;
        }
    }
    return <div className={colorClass}>{iconSvg}</div>;
};

const LogCard: React.FC<{ item: LogItem }> = ({ item }) => {
    const title = item.logType === 'thought' ? `[${item.category}]` : `[${item.event}]`;
    const content = item.logType === 'thought' ? item.summary : item.description;

    return (
        <motion.li variants={itemVariants} className="bg-gray-700/50 p-3 rounded-lg">
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1"><LogIcon item={item} /></div>
                <div>
                    <div className="flex items-baseline justify-between flex-wrap">
                        <h4 className="font-semibold text-white capitalize">{title.replace(/_/g, ' ')}</h4>
                        <span className="text-xs text-gray-500 ml-4 flex-shrink-0">{new Date(item.timestamp).toLocaleString('pt-BR')}</span>
                    </div>
                    <p className="text-sm text-gray-300 mt-1">{content}</p>
                </div>
            </div>
        </motion.li>
    );
};


export const ReflectionHistory: React.FC<CognitiveMonitorProps> = ({ onClose, isVisible, settings }) => {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isVisible) {
      setIsLoading(true);
      Promise.all([
        db.getThoughtLogs(100),
        db.getCognitiveLogs(100)
      ]).then(([thoughts, actions]) => {
        const allLogs: LogItem[] = [
            ...thoughts.map(t => ({ ...t, logType: 'thought' as const })),
            ...actions.map(a => ({ ...a, logType: 'action' as const }))
        ];
        allLogs.sort((a, b) => b.timestamp - a.timestamp);
        setLogs(allLogs);
        setIsLoading(false);
      });
    }
  }, [isVisible]);

  const filteredLogs = logs.filter(log => {
    const isFullTransparency = settings?.behavior?.permissions?.transparencyMode;
    if (!isFullTransparency) {
        if (log.logType === 'action' && !['auto_evolution', 'rollback', 'new_learning', 'knowledge_expansion'].includes(log.event)) {
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

  const filters: { key: FilterType, label: string }[] = [
      { key: 'all', label: 'Todos' },
      { key: 'thought', label: '🧠 Pensamentos' },
      { key: 'action', label: '⚙️ Ações' },
      { key: 'evolution', label: '🟢 Evoluções' },
      { key: 'learning', label: '💡 Aprendizados' },
      { key: 'rollback', label: '🔴 Rollbacks' }
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
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a4 4 0 00-4-4H3V9h2a4 4 0 004-4V3l4 4-4 4zm6 0v-2a4 4 0 014-4h2V9h-2a4 4 0 01-4-4V3l-4 4 4 4z" /></svg>
            <h2 className="text-xl font-bold text-white">Monitor Cognitivo</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </header>
        
        <nav className="flex-shrink-0 p-2 border-b border-gray-700/80">
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {filters.map(f => (
                    <button key={f.key} onClick={() => setFilter(f.key)} className={`px-3 py-1 text-sm font-medium rounded-full whitespace-nowrap ${filter === f.key ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                        {f.label}
                    </button>
                ))}
            </div>
        </nav>

        <main className="flex-grow p-4 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-400">Acessando memórias...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" /></svg>
              <p className="font-semibold">Nenhum log encontrado</p>
              <p className="text-sm">Os pensamentos e ações do Nexus aparecerão aqui.</p>
            </div>
          ) : (
            <motion.ul className="space-y-3" variants={listVariants} initial="hidden" animate="visible">
              {filteredLogs.map(log => <LogCard key={`${log.logType}-${log.id}`} item={log} />)}
            </motion.ul>
          )}
        </main>
      </motion.div>
    </motion.div>
  );
};
