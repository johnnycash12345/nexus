import { useState, useCallback, useRef, useEffect } from 'react';
import { VoiceService } from '@/services/voiceService';
import { LiveServerMessage } from '@google/genai';
import { SimpleFunctionCall } from '@/types';

export interface TranscriptionTurn {
    user: string;
    model: string;
}

export const useGeminiVoice = (
    onNewTurn: (turn: TranscriptionTurn) => void,
    onFunctionCall: (call: SimpleFunctionCall) => Promise<any>
) => {
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [isNexusSpeaking, setIsNexusSpeaking] = useState(false);
    const [currentUserTranscript, setCurrentUserTranscript] = useState('');
    const [currentNexusTranscript, setCurrentNexusTranscript] = useState('');

    const voiceServiceRef = useRef<VoiceService | null>(null);
    const userTranscriptRef = useRef('');
    const nexusTranscriptRef = useRef('');

    useEffect(() => {
        // Instantiate the service once
        voiceServiceRef.current = new VoiceService();
    }, []);

    const handleMessage = (rawMessage: LiveServerMessage) => {
        const message = rawMessage as Record<string, any>;
        if (message.serverContent?.inputTranscription) {
            const text = message.serverContent.inputTranscription.text;
            userTranscriptRef.current += text;
            setCurrentUserTranscript(userTranscriptRef.current);
        } else if (message.serverContent?.outputTranscription) {
            const text = message.serverContent.outputTranscription.text;
            nexusTranscriptRef.current += text;
            setCurrentNexusTranscript(nexusTranscriptRef.current);
        }

        if (message.serverContent?.modelTurn) {
            setIsNexusSpeaking(true);
        }

        if (message.toolCall) {
            for (const fc of message.toolCall.functionCalls) {
                console.log("[NEXUS-VOICE] Received function call:", fc);
                onFunctionCall(fc as SimpleFunctionCall).then(result => {
                    voiceServiceRef.current?.sendToolResponse(fc.id, fc.name, result);
                });
            }
        }

        if (message.serverContent?.turnComplete) {
            const finalUser = userTranscriptRef.current;
            const finalNexus = nexusTranscriptRef.current;
            
            if (finalUser || finalNexus) {
                onNewTurn({ user: finalUser, model: finalNexus });
            }
            
            userTranscriptRef.current = '';
            nexusTranscriptRef.current = '';
            setCurrentUserTranscript('');
            setCurrentNexusTranscript('');
            setIsNexusSpeaking(false);
        }
    };

    const startSession = useCallback(async () => {
        if (isSessionActive || !voiceServiceRef.current) return;
        setIsSessionActive(true);
        
        await voiceServiceRef.current.connect(
            handleMessage,
            (e) => {
                console.error("Voice service error:", e);
                setIsSessionActive(false);
            },
            (e) => {
                console.log("Voice service closed:", e);
                setIsSessionActive(false);
            }
        ).catch(err => {
            console.error("Failed to connect voice service:", err);
            setIsSessionActive(false);
        });
    }, [isSessionActive, onNewTurn, onFunctionCall]);

    const endSession = useCallback(async () => {
        if (!isSessionActive || !voiceServiceRef.current) return;
        await voiceServiceRef.current.close();
        setIsSessionActive(false);
    }, [isSessionActive]);

    return {
        isSessionActive,
        isNexusSpeaking,
        currentUserTranscript,
        currentNexusTranscript,
        startSession,
        endSession,
    };
};