
import React from 'react';
import { AssistantStatus } from '../types';

interface AvatarProps {
  status: AssistantStatus;
  className?: string;
}

const AnimationStyles: React.FC = () => (
    <style>{`
      /* --- Default Pulse --- */
      @keyframes pulse {
        50% { opacity: .5; }
      }
      .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }

      /* --- IDLE --- */
      @keyframes idle-float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-8px); }
      }
      @keyframes idle-blink {
        0%, 90%, 100% { transform: scaleY(1); }
        95% { transform: scaleY(0.1); }
      }
      @keyframes antenna-idle-pulse {
        0%, 100% { fill: #38b2ac; filter: drop-shadow(0 0 2px #38b2ac); }
        50% { fill: #6ee7b7; filter: drop-shadow(0 0 4px #6ee7b7); }
      }
      .idle-float { animation: idle-float 4s ease-in-out infinite; }
      .idle-blink { animation: idle-blink 5s ease-in-out infinite; }
      .antenna-idle-pulse { animation: antenna-idle-pulse 3s ease-in-out infinite; }
  
      /* --- LISTENING --- */
      @keyframes listen-pulse {
        0%, 100% { r: 5; opacity: 1; }
        50% { r: 10; opacity: 0.5; }
      }
      @keyframes listen-tilt {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(-3deg); }
        75% { transform: rotate(3deg); }
      }
      .listen-pulse { animation: listen-pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
      .listen-tilt { animation: listen-tilt 3s ease-in-out infinite; transform-origin: 100px 150px; }
  
      /* --- THINKING --- */
      @keyframes think-rotate-fast {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes think-rotate-slow {
        from { transform: rotate(0deg); }
        to { transform: rotate(-360deg); }
      }
      @keyframes think-scan {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-3px); }
        75% { transform: translateX(3px); }
      }
      .think-rotate-fast { animation: think-rotate-fast 1s linear infinite; transform-origin: center; }
      .think-rotate-slow { animation: think-rotate-slow 2s linear infinite; transform-origin: center; }
      .think-scan { animation: think-scan 2.5s ease-in-out infinite; }
  
      /* --- SPEAKING --- */
      @keyframes speak-glow {
        0%, 100% { filter: drop-shadow(0 0 5px #22d3ee); }
        50% { filter: drop-shadow(0 0 15px #22d3ee); }
      }
      @keyframes speak-mouth {
        0%, 100% { transform: scaleY(0.4) translateY(2px); }
        25% { transform: scaleY(1) translateY(0); }
        50% { transform: scaleY(0.6) translateY(1px); }
        75% { transform: scaleY(1.2) translateY(-1px); }
      }
      @keyframes antenna-speak-pulse {
          0%, 100% { r: 4; }
          50% { r: 5; }
      }
      .speak-glow { animation: speak-glow 1.5s ease-in-out infinite; }
      .speak-mouth { animation: speak-mouth 0.5s ease-in-out infinite; transform-origin: center; }
      .antenna-speak-pulse { animation: antenna-speak-pulse 0.5s ease-in-out infinite; }

      /* --- SUCCESS --- */
      @keyframes success-bounce {
        0%, 100% { transform: translateY(0) scale(1); }
        50% { transform: translateY(-12px) scale(1.05); }
      }
      @keyframes success-antenna {
        0%, 100% { fill: #4ade80; filter: drop-shadow(0 0 5px #4ade80); }
        50% { fill: #bbf7d0; filter: drop-shadow(0 0 10px #bbf7d0); }
      }
      .success-bounce { animation: success-bounce 0.8s ease-in-out; }
      .success-antenna { animation: success-antenna 0.8s ease-in-out forwards; }

      /* --- ERROR --- */
      @keyframes error-shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px) rotate(-1deg); }
        20%, 40%, 60%, 80% { transform: translateX(5px) rotate(1deg); }
      }
      @keyframes error-antenna {
        0%, 100% { fill: #f87171; } 25% { fill: #fee2e2; } 50% { fill: #f87171; } 75% { fill: #fee2e2; }
      }
      .error-shake { animation: error-shake 0.5s cubic-bezier(.36,.07,.19,.97) both; transform-origin: 100px 150px;}
      .error-antenna { animation: error-antenna 0.3s linear infinite; }
    `}</style>
  );

