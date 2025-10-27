import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/indexedDBService';
import { Task } from '../types';

interface TodoListProps {
  onClose: () => void;
  isVisible: boolean;
}

export const TodoList: React.FC<TodoListProps> = ({ onClose, isVisible }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isVisible) {
      loadTasks();
      // Focus input when panel opens
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isVisible]);

  const loadTasks = async () => {
    const allTasks = await db.getAllTasks();
    // Sort tasks: incomplete first, then by creation date
    allTasks.sort((a, b) => {
        if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
        }
        return b.createdAt - a.createdAt;
    });
    setTasks(allTasks);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newTaskText.trim();
    if (text) {
      await db.addTask({ text });
      setNewTaskText('');
      loadTasks();
    }
  };

  const handleToggleTask = async (task: Task) => {
    if (task.id) {
        await db.updateTask({ ...task, completed: !task.completed });
        loadTasks();
    }
  };

  const handleDeleteTask = async (id: number | undefined) => {
    if (id) {
      await db.deleteTask(id);
      loadTasks();
    }
  };

  return (
    <div className={`fixed inset-0 bg-black/60 z-30 flex justify-start backdrop-blur-sm transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose}>
       <style>{`
          .task-checkbox-svg path {
              stroke-dasharray: 24;
              stroke-dashoffset: 24;
              transition: stroke-dashoffset 0.3s cubic-bezier(0.45, 0, 0.55, 1);
          }
          .task-completed .task-checkbox-svg path {
              stroke-dashoffset: 0;
          }
          .task-text {
              transition: color 0.3s ease, text-decoration-color 0.3s ease;
              text-decoration: line-through;
              text-decoration-color: transparent;
          }
          .task-completed .task-text {
              color: #6b7280; /* text-gray-500 */
              text-decoration-color: #9ca3af; /* text-gray-400 */
          }
          @keyframes fade-in-slide-up {
              from { opacity: 0; transform: translateY(5px); }
              to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in-slide-up {
              animation: fade-in-slide-up 0.3s ease-out forwards;
          }
      `}</style>
      <div 
        className={`bg-gray-800/90 shadow-2xl w-full max-w-sm h-full flex flex-col transition-transform duration-300 ease-in-out ${isVisible ? 'translate-x-0' : '-translate-x-full'}`} 
        onClick={e => e.stopPropagation()}
      >
        <header className="flex-shrink-0 p-4 border-b border-gray-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <h2 className="text-xl font-bold text-white">Tarefas Pendentes</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </header>

        <main className="flex-grow p-4 overflow-y-auto">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              <p className="font-semibold">Tudo em ordem!</p>
              <p className="text-sm">Adicione uma tarefa abaixo para começar.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {tasks.map(task => (
                <li key={task.id} className={`group flex items-center bg-gray-700/50 p-3 rounded-lg transition-colors duration-200 animate-fade-in-slide-up ${task.completed ? 'task-completed' : ''}`}>
                  <button onClick={() => handleToggleTask(task)} className={`flex-shrink-0 h-6 w-6 rounded-full border-2 flex items-center justify-center mr-3 cursor-pointer group-hover:border-cyan-400 transition-colors ${task.completed ? 'border-cyan-500 bg-cyan-500/30' : 'border-gray-500'}`}>
                    <svg className="task-checkbox-svg h-4 w-4 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <span className="flex-grow text-gray-200 task-text">
                    {task.text}
                  </span>
                  <button onClick={() => handleDeleteTask(task.id)} className="flex-shrink-0 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </main>
        
        <footer className="flex-shrink-0 p-3 border-t border-gray-700/80">
            <form onSubmit={handleAddTask} className="flex items-center gap-2">
                <input
                    ref={inputRef}
                    type="text"
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    placeholder="Adicionar nova tarefa..."
                    className="flex-grow bg-gray-700 rounded-full px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button
                    type="submit"
                    aria-label="Adicionar tarefa"
                    className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-cyan-600 hover:bg-cyan-500 transition-colors disabled:bg-gray-600"
                    disabled={!newTaskText.trim()}
                >
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110 2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                </button>
            </form>
        </footer>
      </div>
    </div>
  );
};
