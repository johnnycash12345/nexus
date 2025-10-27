
import { useEffect, useRef, useState, useCallback } from 'react';
import { AppSettings, AssistantStatus } from '../types';

export const useSpeech = (settings: AppSettings | null, status?: AssistantStatus) => {
  const synthRef = useRef(window.speechSynthesis);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = synthRef.current.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices.filter(v => v.lang.startsWith('pt')));
      }
    };

    loadVoices();
    // Some browsers fire onvoiceschanged, others load them immediately.
    synthRef.current.onvoiceschanged = loadVoices;
    
    // Cleanup on unmount
    return () => {
        synthRef.current.cancel();
    }
  }, []);

  const cleanText = useCallback((text: string): string => {
    if (!text) return '';
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
      .replace(/\*(.*?)\*/g, '$1')   // Italic
      .replace(/#+\s?/g, '')         // Headers
      .replace(/[_~`>]/g, '')         // Strikethrough, code, etc.
      .replace(/\[.*?\]\(.*?\)/g, '') // Links
      .replace(/<[^>]*>?/gm, '')      // HTML Tags
      .replace(/(\r\n|\n|\r)/gm, ' ') // Line breaks
      .replace(/\s{2,}/g, ' ')        // Multiple spaces
      .trim();
  }, []);

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!text || !settings) {
        onEnd?.();
        return;
    }

    const synth = synthRef.current;
    // Cancel any ongoing speech to prevent overlap
    if (synth.speaking) {
      synth.cancel();
    }

    const cleanedText = cleanText(text);
    const utter = new SpeechSynthesisUtterance(cleanedText);

    // Apply settings from the app
    utter.lang = 'pt-BR';
    utter.rate = settings.voice.rate;
    utter.pitch = settings.voice.pitch;
    
    // Emotional modulation based on status
    if (status) {
        switch (status) {
            case AssistantStatus.SUCCESS:
            case AssistantStatus.SURPRISED:
                utter.pitch = Math.min(2, settings.voice.pitch + 0.2);
                utter.rate = Math.min(2, settings.voice.rate + 0.1);
                break;
            case AssistantStatus.ERROR:
                utter.pitch = Math.max(0, settings.voice.pitch - 0.2);
                utter.rate = Math.max(0.5, settings.voice.rate - 0.1);
                break;
            case AssistantStatus.CURIOUS:
                utter.pitch = Math.min(2, settings.voice.pitch + 0.1);
                break;
            case AssistantStatus.SLEEPY:
                utter.rate = Math.max(0.5, settings.voice.rate - 0.2);
                break;
        }
    }

    // --- Voice Selection Logic ---
    let selectedVoice: SpeechSynthesisVoice | undefined = undefined;

    // 1. Prioritize user's explicit voice choice from settings
    if (settings.voice.voiceURI) {
        selectedVoice = voices.find(v => v.voiceURI === settings.voice.voiceURI);
    }

    // 2. If no explicit choice, try to match appearance
    if (!selectedVoice) {
        const appearance = settings.appearance || 'neutral';
        const voiceKeywords = {
            feminine: ['feminino', 'female', 'mulher', 'brazil', 'luciana'], // Common keywords
            masculine: ['masculino', 'male', 'homem', 'brazil'],
        };
        
        const keywords = voiceKeywords[appearance as keyof typeof voiceKeywords];
        if (keywords) {
             selectedVoice = voices.find(v => keywords.some(kw => v.name.toLowerCase().includes(kw)));
        }
    }
    
    // 3. Fallback to a default Brazilian Portuguese voice
    if (!selectedVoice) {
        selectedVoice = voices.find(v => v.name.includes('Google português do Brasil'));
    }
    
    // 4. Final fallback to any pt-BR voice
    if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang === 'pt-BR');
    }
    
    if (selectedVoice) {
        utter.voice = selectedVoice;
    }

    if (onEnd) {
      utter.onend = onEnd;
    } else {
      // Ensure it doesn't carry over from a previous utterance
      utter.onend = null;
    }

    synth.speak(utter);
  }, [settings, voices, cleanText, status]);

  const stop = useCallback(() => {
    if (synthRef.current.speaking) {
      synthRef.current.cancel();
    }
  }, []);

  return { speak, stop };
};
