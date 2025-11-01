import React, { useState, useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { Avatar } from './Avatar';
import { AssistantStatus, Emotion } from '../types';

interface AvatarLayerProps {
  isChatOpen: boolean;
  appearance: 'neutral' | 'feminine' | 'masculine';
  status: AssistantStatus;
  intensity: number;
  emotion: Emotion;
  thought: { text: string; type: 'symbolic_log' | 'error' } | null;
  // FIX: Add optional className prop
  className?: string;
}

// ----------------------------------------------------------------------
// APRIMORAMENTO: Definições de Cores e Temas
// ----------------------------------------------------------------------

// Cores baseadas na Emoção (para o brilho de fundo)
const emotionColors: Record<Emotion, string> = {
  'JOYFUL': "rgba(250, 204, 21, 0.4)", // Amarelo
  'CALM': "rgba(96, 165, 250, 0.3)", // Azul
  'CURIOUS': "rgba(34, 211, 238, 0.4)", // Ciano
  'UNCERTAIN': "rgba(129, 140, 248, 0.4)", // Indigo
  'AFRAID': "rgba(239, 68, 68, 0.4)", // Vermelho
  'FOCUSED': "rgba(167, 139, 250, 0.3)", // Roxo
};

// Cores baseadas no Status Cognitivo (sobrepõe a emoção)
const cognitiveStateColors: Partial<Record<AssistantStatus, string>> = {
  'REWRITING_CODE': emotionColors['FOCUSED'],
  'SELF_ANALYSIS': emotionColors['FOCUSED'],
  'SEARCHING_WEB': emotionColors['CURIOUS'],
  // FIX: Corrected typo from 'THINK' to 'THINKING'.
  'THINKING': emotionColors['CURIOUS'],
  'ROLLBACK': emotionColors['AFRAID'],
};

// APRIMORAMENTO: Tema de Aparência (para o "Aro")
const appearanceTheme: Record<AvatarLayerProps['appearance'], { halo: string }> = {
  neutral: { halo: "border-cyan-400/80 shadow-[0_0_25px_rgba(34,211,238,0.5)]" },
  feminine: { halo: "border-pink-400/80 shadow-[0_0_25px_rgba(244,114,182,0.5)]" },
  masculine: { halo: "border-blue-400/80 shadow-[0_0_25px_rgba(96,165,250,0.5)]" },
};

// ----------------------------------------------------------------------
// APRIMORAMENTO: Componentes de Efeito (Movidos para fora)
// ----------------------------------------------------------------------

const MatrixBackground: React.FC = memo(() => {
  // APRIMORAMENTO: Usando useRef para acesso seguro ao canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let drops: number[] = [];
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const fontSize = 14;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const columns = canvas.width / fontSize;
      drops = Array(Math.floor(columns)).fill(1);
    };
    
    resizeCanvas();

    const draw = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#0F0"; // Cor verde clássica da matriz
      ctx.font = `${fontSize}px monospace`;
      
      for (let i = 0; i < drops.length; i++) {
        const text = letters.charAt(Math.floor(Math.random() * letters.length));
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
      animationFrameId = requestAnimationFrame(draw);
    };
    
    draw();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []); // Dependência vazia, roda apenas uma vez

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 overflow-hidden bg-black z-0"
    >
      <canvas ref={canvasRef} className="w-full h-full opacity-70" />
    </motion.div>
  );
});

const ThinkingEffect: React.FC = memo(() => (
  <motion.div
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.8 }}
  >
    <motion.div
      animate={{ scale: [1, 1.03, 1], opacity: [1, 0.9, 1] }}
      transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
      className="absolute w-72 h-72 rounded-full bg-gradient-radial from-yellow-500/15 to-transparent blur-3xl"
    />
    {/* Usando classes CSS que definimos em Avatar.css */}
    <div className="absolute animate-spin-slow w-20 h-20 border-2 border-yellow-400/30 rounded-full blur-sm" /> 
  </motion.div>
));

const SelfAnalysisEffect: React.FC<{ color: string }> = memo(({ color }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.8 }}
    className="absolute flex items-center justify-center"
  >
    {/* APRIMORAMENTO: Usando cor dinâmica do tema */}
    <div className="absolute w-40 h-40 border-2 rounded-full animate-scan-glow" style={{ borderColor: color }} /> 
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" 
         className="w-12 h-12 animate-float-slow" 
         style={{ filter: `drop-shadow(0 0 10px ${color})` }}
    >
      <circle cx="45" cy="45" r="30" stroke={color} strokeWidth="6"/>
      <line x1="65" y1="65" x2="85" y2="85" stroke={color} strokeWidth="8" strokeLinecap="round"/>
    </svg>
  </motion.div>
));

const RollbackEffect: React.FC = memo(() => (
  <motion.div
    initial={{ opacity: 0, scale: 1.2 }}
    animate={{ opacity: 1, scale: 1, rotate: [0, -180, -360] }}
    exit={{ opacity: 0, scale: 1.2 }}
    transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
    className="absolute w-64 h-64 border-4 border-purple-400/80 rounded-full border-dashed"
  />
));

