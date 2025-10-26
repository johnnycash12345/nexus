
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
      scale: 0.6,
      opacity: 0.5,
      y: '-25vh',
      filter: 'blur(1.5px)',
    },
    closed: {
      scale: 1,
      opacity: 1,
      y: '0vh',
      filter: 'blur(0px)',
    },
  };

  return (
    <motion.div
      className="absolute z-10 flex items-center justify-center w-full h-full pointer-events-none"
      initial={false}
      animate={isChatOpen ? 'open' : 'closed'}
      variants={avatarVariants}
      transition={{ duration: 0.8, ease: 'easeInOut' }}
    >
      <Avatar appearance={appearance} status={status} />
    </motion.div>
  );
};
