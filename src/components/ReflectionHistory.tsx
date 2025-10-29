import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { db } from '@/services/indexedDBService';
import { Thought, CognitiveLog, AppSettings } from '@/types';

// FIX: Removed modal-related props (onClose, isVisible) as component is now tab content.
interface CognitiveMonitorProps {
  settings: AppSettings | null;
  userId: string;
}

type LogItem = (Thought & { logType: 'thought' }) | (CognitiveLog & { logType: 'action' });

const itemVariants: Variants = { 
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
};

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number; colorClass: string }> = ({ icon, label, value, colorClass }) => (
    <div className="bg-gray-700/50 p-3 rounded-lg flex items-center gap-3">
        <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${colorClass}`}>
            {icon}
        </div>
        <div>
            <p className="text-sm text-gray-400">{label}</p>
            <p className="text-xl font-bold text-white">{value}</p>
        </div>
    </div>
);

const ActivityChart: React.FC<{ data: { day: string; count: number }[] }> = ({ data }) => {
    const maxCount = Math.max(...data.map(d => d.count), 1);
    return (
        <div className="bg-gray-700/50 p-4 rounded-lg">
            <h3 className="text-base font-semibold text-cyan-300 mb-3">Atividade Cognitiva (7 dias)</h3>
            <div className="flex justify-between items-end h-32 text-center">
                {data.map((item, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center justify-end group px-1">
                        <AnimatePresence>
                            <motion.div initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} className="text-xs text-white mb-1 opacity-0 group-hover:opacity-100 transition-opacity">{item.count}</motion.div>
                        </AnimatePresence>
                        <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${(item.count / maxCount) * 100}%` }}
                            transition={{ type: 'spring', stiffness: 100, damping: 15, delay: index * 0.05 }}
                            className="w-full max-w-[20px] bg-cyan-500 rounded-t-sm hover:bg-cyan-400"
                        />
                        <p className="text-xs text-gray-400 mt-2">{item.day}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

const getLogItemStyle = (item: LogItem) => {
    let iconSvg, colorClass, borderColorClass, title;

    if (item.logType === 'thought') {
        iconSvg = <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>;
        colorClass = 'text-blue-400';
        borderColorClass = 'border-blue-500/50';
        title = `Pensamento: ${item.category}`;
    } else {
        switch (item.event) {
            case 'auto_evolution':
                iconSvg = <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>;
                colorClass = 'text-green-400';
                borderColorClass = 'border-green-500/50';
                title = 'Auto-Evolução';
                break;
            case 'rollback':
                iconSvg = <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
                colorClass = 'text-red-400';
                borderColorClass = 'border-red-500/50';
                title = 'Rollback do Sistema';
                break;
            default:
                iconSvg = <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 14l9-5-9-5-9 5 9 5z" /><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>;
                colorClass = 'text-yellow-400';
                borderColorClass = 'border-yellow-500/50';
                title = 'Aprendizado';
        }
    }
    return { iconSvg, colorClass, borderColorClass, title };
};