const SearchEffect: React.FC<{ color: string }> = memo(({ color }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ scale: [0.9, 1.1, 0.9], opacity: [0.6, 1, 0.6] }}
    exit={{ opacity: 0, scale: 0.9 }}
    transition={{ repeat: Infinity, duration: 2 }}
    className="absolute w-[300px] h-[300px] rounded-full border-2"
    style={{ borderColor: `${color}40` }} // Cor com opacidade 40
  >
    {/* FIX: Cast style object to React.CSSProperties to allow CSS custom properties */}
    <div className="absolute inset-0 rounded-full bg-gradient-radial to-transparent blur-2xl" 
         style={{ '--tw-gradient-from': `${color}1A` } as React.CSSProperties} // Cor com opacidade 10
    />
  </motion.div>
));

// ----------------------------------------------------------------------
// Componente Principal
// ----------------------------------------------------------------------

export const AvatarLayer: React.FC<AvatarLayerProps> = ({ isChatOpen, appearance, status, intensity, emotion, thought }) => {
  
  // Define o tema (para o aro) e o brilho (para o fundo)
  const theme = appearanceTheme[appearance] || appearanceTheme.neutral;
  const haloColor = cognitiveStateColors[status] || emotionColors[emotion] || emotionColors.CALM;

  // APRIMORAMENTO: Lógica de animação do Aro simplificada
  const getHaloAnimationClass = (s: AssistantStatus): string => {
    switch (s) {
      case 'LISTENING':
      case 'THINKING':
      case 'CURIOUS':
        return "animate-pulse-slow"; // (Defina 'animate-pulse-slow' em Avatar.css)
      case 'SPEAKING':
        return "animate-pulse"; // Pulso rápido padrão do Tailwind
      case 'IDLE':
        return "animate-pulse-very-slow"; // (Defina 'animate-pulse-very-slow' em Avatar.css)
      default:
        return ""; // Sem pulso para ERROR, SUCCESS, etc.
    }
  };
  const haloAnimationClass = getHaloAnimationClass(status);
  
  // Variantes de movimento do Avatar (para cima/baixo)
  const avatarVariants: Variants = {
    open: {
      scale: 1.0,
      y: -20,
      transition: { type: 'spring', stiffness: 80, damping: 10 },
    },
    closed: {
      scale: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 80, damping: 10 },
    },
  };

  return (
    <>
      {/* 1. Efeito de Fundo (Ex: Matriz) */}
      <AnimatePresence>
        {status === 'REWRITING_CODE' && <MatrixBackground />}
      </AnimatePresence>
      
      {/* 2. Brilho de Emoção/Estado (Radial) */}
      <motion.div 
        className="absolute w-96 h-96 bg-gradient-radial rounded-full blur-3xl pointer-events-none to-transparent" 
        animate={{ '--tw-gradient-from': haloColor } as any}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      />
      
      {/* 3. Efeitos Cognitivos (Atrás do Avatar) */}
      <div className="absolute z-0 pointer-events-none flex items-center justify-center">
        <AnimatePresence>
          {status === 'THINKING' && <ThinkingEffect />}
          {status === 'SELF_ANALYSIS' && <SelfAnalysisEffect color={appearanceTheme[appearance].halo.split(' ')[0]} />}
          {status === 'SEARCHING_WEB' && <SearchEffect color={appearanceTheme[appearance].halo.split(' ')[0]} />}
          {status === 'ROLLBACK' && <RollbackEffect />}
        </AnimatePresence>
      </div>

      {/* 4. Avatar e "Bocadillo" de Pensamento */}
      <motion.div
        className="absolute z-10 flex flex-col items-center justify-center pointer-events-auto"
        initial="closed"
        animate={isChatOpen ? 'open' : 'closed'}
        variants={avatarVariants}
      >
        {/* "Bocadillo" de Pensamento */}
        <AnimatePresence>
          {thought && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 150, damping: 20 }}
              className={`absolute bottom-full mb-4 max-w-xs px-3 py-2 text-sm font-mono rounded-lg shadow-lg
                ${thought.type === 'error' 
                  ? 'bg-red-800/80 text-red-200 border border-red-500/50' 
                  : 'bg-gray-800/80 text-cyan-300 border border-gray-600/50'}
              `}
            >
              {thought.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* O Avatar e seu "Aro" (Halo) */}
        <div className="relative flex items-center justify-center">
          {/* APRIMORAMENTO: O Aro agora usa o 'theme.halo' e 'haloAnimationClass' dinâmicos */}
          <motion.div
            className={`absolute w-[110%] h-[110%] rounded-full border-2 ${theme.halo} ${haloAnimationClass}`}
          />
          
          <Avatar appearance={appearance} status={status} intensity={intensity} />
        </div>
      </motion.div>
    </>
  );
};
