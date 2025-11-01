import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { db } from '../services/indexedDBService';
import { Task } from '../types';

// --- Props e Tipos ---

interface TodoListProps {
  onClose: () => void;
  isVisible: boolean;
  userId: string;
}

// --- Variantes de Animação ---
const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const panelVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9, y: 50 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: { type: 'spring', stiffness: 120, damping: 15 }
  },
};

const listVariants: Variants = {
  hidden: { transition: { staggerChildren: 0.05, staggerDirection: -1 } },
  visible: { transition: { staggerChildren: 0.07 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
};

const checkVariants: Variants = {
  unchecked: { pathLength: 0 },
  checked: { pathLength: 1 },
};

// --- Função Utilitária de Ordenação ---
const sortTasks = (tasks: Task[]): Task[] => {
  return tasks.sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    return b.createdAt - a.createdAt;
  });
};

// --- Componente Filho: TaskItem (Memoizado) ---

interface TaskItemProps {
  task: Task;
  onToggle: (task: Task) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

const TaskItem = memo(({ task, onToggle, onDelete }: TaskItemProps) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const handleToggle = async () => {
    setIsUpdating(true);
    await onToggle(task);
    if (isMountedRef.current) setIsUpdating(false);
  };

  const handleDelete = async () => {
    setIsUpdating(true);
    await onDelete(task.id!);
    if (isMountedRef.current) setIsUpdating(false);
  };

  return (
    <motion.li
      key={task.id}
      variants={itemVariants}
      layout
      className={`group flex items-center bg-gray-700/50 p-3 rounded-lg transition-colors duration-200`}
    >
      <button
        onClick={handleToggle}
        disabled={isUpdating}
        aria-label={task.completed ? "Marcar como pendente" : "Marcar como concluída"}
        className={`flex-shrink-0 h-6 w-6 rounded-full border-2 flex items-center justify-center mr-3 cursor-pointer group-hover:border-cyan-400 transition-all ${task.completed ? 'border-cyan-500 bg-cyan-500/30' : 'border-gray-500'}`}
      >
        <svg className="h-4 w-4 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <motion.path
            variants={checkVariants}
            animate={task.completed ? "checked" : "unchecked"}
            transition={{ duration: 0.2 }}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </button>
      <span className={`flex-grow task-text transition-colors duration-300 ${task.completed ? 'text-gray-500 line-through decoration-gray-400' : 'text-gray-200'}`}>
        {task.text}
      </span>
      <button
        onClick={handleDelete}
        disabled={isUpdating}
        aria-label="Excluir tarefa"
        className="flex-shrink-0 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
      >
        <IconDelete />
      </button>
    </motion.li>
  );
});

// --- Componente Principal ---

export const TodoList = ({ onClose, isVisible, userId }: TodoListProps) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const isMountedRef = useRef(false);

  // Carregamento inicial
  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const allTasks = await db.getAllTasks(userId);
      if (isMountedRef.current) setTasks(sortTasks(allTasks));
    } catch (error) {
      console.error("Failed to load tasks:", error);
      if (isMountedRef.current) alert("Erro ao carregar tarefas.");
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isVisible) {
      isMountedRef.current = true;
      loadTasks();
      setTimeout(() => inputRef.current?.focus(), 300);
    }
    return () => { isMountedRef.current = false; };
  }, [isVisible, loadTasks]);

  // Fechar com "Escape"
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    if (isVisible) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isVisible, onClose]);

  // Ações CRUD

  const handleAddTask = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newTaskText.trim();
    if (!text) return;

    setIsSubmitting(true);
    try {
      const newTaskWithId = await db.addTask(userId, { text });
      if (isMountedRef.current) {
        setTasks(prevTasks => sortTasks([newTaskWithId, ...prevTasks]));
        setNewTaskText('');
      }
    } catch (error) {
      console.error("Failed to add task:", error);
      if (isMountedRef.current) alert("Erro ao adicionar tarefa.");
    } finally {
      if (isMountedRef.current) setIsSubmitting(false);
    }
  }, [newTaskText, userId]);

  const handleToggleTask = useCallback(async (task: Task) => {
    if (!task.id) return;
    const updatedTask = { ...task, completed: !task.completed };
    try {
      await db.updateTask(userId, updatedTask);
      if (isMountedRef.current) {
        setTasks(prevTasks => sortTasks(prevTasks.map(t => t.id === task.id ? updatedTask : t)));
      }
    } catch (error) {
      console.error("Failed to toggle task:", error);
      if (isMountedRef.current) alert("Erro ao atualizar tarefa.");
    }
  }, [userId]);

  const handleDeleteTask = useCallback(async (id: number | undefined) => {
    if (!id) return;
    try {
      await db.deleteTask(userId, id);
      if (isMountedRef.current) {
        setTasks(prevTasks => prevTasks.filter(t => t.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete task:", error);
      if (isMountedRef.current) alert("Erro ao excluir tarefa.");
    }
  }, [userId]);

  const renderContent = () => {
    if (isLoading) return <div className="flex items-center justify-center h-full text-gray-400">Carregando tarefas...</div>;
    if (tasks.length === 0) return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <IconEmpty />
        <p className="font-semibold">Nenhuma tarefa.</p>
        <p className="text-sm">Adicione uma tarefa abaixo para começar.</p>
      </div>
    );
    return (
      <motion.ul variants={listVariants} initial="hidden" animate="visible" className="space-y-2">
        <AnimatePresence>
          {tasks.map(task => (
            <TaskItem key={task.id} task={task} onToggle={handleToggleTask} onDelete={handleDeleteTask} />
          ))}
        </AnimatePresence>
      </motion.ul>
    );
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 bg-black/60 z-30 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={onClose}
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          <motion.div
            className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-md flex flex-col h-[70vh] max-h-[500px]"
            onClick={e => e.stopPropagation()}
            variants={panelVariants}
          >
            <header className="flex-shrink-0 p-4 border-b border-gray-700/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <IconClipboardList />
                <h2 className="text-xl font-bold text-white">Lista de Tarefas</h2>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-white"><IconClose /></button>
            </header>

            <main className="flex-grow p-4 overflow-y-auto">
              {renderContent()}
            </main>

            <footer className="flex-shrink-0 p-3 border-t border-gray-700/80">
              <form onSubmit={handleAddTask} className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  placeholder="Adicionar nova tarefa..."
                  disabled={isSubmitting}
                  className="flex-grow bg-gray-700 rounded-full px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !newTaskText.trim()}
                  className="w-10 h-10 rounded-full flex-shrink-0 bg-cyan-600 hover:bg-cyan-500 flex items-center justify-center disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  <IconPlus />
                </button>
              </form>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// --- Ícones ---
const IconClipboardList = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>;
const IconClose = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
const IconEmpty = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>;
const IconDelete = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
const IconPlus = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110 2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>;