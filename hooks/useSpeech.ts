import { useState, useEffect, useRef, useCallback } from 'react';
import { VoiceSettings } from '../types';

// Polyfill for webkitSpeechRecognition
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export const useSpeech = (onResult: (text: string) => void, voiceSettings?: VoiceSettings) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any | null>(null);

  useEffect(() => {
    if (!SpeechRecognition) {
      console.warn('Speech Recognition API is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };
    recognition.onresult = (event: any) => {
      const currentTranscript = event.results[0][0].transcript;
      setTranscript(currentTranscript);
      onResult(currentTranscript);
    };
    
    recognitionRef.current = recognition;

  }, [onResult]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        // This can happen if the user denies permission after the component mounts
        console.error("Error starting recognition:", e);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!window.speechSynthesis) {
      console.warn('Speech Synthesis API is not supported in this browser.');
      onEnd?.();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    let voiceToUse = null;

    if (voiceSettings?.voiceURI) {
        voiceToUse = voices.find(v => v.voiceURI === voiceSettings.voiceURI);
    } else {
        voiceToUse = voices.find(voice => voice.lang === 'pt-BR' && voice.name.includes('Google') && voice.name.includes('Masculino')) 
                      || voices.find(voice => voice.lang === 'pt-BR' && voice.name.includes('Male')) 
                      || voices.find(voice => voice.lang === 'pt-BR');
    }

    if (voiceToUse) {
      utterance.voice = voiceToUse;
    } else {
      console.warn("Voz PT-BR não encontrada ou configurada, usando padrão.")
    }
    
    utterance.lang = 'pt-BR';
    utterance.rate = voiceSettings?.rate ?? 1;
    utterance.pitch = voiceSettings?.pitch ?? 1;
    
    utterance.onend = () => {
        onEnd?.();
    };
    
    // Cancel any previous speech to prevent overlap
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [voiceSettings]);

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    speak,
  };
};
