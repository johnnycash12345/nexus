import React, { memo, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Avatar } from './Avatar';

// --- Props ---

interface StartScreenProps {
  onStart: () => void;
  onOpenSettings: () => void;
  token: string | null;
  syncStatus: string;
  onLogin: () => void;
}

// --- Componentes de Ícone Internos ---

const IconGoogle = () => (
  <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C44.577,34.337,48,28,48,20c0-2.659-0.138-3.95-0.389-5.238L43.611,20.083z"></path>
  </svg>
);

const Spinner = () => (
  <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin mr-2"></div>
);

// --- Componente Principal (Memoizado) ---

export const StartScreen = memo(({ onStart, onOpenSettings, token, syncStatus, onLogin }: StartScreenProps) => {

  const handleDownload = useCallback(() => {
    alert('O download para Android estará disponível em breve!');
  }, []); // Vazio, pois não depende de props ou state

  const { isSyncing, isAuthCheck, startButtonDisabled } = useMemo(() => {
    const isSyncing = token && syncStatus.includes('Sincronizando');
    const isAuthCheck = !token && syncStatus.includes('Verificando');
    const startButtonDisabled = isSyncing || isAuthCheck;
    return { isSyncing, isAuthCheck, startButtonDisabled };
  }, [token, syncStatus]); // Recalcula apenas se o token ou syncStatus mudarem

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className="h-screen w-screen flex flex-col items-center justify-center text-center p-4"
    >
      <div className="mb-8">
        <Avatar status={'SLEEPY'} className="w-48 h-48" appearance="neutral" />
      </div>
      <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">Nexus</h1>
      <p className="text-lg text-gray-400 mb-10">Seu assistente pessoal inteligente.</p>

      <div className="flex flex-col gap-4 w-full max-w-sm">
        {!token ? (
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={onLogin}
            className="w-full px-6 py-3 bg-cyan-600 text-white font-semibold rounded-lg shadow-lg hover:bg-cyan-500 transition-colors flex items-center justify-center gap-2"
          >
            <IconGoogle />
            Login com Google
          </motion.button>
        ) : (
          <div className="text-lg text-cyan-300 transition-opacity duration-300 h-8 flex items-center justify-center">
            {isSyncing && <Spinner />}
            <p>{syncStatus}</p>
          </div>
        )}

        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={onStart}
          disabled={startButtonDisabled}
          className="w-full px-6 py-3 bg-gray-700 text-white font-semibold rounded-lg shadow-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {token ? 'Despertar Nexus' : 'Iniciar Offline'}
        </motion.button>

        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={onOpenSettings}
          className="w-full px-6 py-3 bg-transparent border-2 border-gray-600 text-gray-300 font-semibold rounded-lg hover:bg-gray-800 hover:text-white transition-colors"
        >
          Configurações
        </motion.button>
      </div>

      <div className="mt-8">
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={handleDownload}
          className="px-6 py-2 bg-gray-800/50 text-gray-300 font-semibold rounded-lg shadow-lg hover:bg-gray-700 transition-colors"
        >
          Baixar para Android
        </motion.button>
      </div>
    </motion.div>
  );
});