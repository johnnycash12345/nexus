import React from 'react';
import { AppSettings } from '@/types';

interface IntegrationsSettingsProps {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
}

const SettingsSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="mb-8">
        <h3 className="text-lg font-semibold text-cyan-300 mb-4 border-b border-gray-600 pb-2">{title}</h3>
        <div className="space-y-4">{children}</div>
    </section>
);

export const IntegrationsSettings: React.FC<IntegrationsSettingsProps> = ({ settings, setSettings }) => {
    
    const handleSettingChange = (field: keyof AppSettings, value: any) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleNestedSettingChange = (field: keyof AppSettings, subField: string, value: any) => {
        setSettings(prev => ({
            ...prev, [field]: { ...(prev[field] as object), [subField]: value },
        }));
    };

    return (
        <div className="max-w-xl mx-auto">
            <SettingsSection title="Provedor de LLM">
                <div>
                    <label htmlFor="llm-provider" className="block text-sm font-medium text-gray-300 mb-1">Modelo de Linguagem Principal</label>
                    <select id="llm-provider" value={settings.llmProvider || 'gemini'} onChange={(e) => handleSettingChange('llmProvider', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500">
                        <option value="gemini">Google Gemini (Padrão)</option>
                        <option value="deepseek">DeepSeek (Fallback)</option>
                    </select>
                </div>
                <div className="p-3 bg-gray-900/50 border border-cyan-500/20 rounded-md">
                    <p className="text-sm text-gray-300">A chave de API do **Google Gemini** é gerenciada pelo ambiente e não precisa ser inserida aqui.</p>
                </div>
            </SettingsSection>

            <SettingsSection title="Chaves de API (Opcional)">
                <div>
                    <label htmlFor="deepseek-api-key" className="block text-sm font-medium text-gray-300 mb-1">Chave de API DeepSeek</label>
                    <input
                        type="password" id="deepseek-api-key"
                        value={settings.apiKeys?.deepseekApiKey || ''}
                        onChange={(e) => handleNestedSettingChange('apiKeys', 'deepseekApiKey', e.target.value)}
                        placeholder="Usado como fallback se o Gemini falhar"
                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                        Obtenha uma em <a href="https://platform.deepseek.com/" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">platform.deepseek.com</a>.
                    </p>
                </div>
                <div>
                    <label htmlFor="news-api-key" className="block text-sm font-medium text-gray-300 mb-1">Chave de API NewsAPI</label>
                    <input
                        type="password" id="news-api-key"
                        value={settings.apiKeys?.newsApiKey || ''}
                        onChange={(e) => handleNestedSettingChange('apiKeys', 'newsApiKey', e.target.value)}
                        placeholder="Necessária para a busca de notícias"
                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                        Habilita o comando "notícias sobre...". Obtenha uma chave gratuita em <a href="https://newsapi.org/" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">newsapi.org</a>.
                    </p>
                </div>
            </SettingsSection>
        </div>
    );
}