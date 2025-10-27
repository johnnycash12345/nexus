import React from 'react';
import { AppSettings } from '../../types';

interface IntegrationsSettingsProps {
  settings: AppSettings;
  onSettingChange: (field: keyof AppSettings, value: any) => void;
  onNestedSettingChange: (field: keyof AppSettings, subField: string, value: any) => void;
}

export const IntegrationsSettings: React.FC<IntegrationsSettingsProps> = ({ settings, onSettingChange, onNestedSettingChange }) => {
    return (
        <div>
            <h3 className="text-lg font-semibold text-cyan-300 mb-4">Provedor de LLM</h3>
            <div className="space-y-4">
                <div>
                    <label htmlFor="llm-provider" className="block text-sm font-medium text-gray-300 mb-1">Modelo de Linguagem</label>
                    <select id="llm-provider" value={settings.llmProvider || 'gemini'} onChange={(e) => onSettingChange('llmProvider', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500">
                        <option value="gemini">Google Gemini (Padrão)</option>
                        <option value="deepseek">DeepSeek</option>
                    </select>
                </div>
                <div className="p-3 bg-gray-700/50 border border-cyan-500/20 rounded-md">
                    <p className="text-sm text-gray-300">A chave de API do **Google Gemini** é gerenciada pelo ambiente e não precisa ser inserida aqui.</p>
                </div>
            </div>
            <h3 className="text-lg font-semibold text-cyan-300 my-4">Chaves de API (Opcional)</h3>
            <div className="space-y-4">
                <div>
                    <label htmlFor="deepseek-api-key" className="block text-sm font-medium text-gray-300 mb-1">Chave de API DeepSeek</label>
                    <input
                        type="password"
                        id="deepseek-api-key"
                        value={settings.apiKeys?.deepseekApiKey || ''}
                        onChange={(e) => onNestedSettingChange('apiKeys', 'deepseekApiKey', e.target.value)}
                        placeholder="Cole sua chave aqui"
                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500"
                        disabled={settings.llmProvider !== 'deepseek'}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                        Necessária apenas se o provedor for DeepSeek. Obtenha uma em <a href="https://platform.deepseek.com/" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">platform.deepseek.com</a>.
                    </p>
                </div>
                <div>
                    <label htmlFor="news-api-key" className="block text-sm font-medium text-gray-300 mb-1">Chave de API NewsAPI</label>
                    <input
                        type="password"
                        id="news-api-key"
                        value={settings.apiKeys?.newsApiKey || ''}
                        onChange={(e) => onNestedSettingChange('apiKeys', 'newsApiKey', e.target.value)}
                        placeholder="Cole sua chave aqui"
                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                        Habilita a busca por notícias. Obtenha uma chave gratuita em <a href="https://newsapi.org/" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">newsapi.org</a>.
                    </p>
                </div>
            </div>
        </div>
    );
}
