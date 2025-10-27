

import React, { useState, useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { Avatar } from './Avatar';
import { AssistantStatus, Emotion } from '../types';

interface AvatarLayerProps {
  isChatOpen: boolean;
  appearance: 'neutral' | 'feminine' | 'masculine';
  status: AssistantStatus;
  intensity: number;
  emotion: Emotion;
}

const emotionColors: Record<Emotion, string> = {
  [Emotion.JOYFUL]: "from-yellow-400/40 to-amber-700/10",
  [Emotion.CALM]: "from-blue-400/30 to-cyan-900/10",
  [Emotion.CURIOUS]: "from-cyan-400/40 to-cyan-800/20",
  [Emotion.UNCERTAIN]: "from-indigo-400/40 to-gray-700/10",
  [Emotion.AFRAID]: "from-red-500/40 to-black/20",
  [Emotion.FOCUSED]: "from-purple-400/30 to-indigo-900/10",
};

// --- Cognitive Effect Components ---

const MatrixBackground: React.FC = () => {
    useEffect(() => {
        const canvas = document.getElementById('matrixCanvas') as HTMLCanvasElement;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        
        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resizeCanvas();

        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        const fontSize = 14;
        const columns = canvas.width / fontSize;
        const drops: number[] = Array(Math.floor(columns)).fill(1);

        const draw = () => {
            if (!ctx) return;
            ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "#0F0";
            ctx.font = `${fontSize}px monospace`;
            for (let i = 0; i < drops.length; i++) {
                const text = letters.charAt(Math.floor(Math.random() * letters.length));
                ctx.fillText(text, i * fontSize, drops[i] * fontSize);
                if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
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
    }, []);

    return (
        <div className="fixed inset-0 overflow-hidden bg-black z-0">
            <canvas id="matrixCanvas" className="w-full h-full opacity-70" />
        </div>
    );
};


const ThinkingEffect: React.FC = () => (
    <>
        <motion.div
            animate={{
                scale: [1, 1.03, 1],
                opacity: [1, 0.9, 1],
            }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className="absolute w-72 h-72 rounded-full bg-gradient-radial from-yellow-500/15 to-transparent blur-3xl"
        />
        <div className="absolute animate-spin-slow w-20 h-20 border-2 border-yellow-400/30 rounded-full blur-sm" />
    </>
);

const SelfAnalysisEffect: React.FC = () => (
    <motion.div
        animate={{ scale: [1, 1.02, 1], rotate: [0, 1, -1, 0] }}
        transition={{ repeat: Infinity, duration: 3 }}
        className="absolute flex items-center justify-center"
    >
        <div className="absolute w-40 h-40 border-2 border-blue-400 rounded-full animate-scan-glow" />
         <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 animate-float-slow drop-shadow-[0_0_10px_#60a5fa]">
            <circle cx="45" cy="45" r="30" stroke="#60a5fa" strokeWidth="6"/>
            <line x1="65" y1="65" x2="85" y2="85" stroke="#60a5fa" strokeWidth="8" strokeLinecap="round"/>
        </svg>
    </motion.div>
);

const RollbackEffect: React.FC = () => (
    <motion.div
        animate={{ scale: [1.2, 0.8, 1.2], rotate: [0, -180, -360] }}
        transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
        className="absolute w-64 h-64 border-4 border-purple-400/80 rounded-full border-dashed"
    />
);


const SearchEffect: React.FC = () => (
    <motion.div
        animate={{ scale: [0.9, 1.1, 0.9], opacity: [0.6, 1, 0.6] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="absolute w-[300px] h-[300px] rounded-full border-2 border-blue-400/40"
    >
        <div className="absolute inset-0 rounded-full bg-gradient-radial from-blue-400/10 to-transparent blur-2xl" />
    </motion.div>
);


export const AvatarLayer: React.FC<AvatarLayerProps> = ({ isChatOpen, appearance, status, intensity, emotion }) => {
  const [temporaryMessage, setTemporaryMessage] = useState<string | null>(null);
  const haloControls = useAnimation();

  // Animate halo on speech word boundaries
  useEffect(() => {
    const handleBoundary = () => {
      if (status === AssistantStatus.SPEAKING) {
        haloControls.start({
          scale: [1, 1.2, 1],
          opacity: [0.8, 1, 0.8],
          transition: { duration: 0.3, ease: 'easeInOut' },
        });
      }
    };
    window.addEventListener('nexus-voice-boundary', handleBoundary);
    return () => window.removeEventListener('nexus-voice-boundary', handleBoundary);
  }, [status, haloControls]);

  // Animate halo rotation for thinking/curious/idle status
  useEffect(() => {
    if (status === AssistantStatus.THINKING || status === AssistantStatus.CURIOUS) {
      haloControls.start({
        rotate: 360,
        transition: { duration: 8, ease: 'linear', repeat: Infinity },
      });
    } else if (status === AssistantStatus.IDLE) {
       haloControls.start({
        opacity: [0.8, 1, 0.8],
        scale: 1,
        rotate: 0,
        transition: { repeat: Infinity, duration: 4, ease: "easeInOut" }
      });
    } else if (status !== AssistantStatus.SPEAKING) {
      // Stop animations and reset if not thinking or speaking
      haloControls.stop();
      haloControls.set({ rotate: 0, scale: 1, opacity: 1 });
    }
  }, [status, haloControls]);

  const handleAvatarClick = () => {
    navigator.vibrate?.(10);
    setTemporaryMessage("👀 Oi, estou aqui!");
    const timer = setTimeout(() => setTemporaryMessage(null), 3000);
    return () => clearTimeout(timer);
  };

  const avatarVariants = {
    open: {
      scale: 1.05,
      rotate: -5,
      transition: { type: 'spring', stiffness: 80, damping: 10 },
    },
    closed: {
      scale: 1,
      rotate: 0,
      transition: { type: 'spring', stiffness: 80, damping: 10 },
    },
  };
  
  const cognitiveStateColors: Partial<Record<AssistantStatus, string>> = {
      [AssistantStatus.REWRITING_CODE]: "from-green-400/40 to-green-900/10", // Verde para integração
      [AssistantStatus.SELF_ANALYSIS]: "from-blue-400/40 to-blue-900/10", // Azul para observação
      [AssistantStatus.SEARCHING_WEB]: "from-blue-400/40 to-blue-900/10",
      [AssistantStatus.THINKING]: "from-yellow-400/40 to-amber-700/10", // Amarelo para análise
      [AssistantStatus.ROLLBACK]: "from-purple-500/50 to-purple-900/20", // Roxo para rollback
  };

  const bgClass = cognitiveStateColors[status] || emotionColors[emotion] || emotionColors.CALM;

  return (
    <>
      {status === AssistantStatus.REWRITING_CODE && <MatrixBackground />}
      
      {/* Emotion-driven background glow */}
      <div className={`absolute w-96 h-96 bg-gradient-radial ${bgClass} rounded-full blur-3xl transition-all duration-700 pointer-events-none`} />
      
      {/* Container for cognitive effects */}
      <div className="absolute z-0 pointer-events-none flex items-center justify-center">
          {status === AssistantStatus.THINKING && <ThinkingEffect />}
          {status === AssistantStatus.SELF_ANALYSIS && <SelfAnalysisEffect />}
          {status === AssistantStatus.SEARCHING_WEB && <SearchEffect />}
          {status === AssistantStatus.ROLLBACK && <RollbackEffect />}
      </div>

      {/* Clickable, moving avatar container */}
      <motion.div
        className="absolute z-10 flex items-center justify-center pointer-events-auto cursor-pointer"
        initial="closed"
        animate={isChatOpen ? 'open' : 'closed'}
        variants={avatarVariants}
        onClick={handleAvatarClick}
        whileTap={{ scale: 1.05 }}
      >
        <div className="relative flex flex-col items-center justify-center">
          {/* Temporary message bubble appears on click */}
          {temporaryMessage && (
            <div className="absolute bottom-full mb-4 p-2 bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg animate-fade-in-slide-up z-20">
              <p className="text-sm text-white">{temporaryMessage}</p>
            </div>
          )}

          <div className="relative flex items-center justify-center">
            {/* Halo for speaking/thinking effects */}
            <motion.div
              animate={haloControls}
              className="absolute top-[-1rem] w-4 h-4 rounded-full bg-cyan-400 shadow-[0_0_15px_rgba(0,255,255,0.7)]"
            />
            
            {/* The actual avatar model */}
            <Avatar appearance={appearance} status={status} intensity={intensity} />
          </div>
        </div>
      </motion.div>
    </>
  );
};