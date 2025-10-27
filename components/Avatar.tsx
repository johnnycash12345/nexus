
import React, { useEffect } from 'react';
import './Avatar.css';
import { AssistantStatus } from '../types';

interface AvatarProps {
  status: AssistantStatus;
  className?: string;
  appearance?: 'neutral' | 'feminine' | 'masculine';
  intensity?: number;
}

const themeColors = {
  neutral: { glow1: "#7dd3fc", glow2: "#bae6fd", eye: "#ffffff", accent: "#38bdf8" },
  feminine: { glow1: "#ff9edb", glow2: "#ffc7ed", eye: "#ffe6fa", accent: "#ff66c4" },
  masculine: { glow1: "#5be0ff", glow2: "#a1ecff", eye: "#ccefff", accent: "#00b4d8" },
};

/* --- Sound hook synchronized with status --- */
const useAvatarSound = (status: AssistantStatus) => {
  useEffect(() => {
    // This is a placeholder for sound playback.
    // In a real app, you would have sound files in /public/sounds/
    const soundMap: Partial<Record<AssistantStatus, string>> = {
      [AssistantStatus.LISTENING]: 'listen.mp3',
      [AssistantStatus.SUCCESS]: 'success.mp3',
      [AssistantStatus.ERROR]: 'error.mp3',
      [AssistantStatus.CURIOUS]: 'curious.mp3',
      [AssistantStatus.SLEEPY]: 'sleepy.mp3',
      [AssistantStatus.SURPRISED]: 'surprised.mp3',
    };
    const file = soundMap[status];
    // To prevent console errors if files don't exist, we won't play them in this environment.
    // if (file) new Audio(`/sounds/${file}`).play().catch(() => {});
  }, [status]);
};

/* --- Main Component --- */
export const Avatar: React.FC<AvatarProps> = ({ status, className, appearance = 'neutral', intensity = 1.0 }) => {
  useAvatarSound(status);

  const antennaClass = `antenna-${status.toLowerCase()}`;
  const bodyMotion = `motion-${status.toLowerCase()}`;
  const theme = themeColors[appearance];
  
  // Modulate idle animation speed with intensity
  const bodyStyle = status === AssistantStatus.IDLE ? {
      animationDuration: `${4 / Math.max(0.5, intensity)}s`
  } : {};

  return (
    <div className={`relative ${className || 'w-64 h-64'}`}>
      <div className="absolute bottom-0 w-32 h-2 bg-cyan-400 rounded-full blur-xl opacity-40 shadow-xl animate-pulse"></div>

      <svg viewBox="0 0 200 200" className={`w-full h-full transition-all duration-700 ${bodyMotion} drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)]`} style={bodyStyle}>
        <defs>
          <radialGradient id="bodyGradient" cx="50%" cy="50%" r="80%">
            <stop offset="0%" stopColor="#6b7280" />
            <stop offset="100%" stopColor="#1f2937" />
          </radialGradient>
          <radialGradient id="eyeGlow" cx="50%" cy="50%" r="80%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
        </defs>
        
        {/* Thinking Waves */}
        {status === AssistantStatus.THINKING && (
          <g transform="translate(100, 80)">
            <circle className="thinking-wave wave-1" r="20" fill="none" stroke="#facc15" strokeWidth="1.5" />
            <circle className="thinking-wave wave-2" r="20" fill="none" stroke="#facc15" strokeWidth="1.5" />
            <circle className="thinking-wave wave-3" r="20" fill="none" stroke="#facc15" strokeWidth="1.5" />
          </g>
        )}

        {/* Body */}
        <path d="M 50 150 C 50 100, 150 100, 150 150 L 130 180 L 70 180 Z" fill="url(#bodyGradient)" />

        {/* Head */}
        <g>
          <path d="M 60 60 C 60 20, 140 20, 140 60 L 140 100 L 60 100 Z" fill="url(#bodyGradient)" />

          {/* Eyes with moving pupils */}
          <g className="eyes-group">
            <g className="eye">
              <circle cx="85" cy="75" r="10" fill="#000" />
              <circle cx="85" cy="75" r="10" fill="url(#eyeGlow)" />
              <circle cx="85" cy="75" r="3" fill={theme.eye} className="eye-reflect" />
            </g>
            <g className="eye">
              <circle cx="115" cy="75" r="10" fill="#000" />
              <circle cx="115" cy="75" r="10" fill="url(#eyeGlow)" />
              <circle cx="115" cy="75" r="3" fill={theme.eye} className="eye-reflect" />
            </g>
            {status === AssistantStatus.LISTENING && (
              <g>
                <circle cx="85" cy="75" r="5" fill={theme.accent} className="listen-pulse" />
                <circle cx="115" cy="75" r="5" fill={theme.accent} className="listen-pulse" />
              </g>
            )}
          </g>
        </g>

        {/* Mouth / Indicator */}
        <g transform="translate(100, 95)">
          {status === AssistantStatus.SPEAKING ? (
            <rect x="-15" y="-2.5" width="30" height="5" rx="2" fill={theme.accent} className="speak-mouth" />
          ) : status === AssistantStatus.THINKING ? (
             <circle r="6" fill="#facc15" className="think-pulse" />
          ) : status === AssistantStatus.SUCCESS ? (
            <path d="M -10 -2 L 0 8 L 10 -2" stroke="#4ade80" strokeWidth="3" fill="none" strokeLinecap="round" />
          ) : status === AssistantStatus.ERROR ? (
            <g transform="rotate(45)">
              <rect x="-10" y="-1.5" width="20" height="3" fill="#f87171" rx="1.5" />
              <rect x="-1.5" y="-10" width="3" height="20" fill="#f87171" rx="1.5" />
            </g>
          ) : status === AssistantStatus.CURIOUS ? (
            <path d="M -8 -1 Q 0 6 8 -1" stroke="#facc15" strokeWidth="2" fill="none" strokeLinecap="round" />
          ) : status === AssistantStatus.SLEEPY ? (
            <path d="M -8 0 Q 0 -3 8 0" stroke="#94a3b8" strokeWidth="2" fill="none" strokeLinecap="round" />
          ) : status === AssistantStatus.SURPRISED ? (
            <circle r="5" fill={theme.accent} />
          ) : (
            <rect x="-10" y="-1" width="20" height="2" rx="1" fill={theme.accent} fillOpacity="0.6" />
          )}
        </g>

        {/* Antenna */}
        <path d="M 100 20 L 100 10" stroke="#a0aec0" strokeWidth="2" />
        <circle cx="100" cy="8" r="4" className={antennaClass} style={{ '--c1': theme.glow1, '--c2': theme.glow2 } as React.CSSProperties} />
      </svg>
    </div>
  );
};
