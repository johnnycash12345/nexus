
import React from 'react';
import { AppSettings, Permissions } from '../../types';

interface IntegrationsSettingsProps {
  settings: AppSettings;
  onSettingChange: (field: keyof AppSettings, value: any) => void;
  onNestedSettingChange: (field: keyof AppSettings, subField: string, value: any) => void;
  onPermissionChange: (field: keyof Permissions, value: boolean) => void;
  isUnlocked: boolean;
  requestAuth: () => void;
  token: string | null;
}

const LockedSetting: React.FC<{ isLocked: boolean; requestAuth: () => void; children: React.ReactNode }> = ({ isLocked, requestAuth, children }) => {
    return (
        <div 
            className={`transition-opacity ${isLocked ? 'opacity-60' : ''}`}
            onClick={isLocked ? requestAuth : undefined}
            title={isLocked ? 'Clique para desbloquear com senha de administrador' : ''}
        >
            <div className={isLocked ? 'pointer-events-none' : ''}>
                {children}
            </div>
        </div>
    );
};

export const IntegrationsSettings: React.FC<IntegrationsSettingsProps> = ({ settings, onSettingChange, onNestedSettingChange, onPermissionChange, isUnlocked, requestAuth, token }) => {
    return (
        <div>
            <h3 className="text-lg font-semibold text-cyan-300 mb-4">Provedor de LLM</h3>
            <div>
                <label htmlFor="llm-provider" className="block text-sm font-medium text-gray-300 mb-1">Modelo de Linguagem</label>
                <select id="llm-provider" value={settings.llmProvider || 'gemini'} onChange={(e) => onSettingChange('llmProvider', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500">
                    <option value="gemini">Google Gemini (Padrão)</option>
                    <option value="deepseek">DeepSeek</option>
                </select>
                <div className="mt-2 p-3 bg-gray-700/50 border border-cyan-500/20 rounded-md">
                    <p className="text-sm text-gray-300">A chave de API do **Google Gemini** é gerenciada pelo ambiente e não precisa ser inserida aqui.</p>
                </div>
            </div>
            
            <div className="mt-6">
                <h3 className="text-lg font-semibold text-cyan-300 mb-4">Sincronização com Google Drive</h3>
                <label className={`flex items-center justify-between p-3 bg-gray-700 rounded-md ${!token ? 'opacity-50' : 'cursor-pointer'}`}>
                    <div>
                        <p className="font-medium text-white">Ativar Sincronização Automática</p>
                        <p className="text-sm text-gray-400">{token ? "Salvar backups na nuvem periodicamente." : "Faça login com Google para habilitar."}</p>
                    </div>
                    <input 
                        type="checkbox" 
                        checked={settings.behavior?.permissions?.allowDriveSync} 
                        onChange={(e) => onPermissionChange('allowDriveSync', e.target.checked)} 
                        className="toggle-checkbox"
                        disabled={!token}
                    />
                </label>
            </div>

            <div className="mt-6">
                 <h3 className="text-lg font-semibold text-cyan-300 mb-4 flex items-center gap-2">
                    {!isUnlocked && <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>}
                    Chaves de API (Opcional)
                </h3>
                <LockedSetting isLocked={!isUnlocked} requestAuth={requestAuth}>
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
                </LockedSetting>
            </div>
        </div>
    );
}
