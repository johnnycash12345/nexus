
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

  // Animate halo rotation for thinking/curious status
  useEffect(() => {
    if (status === AssistantStatus.THINKING || status === AssistantStatus.CURIOUS) {
      haloControls.start({
        rotate: 360,
        transition: { duration: 8, ease: 'linear', repeat: Infinity },
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
  
  const bgClass = emotionColors[emotion] || emotionColors.CALM;

  return (
    <>
      {/* Emotion-driven background glow */}
      <div className={`absolute w-96 h-96 bg-gradient-radial ${bgClass} rounded-full blur-3xl transition-all duration-700 pointer-events-none`} />
      
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
              className="absolute top-[-1rem] w-6 h-6 bg-cyan-400 rounded-full shadow-[0_0_15px_rgba(0,255,255,0.8)]"
            />
            
            {/* The actual avatar model */}
            <Avatar appearance={appearance} status={status} intensity={intensity} />
          </div>
        </div>
      </motion.div>
    </>
  );
};
