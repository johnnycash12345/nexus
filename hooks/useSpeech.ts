import { useState, useEffect, useRef, useCallback } from 'react';

// Polyfill for webkitSpeechRecognition
// FIX: Cast window to `any` to access non-standard SpeechRecognition properties.
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export const useSpeech = (onResult: (text: string) => void) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  // FIX: Use `any` for the ref type because the `SpeechRecognition` constant
  // on line 5 shadows the global type definition, causing a conflict.
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

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript('');
    };

    recognition.onend = () => {
      setIsListening(false);
    };

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
    const ptBRVoice = voices.find(voice => voice.lang === 'pt-BR' && voice.name.includes('Google') && voice.name.includes('Masculino')) 
                      || voices.find(voice => voice.lang === 'pt-BR' && voice.name.includes('Male')) 
                      || voices.find(voice => voice.lang === 'pt-BR');

    if (ptBRVoice) {
      utterance.voice = ptBRVoice;
    } else {
        console.warn("Voz masculina em PT-BR não encontrada, usando padrão.")
    }
    
    utterance.lang = 'pt-BR';
    utterance.rate = 1;
    utterance.pitch = 1;
    
    utterance.onend = () => {
        onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    speak,
  };
};
