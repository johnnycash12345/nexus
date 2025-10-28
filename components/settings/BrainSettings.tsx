

import React from 'react';
import { AppSettings, Permissions } from '../../types';

interface ToggleSettingProps {
    id: string;
    title: string;
    description: string;
    checked: boolean | undefined;
    onChange: (value: boolean) => void;
}

const ToggleSetting: React.FC<ToggleSettingProps> = ({ id, title, description, checked, onChange }) => (
    <label htmlFor={id} className="flex items-center justify-between p-3 bg-gray-700 rounded-md cursor-pointer">
        <div>
            <p className="font-medium text-white">{title}</p>
            <p className="text-sm text-gray-400">{description}</p>
        </div>
        <input id={id} type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="toggle-checkbox" />
    </label>
);

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
                <ToggleSetting
                    id="enableProactive"
                    title="Iniciativa Proativa"
                    description="Permitir que o Nexus inicie conversas."
                    checked={settings.behavior?.enableProactive}
                    onChange={(v) => onNestedSettingChange('behavior', 'enableProactive', v)}
                />
                 <ToggleSetting
                    id="enableCuriosity"
                    title="Curiosidade Autônoma"
                    description="Permitir que o Nexus faça perguntas quando ocioso."
                    checked={settings.behavior?.enableCuriosity}
                    onChange={(v) => onNestedSettingChange('behavior', 'enableCuriosity', v)}
                />
                <ToggleSetting
                    id="enableDiary"
                    title="Diário e Reflexões"
                    description="Habilitar o Nexus para manter um diário sobre as interações."
                    checked={settings.behavior?.enableDiary}
                    onChange={(v) => onNestedSettingChange('behavior', 'enableDiary', v)}
                />
            </div>

            <div className="mt-6">
                <h3 className="text-lg font-semibold text-cyan-300 mb-4">Evolução Autônoma</h3>
                 <ToggleSetting
                    id="autoEvolutionEnabled"
                    title="🧬 Autoevolução Online"
                    description="Permitir que o Nexus aprenda e se aperfeiçoe sozinho."
                    checked={settings.behavior?.permissions?.autoEvolutionEnabled}
                    onChange={(v) => onPermissionChange('autoEvolutionEnabled', v)}
                />
            </div>
            
            <div className="mt-6">
                 <h3 className="text-lg font-semibold text-cyan-300 mb-4">Transparência</h3>
                 <ToggleSetting
                    id="transparencyMode"
                    title="🪞 Transparência Cognitiva"
                    description="Exibir todos os pensamentos e processos internos em tempo real."
                    checked={settings.behavior?.permissions?.transparencyMode}
                    onChange={(v) => onPermissionChange('transparencyMode', v)}
                />
            </div>

            <div className="mt-6">
                <h3 className="text-lg font-semibold text-cyan-300 mb-4">Permissões Autônomas</h3>
                <div className="space-y-3">
                    <ToggleSetting
                        id="allowApiAccess"
                        title="Acesso a APIs Externas"
                        description="Permitir que o Nexus use APIs como a de notícias."
                        checked={settings.behavior?.permissions?.allowApiAccess}
                        onChange={(v) => onPermissionChange('allowApiAccess', v)}
                    />
                    <ToggleSetting
                        id="allowAutonomousDecision"
                        title="Decisões Autônomas"
                        description="Permitir que o Nexus inicie ações (ex: curiosidade)."
                        checked={settings.behavior?.permissions?.allowAutonomousDecision}
                        onChange={(v) => onPermissionChange('allowAutonomousDecision', v)}
                    />
                    <ToggleSetting
                        id="allowSelfModification"
                        title="Auto-modificação da Memória"
                        description="Permitir que o Nexus organize e evolua sua memória."
                        checked={settings.behavior?.permissions?.allowSelfModification}
                        onChange={(v) => onPermissionChange('allowSelfModification', v)}
                    />
                </div>
            </div>

            <div className="mt-6">
                <h3 className="text-lg font-semibold text-cyan-300 mb-4">Parâmetros Cognitivos (Avançado)</h3>
                <div className="space-y-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                    <div>
                        <label htmlFor="emotional-intensity" className="block text-sm font-medium text-gray-300 mb-1">Intensidade Emocional ({settings.cognitive?.emotionalIntensity.toFixed(1)})</label>
                        <input id="emotional-intensity" type="range" min="0.5" max="1.5" step="0.1" value={settings.cognitive?.emotionalIntensity || 1.0} onChange={(e) => onNestedSettingChange('cognitive', 'emotionalIntensity', parseFloat(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                    </div>
                    <div>
                        <label htmlFor="learning-rate" className="block text-sm font-medium text-gray-300 mb-1">Velocidade de Aprendizado ({settings.cognitive?.learningRate.toFixed(1)})</label>
                        <input id="learning-rate" type="range" min="0.5" max="2" step="0.1" value={settings.cognitive?.learningRate || 1.0} onChange={(e) => onNestedSettingChange('cognitive', 'learningRate', parseFloat(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                    </div>
                     <div>
                        <label htmlFor="evolution-cycle" className="block text-sm font-medium text-gray-300 mb-1">Frequência do Ciclo de Evolução ({settings.cognitive?.evolutionCycleHours}h)</label>
                        <input id="evolution-cycle" type="range" min="1" max="24" step="1" value={settings.cognitive?.evolutionCycleHours || 6} onChange={(e) => onNestedSettingChange('cognitive', 'evolutionCycleHours', parseInt(e.target.value, 10))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                    </div>
                     <div>
                        <label htmlFor="evolution-confidence" className="block text-sm font-medium text-gray-300 mb-1">Confiança para Auto-Evolução ({(settings.cognitive?.evolutionConfidenceThreshold * 100).toFixed(0)}%)</label>
                        <input id="evolution-confidence" type="range" min="0.5" max="1.0" step="0.05" value={settings.cognitive?.evolutionConfidenceThreshold || 0.85} onChange={(e) => onNestedSettingChange('cognitive', 'evolutionConfidenceThreshold', parseFloat(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                    </div>
                    <div>
                        <label htmlFor="memory-decay" className="block text-sm font-medium text-gray-300 mb-1">Decaimento da Memória ({settings.cognitive?.memoryDecayHalfLifeDays} dias)</label>
                        <input id="memory-decay" type="range" min="7" max="90" step="1" value={settings.cognitive?.memoryDecayHalfLifeDays || 30} onChange={(e) => onNestedSettingChange('cognitive', 'memoryDecayHalfLifeDays', parseInt(e.target.value, 10))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                    </div>
                </div>
            </div>
        </div>
    );
}