export const Avatar: React.FC<AvatarProps> = ({ status, className }) => {
  const getAntennaClass = () => {
    switch(status) {
      case AssistantStatus.IDLE:
        return 'antenna-idle-pulse';
      case AssistantStatus.SPEAKING:
        return 'antenna-speak-pulse';
      case AssistantStatus.SUCCESS:
        return 'success-antenna';
      case AssistantStatus.ERROR:
        return 'error-antenna';
      default:
        return 'animate-pulse';
    }
  };

  return (
    <div className={`relative ${className || 'w-64 h-64'}`}>
      <AnimationStyles />
      <svg viewBox="0 0 200 200" className={`w-full h-full transition-transform duration-500 ${status === AssistantStatus.IDLE ? 'idle-float' : ''} ${status === AssistantStatus.SPEAKING ? 'speak-glow' : ''} ${status === AssistantStatus.SUCCESS ? 'success-bounce' : ''}`}>
        {/* Body */}
        <path d="M 50 150 C 50 100, 150 100, 150 150 L 130 180 L 70 180 Z" fill="#4a5568" />
        
        {/* Head Group for tilting/shaking */}
        <g className={`${status === AssistantStatus.LISTENING ? 'listen-tilt' : ''} ${status === AssistantStatus.ERROR ? 'error-shake' : ''}`}>
          {/* Head */}
          <path d="M 60 60 C 60 20, 140 20, 140 60 L 140 100 L 60 100 Z" fill="#718096" />
          
          {/* Eyes Group for scanning */}
          <g className={status === AssistantStatus.THINKING ? 'think-scan' : ''}>
              <circle cx="85" cy="75" r="10" fill={status === AssistantStatus.ERROR ? '#7f1d1d' : '#000'} />
              <circle cx="115" cy="75" r="10" fill={status === AssistantStatus.ERROR ? '#7f1d1d' : '#000'} />
              <circle cx="87" cy="73" r="3" fill="#fff" className={status === AssistantStatus.IDLE ? 'idle-blink' : ''}/>
              <circle cx="117" cy="73" r="3" fill="#fff" className={status === AssistantStatus.IDLE ? 'idle-blink' : ''}/>
              {status === AssistantStatus.LISTENING && (
                  <>
                      <circle cx="85" cy="75" r="5" fill="#f87171" className="listen-pulse" />
                      <circle cx="115" cy="75" r="5" fill="#f87171" className="listen-pulse" />
                  </>
              )}
          </g>
        </g>
        
        {/* Mouth/Indicator */}
        <g transform="translate(100, 95)">
            {status === AssistantStatus.SPEAKING ? (
                 <rect x="-15" y="-2.5" width="30" height="5" rx="2" fill="#22d3ee" className="speak-mouth" />
            ) : status === AssistantStatus.THINKING ? (
                 <g>
                    <circle r="12" fill="none" stroke="#facc15" strokeWidth="2" strokeDasharray="4 4" className="think-rotate-slow" />
                    <circle r="6" fill="#facc15" className="think-rotate-fast" />
                 </g>
            ) : status === AssistantStatus.SUCCESS ? (
                <path d="M -10 -2 L 0 8 L 10 -2" stroke="#4ade80" strokeWidth="3" fill="none" strokeLinecap="round" />
            ) : status === AssistantStatus.ERROR ? (
                <g transform="rotate(45)">
                    <rect x="-10" y="-1.5" width="20" height="3" fill="#f87171" rx="1.5" />
                    <rect x="-1.5" y="-10" width="3" height="20" fill="#f87171" rx="1.5" />
                </g>
            ) : (
                <rect x="-10" y="-1" width="20" height="2" rx="1" fill="#4a5568" />
            )}
        </g>
        
        {/* Antenna */}
        <path d="M 100 20 L 100 10" stroke="#a0aec0" strokeWidth="2" />
        <circle 
            cx="100" cy="8" r="4" 
            className={getAntennaClass()} 
        />
      </svg>
    </div>
  );
};