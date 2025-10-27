import React from 'react';
import { AppSettings } from '../../types';
import { AppearanceSelector } from '../AppearanceSelector';

interface GeneralSettingsProps {
  settings: AppSettings;
  onSettingChange: (field: keyof AppSettings, value: any) => void;
  onNestedSettingChange: (field: keyof AppSettings, subField: string, value: any) => void;
  voices: SpeechSynthesisVoice[];
}

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({ settings, onSettingChange, onNestedSettingChange, voices }) => {
  
  // Function to provide audio feedback for voice settings changes.
  const testSpeech = (voiceSettings: AppSettings['voice']) => {
    const synth = window.speechSynthesis;
    // Cancel any current speech to play the new one immediately.
    if (synth.speaking) {
      synth.cancel();
    }
    
    const sampleText = "Olá, esta é uma prévia da minha voz.";
    const utter = new SpeechSynthesisUtterance(sampleText);
    
    const selectedVoice = voices.find(v => v.voiceURI === voiceSettings.voiceURI);
    if (selectedVoice) {
      utter.voice = selectedVoice;
    }
    
    utter.lang = 'pt-BR';
    utter.rate = voiceSettings.rate;
    utter.pitch = voiceSettings.pitch;
    
    synth.speak(utter);
  };

  const handleVoiceSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newURI = e.target.value;
    onNestedSettingChange('voice', 'voiceURI', newURI);
    testSpeech({ ...settings.voice, voiceURI: newURI });
  };

  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newRate = parseFloat(e.target.value);
    onNestedSettingChange('voice', 'rate', newRate);
  };
  
  const handlePitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPitch = parseFloat(e.target.value);
    onNestedSettingChange('voice', 'pitch', newPitch);
  };

  return (
    <div>
      <h3 className="text-lg font-semibold text-cyan-300 mb-4">Aparência do Nexus</h3>
      <AppearanceSelector
        current={settings.appearance ?? 'neutral'}
        onChange={(newAppearance) => onSettingChange('appearance', newAppearance)}
      />
      <h3 className="text-lg font-semibold text-cyan-300 my-4">Configurações de Voz</h3>
      <div className="space-y-4">
        <div>
          <label htmlFor="voice-select" className="block text-sm font-medium text-gray-300 mb-1">Voz</label>
          <select 
            id="voice-select" 
            value={settings.voice.voiceURI || ''} 
            onChange={handleVoiceSelectChange} 
            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500"
          >
            <option value="">Padrão do Sistema (PT-BR)</option>
            {voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="voice-rate" className="block text-sm font-medium text-gray-300 mb-1">Velocidade ({settings.voice.rate.toFixed(1)})</label>
          <input 
            id="voice-rate" 
            type="range" 
            min="0.5" 
            max="2" 
            step="0.1" 
            value={settings.voice.rate} 
            onChange={handleRateChange} 
            onMouseUp={() => testSpeech(settings.voice)}
            onTouchEnd={() => testSpeech(settings.voice)}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500" 
          />
        </div>
        <div>
          <label htmlFor="voice-pitch" className="block text-sm font-medium text-gray-300 mb-1">Tom ({settings.voice.pitch.toFixed(1)})</label>
          <input 
            id="voice-pitch" 
            type="range" 
            min="0" 
            max="2" 
            step="0.1" 
            value={settings.voice.pitch} 
            onChange={handlePitchChange} 
            onMouseUp={() => testSpeech(settings.voice)}
            onTouchEnd={() => testSpeech(settings.voice)}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500" 
          />
        </div>
      </div>
    </div>
  );
};
