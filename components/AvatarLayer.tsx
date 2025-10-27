
import React from 'react';
import { motion } from 'framer-motion';
import { Avatar } from './Avatar';
import { AssistantStatus } from '../types';

interface AvatarLayerProps {
  isChatOpen: boolean;
  appearance: 'neutral' | 'feminine' | 'masculine';
  status: AssistantStatus;
}

export const AvatarLayer: React.FC<AvatarLayerProps> = ({ isChatOpen, appearance, status }) => {
  const avatarVariants = {
    open: {
      scale: 0.4,
      opacity: 1,
      y: '-42vh',
      x: '38vw',
      filter: 'blur(0px)',
      transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] }
    },
    closed: {
      scale: 1,
      opacity: 1,
      y: '0vh',
      x: '0vw',
      filter: 'blur(0px)',
      transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] }
    },
  };

  return (
    <motion.div
      className="absolute z-10 flex items-center justify-center w-full h-full pointer-events-none"
      initial="closed"
      animate={isChatOpen ? 'open' : 'closed'}
      variants={avatarVariants}
    >
      <Avatar appearance={appearance} status={status} />
    </motion.div>
  );
};
