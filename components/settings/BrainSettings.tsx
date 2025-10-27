
import React from 'react';
import { AppSettings, Permissions } from '../../types';

interface BrainSettingsProps {
  settings: AppSettings;
  onNestedSettingChange: (field: keyof AppSettings, subField: string, value: any) => void;
  onPermissionChange: (field: keyof Permissions, value: boolean) => void;
}

export const BrainSettings: React.FC<BrainSettingsProps> = ({ settings, onNestedSettingChange, onPermissionChange }) => {
    return (
        <div>
            <h3 className="text-lg font-semibold text-cyan-300 mb-4">Comportamento e Personalidade</h3>
            <div className="space-y-3">
                <label className="flex items-center justify-between p-3 bg-gray-700 rounded-md cursor-pointer">
                    <div>
                        <p className="font-medium text-white">Iniciativa Proativa</p>
                        <p className="text-sm text-gray-400">Permitir que o Nexus inicie conversas.</p>
                    </div>
                    <input type="checkbox" checked={settings.behavior?.enableProactive} onChange={(e) => onNestedSettingChange('behavior', 'enableProactive', e.target.checked)} className="toggle-checkbox" />
                </label>
                <label className="flex items-center justify-between p-3 bg-gray-700 rounded-md cursor-pointer">
                    <div>
                        <p className="font-medium text-white">Curiosidade Autônoma</p>
                        <p className="text-sm text-gray-400">Permitir que o Nexus faça perguntas quando ocioso.</p>
                    </div>
                    <input type="checkbox" checked={settings.behavior?.enableCuriosity} onChange={(e) => onNestedSettingChange('behavior', 'enableCuriosity', e.target.checked)} className="toggle-checkbox" />
                </label>
                <label className="flex items-center justify-between p-3 bg-gray-700 rounded-md cursor-pointer">
                    <div>
                        <p className="font-medium text-white">Diário e Reflexões</p>
                        <p className="text-sm text-gray-400">Habilitar o Nexus para manter um diário sobre as interações.</p>
                    </div>
                    <input type="checkbox" checked={settings.behavior?.enableDiary} onChange={(e) => onNestedSettingChange('behavior', 'enableDiary', e.target.checked)} className="toggle-checkbox" />
                </label>
            </div>

            <div className="mt-6">
                <h3 className="text-lg font-semibold text-cyan-300 mb-4">Permissões Autônomas</h3>
                <div className="space-y-3">
                    <label className="flex items-center justify-between p-3 bg-gray-700 rounded-md cursor-pointer">
                        <div>
                            <p className="font-medium text-white">Acesso a APIs Externas</p>
                            <p className="text-sm text-gray-400">Permitir que o Nexus use APIs como a de notícias.</p>
                        </div>
                        <input type="checkbox" checked={settings.behavior?.permissions?.allowApiAccess} onChange={(e) => onPermissionChange('allowApiAccess', e.target.checked)} className="toggle-checkbox" />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-gray-700 rounded-md cursor-pointer">
                        <div>
                            <p className="font-medium text-white">Decisões Autônomas</p>
                            <p className="text-sm text-gray-400">Permitir que o Nexus inicie ações (ex: curiosidade).</p>
                        </div>
                        <input type="checkbox" checked={settings.behavior?.permissions?.allowAutonomousDecision} onChange={(e) => onPermissionChange('allowAutonomousDecision', e.target.checked)} className="toggle-checkbox" />
                    </label>
                    <label className="flex items-center justify-between p-3 bg-gray-700 rounded-md cursor-pointer">
                        <div>
                            <p className="font-medium text-white">Auto-modificação da Memória</p>
                            <p className="text-sm text-gray-400">Permitir que o Nexus organize sua memória sem perguntar.</p>
                        </div>
                        <input type="checkbox" checked={settings.behavior?.permissions?.allowSelfModification} onChange={(e) => onPermissionChange('allowSelfModification', e.target.checked)} className="toggle-checkbox" />
                    </label>
                </div>
            </div>

            <div className="mt-6">
                <h3 className="text-lg font-semibold text-cyan-300 mb-4">Parâmetros Cognitivos (Avançado)</h3>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="emotional-intensity" className="block text-sm font-medium text-gray-300 mb-1">Intensidade Emocional ({settings.cognitive?.emotionalIntensity.toFixed(1)})</label>
                        <input id="emotional-intensity" type="range" min="0.5" max="1.5" step="0.1" value={settings.cognitive?.emotionalIntensity || 1.0} onChange={(e) => onNestedSettingChange('cognitive', 'emotionalIntensity', parseFloat(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                    </div>
                    <div>
                        <label htmlFor="learning-rate" className="block text-sm font-medium text-gray-300 mb-1">Velocidade de Aprendizado ({settings.cognitive?.learningRate.toFixed(1)})</label>
                        <input id="learning-rate" type="range" min="0.5" max="2" step="0.1" value={settings.cognitive?.learningRate || 1.0} onChange={(e) => onNestedSettingChange('cognitive', 'learningRate', parseFloat(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                    </div>
                </div>
            </div>
        </div>
    );
}
