import React from 'react';
import { AppSettings } from '@/types';
import { AppearanceSelector } from '@/components/AppearanceSelector';

interface GeneralSettingsProps {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
}

const SettingsSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="mb-8">
        <h3 className="text-lg font-semibold text-cyan-300 mb-4 border-b border-gray-600 pb-2">{title}</h3>
        <div className="space-y-4">{children}</div>
    </section>
);

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({ settings, setSettings }) => {
    const [voices, setVoices] = React.useState<SpeechSynthesisVoice[]>([]);

    React.useEffect(() => {
        const fetchVoices = () => {
          const availableVoices = window.speechSynthesis.getVoices();
          if (availableVoices.length > 0) {
            setVoices(availableVoices.filter(v => v.lang.startsWith('pt')));
          }
        };
        fetchVoices();
        window.speechSynthesis.onvoiceschanged = fetchVoices;
    }, []);

    const handleNestedSettingChange = (field: keyof AppSettings, subField: string, value: any) => {
        setSettings(prev => ({
            ...prev,
            [field]: { ...(prev[field] as object), [subField]: value },
        }));
    };

    const testSpeech = (voiceSettings: AppSettings['voice']) => {
        const synth = window.speechSynthesis;
        if (synth.speaking) synth.cancel();
        
        const utter = new SpeechSynthesisUtterance("Olá, esta é uma prévia da minha voz.");
        const selectedVoice = voices.find(v => v.voiceURI === voiceSettings.voiceURI);
        if (selectedVoice) utter.voice = selectedVoice;
        
        utter.lang = 'pt-BR';
        utter.rate = voiceSettings.rate;
        utter.pitch = voiceSettings.pitch;
        
        synth.speak(utter);
    };

    return (
        <div className="max-w-xl mx-auto">
            <SettingsSection title="Aparência do Nexus">
                <p className="text-sm text-gray-400 -mt-2 mb-2">Escolha a personalidade visual e vocal do Nexus.</p>
                <AppearanceSelector
                    current={settings.appearance ?? 'neutral'}
                    onChange={(newAppearance) => setSettings(s => ({ ...s, appearance: newAppearance }))}
                />
            </SettingsSection>
            <SettingsSection title="Configurações de Voz">
                <div>
                    <label htmlFor="voice-select" className="block text-sm font-medium text-gray-300 mb-1">Voz</label>
                    <select 
                        id="voice-select" 
                        value={settings.voice.voiceURI || ''} 
                        onChange={(e) => {
                            const newURI = e.target.value;
                            handleNestedSettingChange('voice', 'voiceURI', newURI);
                            testSpeech({ ...settings.voice, voiceURI: newURI });
                        }}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500"
                    >
                        <option value="">Padrão do Sistema (PT-BR)</option>
                        {voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="voice-rate" className="block text-sm font-medium text-gray-300 mb-1">Velocidade ({settings.voice.rate.toFixed(1)})</label>
                    <input id="voice-rate" type="range" min="0.5" max="2" step="0.1" value={settings.voice.rate} 
                           onChange={(e) => handleNestedSettingChange('voice', 'rate', parseFloat(e.target.value))}
                           onMouseUp={() => testSpeech(settings.voice)} onTouchEnd={() => testSpeech(settings.voice)}
                           className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                </div>
                <div>
                    <label htmlFor="voice-pitch" className="block text-sm font-medium text-gray-300 mb-1">Tom ({settings.voice.pitch.toFixed(1)})</label>
                    <input id="voice-pitch" type="range" min="0" max="2" step="0.1" value={settings.voice.pitch} 
                           onChange={(e) => handleNestedSettingChange('voice', 'pitch', parseFloat(e.target.value))}
                           onMouseUp={() => testSpeech(settings.voice)} onTouchEnd={() => testSpeech(settings.voice)}
                           className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                </div>
            </SettingsSection>
        </div>
    );
};