import React, { useState } from 'react';
import { AppSettings } from '../../types';

// ----------------------------------------------------------------------
// Ícones SVG embutidos (Mantidos)
// ----------------------------------------------------------------------
const IconEye = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

const IconEyeSlash = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
);

// ----------------------------------------------------------------------
// Subcomponente ApiKeyInput (Mantido)
// ----------------------------------------------------------------------
interface ApiKeyInputProps {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    description: React.ReactNode;
    disabled?: boolean;
}

const ApiKeyInput: React.FC<ApiKeyInputProps> = ({ id, label, value, onChange, placeholder, description, disabled = false }) => {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <div>
            <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
            <div className="relative">
                <input
                    type={isVisible ? 'text' : 'password'}
                    id={id}
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={`w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500 pr-10 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                />
                <button
                    type="button"
                    onClick={() => setIsVisible(!isVisible)}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-white disabled:opacity-50"
                    title={isVisible ? 'Ocultar chave' : 'Mostrar chave'}
                    disabled={disabled}
                >
                    {isVisible ? <IconEyeSlash /> : <IconEye />}
                </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
                {description}
            </p>
        </div>
    );
};

// ----------------------------------------------------------------------
// Componente Principal (Layout de "Cards" Aprimorado)
// ----------------------------------------------------------------------
interface IntegrationsSettingsProps {
    settings: AppSettings;
    onSettingChange: (field: keyof AppSettings, value: any) => void;
    onNestedSettingChange: (field: keyof AppSettings, subField: string, value: any) => void;
}

export const IntegrationsSettings: React.FC<IntegrationsSettingsProps> = ({ settings, onSettingChange, onNestedSettingChange }) => {
    return (
        // APRIMORAMENTO: Adicionado 'space-y-6' para espaçar os cards
        <div className="space-y-6">

            {/* Card 1: Provedor de LLM */}
            <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                <h3 className="text-lg font-semibold text-cyan-300 mb-4">📡 Provedor de LLM</h3>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="llm-provider" className="block text-sm font-medium text-gray-300 mb-1">Modelo de Linguagem</label>
                        <select 
                            id="llm-provider" 
                            value={settings.llmProvider || 'gemini'} 
                            onChange={(e) => onSettingChange('llmProvider', e.target.value)} 
                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500"
                        >
                            <option value="gemini">Google Gemini (Padrão)</option>
                            <option value="deepseek">DeepSeek</option>
                        </select>
                    </div>
                    <div className="p-3 bg-gray-700/50 border border-cyan-500/20 rounded-md flex items-start gap-2.5">
                        <span className="text-cyan-400 mt-0.5">ℹ️</span>
                        <p className="text-sm text-gray-300">
                            A chave de API do **Google Gemini** é gerenciada pelo ambiente (ex: Google AI Studio) e não precisa ser inserida aqui.
                        </p>
                    </div>
                </div>
            </div>
            
            {/* Card 2: Chaves de API */}
            <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                <h3 className="text-lg font-semibold text-cyan-300 mb-4">🔑 Chaves de API (Opcional)</h3>
                <div className="space-y-4">
                    <ApiKeyInput
                        id="deepseek-api-key"
                        label="Chave de API DeepSeek"
                        value={settings.apiKeys?.deepseekApiKey}
                        onChange={(v) => onNestedSettingChange('apiKeys', 'deepseekApiKey', v)}
                        placeholder="Cole sua chave aqui"
                        disabled={settings.llmProvider !== 'deepseek'}
                        description={
                            <>
                                Necessária apenas se o provedor for DeepSeek. Obtenha uma em <a href="https://platform.deepseek.com/" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">platform.deepseek.com</a>.
                            </>
                        }
                    />
                    <ApiKeyInput
                        id="news-api-key"
                        label="Chave de API NewsAPI"
                        value={settings.apiKeys?.newsApiKey}
                        onChange={(v) => onNestedSettingChange('apiKeys', 'newsApiKey', v)}
                        placeholder="Cole sua chave aqui"
                        description={
                            <>
                                Habilita a busca por notícias. Obtenha uma chave gratuita em <a href="https://newsapi.org/" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">newsapi.org</a>.
                            </>
                        }
                    />
                </div>
            </div>
        </div>
    );
}