const TimelineItem: React.FC<{ item: LogItem, isExpanded: boolean, onToggle: () => void }> = ({ item, isExpanded, onToggle }) => {
    const { iconSvg, colorClass, borderColorClass, title } = getLogItemStyle(item);
    const content = item.logType === 'thought' ? item.summary : item.description;

    return (
        <motion.li 
            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
            className="pl-8 relative pb-2"
        >
            <div className={`absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full flex items-center justify-center ${borderColorClass.replace('border-', 'bg-').replace('/50', '/30')}`}>
                <div className={`w-2 h-2 rounded-full ${borderColorClass.replace('border-', 'bg-').replace('/50', '')}`} />
            </div>
            <div onClick={onToggle} className={`p-3 rounded-lg cursor-pointer transition-all duration-300 bg-gray-700/50 hover:bg-gray-700/80 border-l-2 ${borderColorClass}`}>
                <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 mt-0.5 ${colorClass}`}>{iconSvg}</div>
                    <div>
                        <div className="flex items-baseline justify-between flex-wrap">
                            <h4 className="font-semibold text-white capitalize">{title.replace(/_/g, ' ')}</h4>
                            <span className="text-xs text-gray-500 ml-4 flex-shrink-0">{new Date(item.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
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
};


export const ReflectionHistory: React.FC<CognitiveMonitorProps> = ({ settings, userId }) => {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [stats, setStats] = useState({ thoughts: 0, actions: 0, lastEvolution: 'N/A', cognitiveLoad: '0%' });
  const [chartData, setChartData] = useState<{ day: string; count: number }[]>([]);

  const loadLogs = useCallback(async () => {
      setIsLoading(true);
      const [thoughts, actions] = await Promise.all([db.getThoughtLogs(userId, 100), db.getCognitiveLogs(userId, 100)]);
      
      const allLogs: LogItem[] = [
          ...thoughts.map(t => ({ ...t, logType: 'thought' as const })),
          ...actions.map(a => ({ ...a, logType: 'action' as const }))
      ];
      allLogs.sort((a, b) => b.timestamp - a.timestamp);
      
      setLogs(allLogs);
      
      const lastEvo = actions.find(a => a.event === 'auto_evolution');
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      const logsInLast24h = allLogs.filter(log => now - log.timestamp < oneDay).length;
      const cognitiveLoad = Math.min(100, Math.round((logsInLast24h / 25) * 100));
      
      setStats({
          thoughts: thoughts.length,
          actions: actions.length,
          lastEvolution: lastEvo ? new Date(lastEvo.timestamp).toLocaleDateString('pt-BR') : 'Nenhuma',
          cognitiveLoad: `${cognitiveLoad}%`
      });
      
      const activityByDay: { [key: string]: number } = {};
      const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      for (let i = 6; i >= 0; i--) {
          const d = new Date(now - i * oneDay);
          const key = d.toISOString().split('T')[0];
          activityByDay[key] = 0;
      }
      allLogs.forEach(log => {
          const key = new Date(log.timestamp).toISOString().split('T')[0];
          if (key in activityByDay) activityByDay[key]++;
      });
      setChartData(Object.keys(activityByDay).map(key => ({
          day: days[new Date(key+'T12:00:00Z').getUTCDay()],
          count: activityByDay[key]
      })));

      setIsLoading(false);
  }, [userId]);
  
  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 30000); // Auto-refresh every 30s
    
    const handleNewLog = () => {
        loadLogs();
    };
    window.addEventListener('nexus-cognitive-log-added', handleNewLog);
    
    return () => {
        clearInterval(interval);
        window.removeEventListener('nexus-cognitive-log-added', handleNewLog);
    };
  }, [loadLogs]);
  
  const logsByDay = logs.reduce((acc, log) => {
    const dateKey = new Date(log.timestamp).toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(log);
    return acc;
  }, {} as Record<string, LogItem[]>);


  const handleToggle = (id: string) => {
    setExpandedId(prevId => (prevId === id ? null : id));
  };

  return (
    <>
      {isLoading ? (
        <div className="flex items-center justify-center h-full text-gray-400">Acessando memórias...</div>
      ) : (
        <div className="space-y-6">
            <motion.section initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.1 } } }}>
                <div className="grid grid-cols-2 gap-3">
                    <motion.div variants={itemVariants}><StatCard icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 6.75h7.5M8.25 12h7.5m-7.5 5.25h7.5m-11.25-2.25L4.5 13.5m0 0l-1.5-1.5M4.5 13.5V15m15-1.5L19.5 13.5m0 0l-1.5-1.5m1.5 1.5V15M3 12a9 9 0 1118 0 9 9 0 01-18 0z" /></svg>} label="Pensamentos" value={stats.thoughts} colorClass="bg-blue-500/30 text-blue-300" /></motion.div>
                    <motion.div variants={itemVariants}><StatCard icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0 3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>} label="Ações" value={stats.actions} colorClass="bg-yellow-500/30 text-yellow-300" /></motion.div>
                    <motion.div variants={itemVariants} className="col-span-2"><StatCard icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>} label="Carga Cognitiva (24h)" value={stats.cognitiveLoad} colorClass="bg-purple-500/30 text-purple-300" /></motion.div>
                </div>
            </motion.section>

            <motion.section initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay: 0.2}}>
                <ActivityChart data={chartData} />
            </motion.section>

            <motion.section initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay: 0.4}}>
                <h3 className="text-lg font-semibold text-cyan-300 mb-3">Linha do Tempo</h3>
                {Object.entries(logsByDay).map(([date, dailyLogs]: [string, LogItem[]]) => (
                    <div key={date} className="relative mt-4">
                        <h4 className="font-bold text-gray-400 mb-2 pl-8 relative"><div className="absolute left-0 top-1/2 w-3 h-0.5 bg-gray-600"></div>{date}</h4>
                        <div className="absolute left-[6px] top-0 h-full w-0.5 bg-gray-700/50"></div>
                        <motion.ul variants={{ visible: { transition: { staggerChildren: 0.05 } } }}>
                            {dailyLogs.map(log => (
                                <TimelineItem 
                                    key={`${log.logType}-${log.id}`} 
                                    item={log}
                                    isExpanded={expandedId === `${log.logType}-${log.id}`}
                                    onToggle={() => handleToggle(`${log.logType}-${log.id}`)}
                                />
                            ))}
                        </motion.ul>
                    </div>
                ))}
            </motion.section>
        </div>
      )}
    </>
  );
};
