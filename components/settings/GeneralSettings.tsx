import React, { memo, useCallback, useId, useRef } from 'react';
import { AppSettings } from '../../types';
import { AppearanceSelector } from '../AppearanceSelector';

// --- Props ---

interface GeneralSettingsProps {
  settings: AppSettings;
  onSettingChange: (field: keyof AppSettings, value: any) => void;
  onNestedSettingChange: (field: keyof AppSettings, subField: string, value: any) => void;
  voices: SpeechSynthesisVoice[];
}

interface VoiceSettingsProps {
  voiceSettings: AppSettings['voice'];
  onNestedSettingChange: (field: keyof AppSettings, subField: string, value: any) => void;
  voices: SpeechSynthesisVoice[];
}

// ----------------------------------------------------------------------
// APRIMORAMENTO: Ícones SVG embutidos
// ----------------------------------------------------------------------
const IconSound = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
  </svg>
);

const IconChevronDown = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
);

// ----------------------------------------------------------------------
// APRIMORAMENTO: Componente SliderSetting (Reutilizado de BrainSettings)
// ----------------------------------------------------------------------
interface SliderSettingProps {
    id: string;
    label: string;
    displayValue: string;
    value: number | undefined;
    min: number;
    max: number;
    step: number;
    onChange: (value: number) => void;
}

const SliderSetting: React.FC<SliderSettingProps> = ({ id, label, displayValue, value, min, max, step, onChange }) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        onChange(step < 1 ? parseFloat(val) : parseInt(val, 10));
    };

    return (
        <div>
            <label htmlFor={id} className="flex justify-between text-sm font-medium text-gray-300 mb-1">
                <span>{label}</span>
                <span className="text-cyan-400 font-bold">{displayValue}</span>
            </label>
            <input 
                id={id} 
                type="range" 
                min={min} 
                max={max} 
                step={step} 
                value={value || min} 
                onChange={handleChange}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
        </div>
    );
}

// --- Componente de Configuração de Voz (Aprimorado) ---

const VoiceSettings = memo(({ voiceSettings, onNestedSettingChange, voices }: VoiceSettingsProps) => {
  const voiceId = useId();
  const rateId = useId();
  const pitchId = useId();
  const debounceTimerRef = useRef<number | null>(null);

  const testSpeech = useCallback((settings: AppSettings['voice']) => {
    const synth = window.speechSynthesis;
    if (synth.speaking) synth.cancel();

    const sampleText = "Olá, esta é uma prévia da minha voz.";
    const utter = new SpeechSynthesisUtterance(sampleText);
    const selectedVoice = voices.find(v => v.voiceURI === settings.voiceURI);
    
    if (selectedVoice) utter.voice = selectedVoice;
    utter.lang = 'pt-BR';
    utter.rate = settings.rate;
    utter.pitch = settings.pitch;
    synth.speak(utter);
  }, [voices]);

  const debouncedTestSpeech = useCallback((settings: AppSettings['voice']) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = window.setTimeout(() => {
      testSpeech(settings);
    }, 300);
  }, [testSpeech]);

  const handleVoiceSelectChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newURI = e.target.value;
    onNestedSettingChange('voice', 'voiceURI', newURI);
    // Testa imediatamente na seleção
    testSpeech({ ...voiceSettings, voiceURI: newURI });
  }, [onNestedSettingChange, testSpeech, voiceSettings]);

  const handleRateChange = useCallback((newRate: number) => {
    onNestedSettingChange('voice', 'rate', newRate);
    debouncedTestSpeech({ ...voiceSettings, rate: newRate });
  }, [onNestedSettingChange, debouncedTestSpeech, voiceSettings]);

  const handlePitchChange = useCallback((newPitch: number) => {
    onNestedSettingChange('voice', 'pitch', newPitch);
    debouncedTestSpeech({ ...voiceSettings, pitch: newPitch });
  }, [onNestedSettingChange, debouncedTestSpeech, voiceSettings]);

  return (
    <>
      <h3 className="text-lg font-semibold text-cyan-300 mt-6 mb-4">🔊 Configurações de Voz</h3>
      
      {/* APRIMORAMENTO: Layout em Card */}
      <div className="space-y-5 p-4 bg-gray-700/50 rounded-lg border border-gray-600/30">
        <div>
          <div className="flex justify-between items-center mb-1">
            <label htmlFor={voiceId} className="block text-sm font-medium text-gray-300">Voz</label>
            {/* APRIMORAMENTO: Botão de Teste Explícito */}
            <button 
              onClick={() => testSpeech(voiceSettings)} 
              className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <IconSound />
              Testar Voz
            </button>
          </div>
          {/* APRIMORAMENTO: Select Estilizado */}
          <div className="relative">
            <select
              id={voiceId}
              value={voiceSettings.voiceURI || ''}
              onChange={handleVoiceSelectChange}
              className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500 appearance-none" // appearance-none remove a seta padrão
            >
              <option value="">Padrão do Sistema (PT-BR)</option>
              {voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-400">
              <IconChevronDown />
            </div>
          </div>
        </div>
        
        {/* APRIMORAMENTO: Sliders refatorados para o componente SliderSetting */}
        <SliderSetting
          id={rateId}
          label="Velocidade"
          displayValue={`(${(voiceSettings.rate || 1.0).toFixed(1)})`}
          value={voiceSettings.rate}
          min={0.5} max={2} step={0.1}
          onChange={handleRateChange}
        />
        
        <SliderSetting
          id={pitchId}
          label="Tom"
          displayValue={`(${(voiceSettings.pitch || 1.0).toFixed(1)})`}
          value={voiceSettings.pitch}
          min={0} max={2} step={0.1}
          onChange={handlePitchChange}
        />
      </div>
    </>
  );
});

// --- Componente Principal (Aprimorado) ---

export const GeneralSettings = memo(({ settings, onSettingChange, onNestedSettingChange, voices }: GeneralSettingsProps) => {
  return (
    <div>
      <h3 className="text-lg font-semibold text-cyan-300 mb-4">🎨 Aparência do Nexus</h3>
      
      {/* APRIMORAMENTO: O AppearanceSelector já é um "card" (do aprimoramento anterior) */}
      <AppearanceSelector
        current={settings.appearance ?? 'neutral'}
        onChange={(newAppearance) => onSettingChange('appearance', newAppearance)}
        label="Selecione o tema visual"
      />
      
      <VoiceSettings
        voiceSettings={settings.voice}
        onNestedSettingChange={onNestedSettingChange}
        voices={voices}
      />
    </div>
  );
});