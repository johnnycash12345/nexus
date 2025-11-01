import React from 'react';
import { AppSettings, Permissions } from '../../types';

// ----------------------------------------------------------------------
// Componente ToggleSetting (Interruptor)
// ----------------------------------------------------------------------
interface ToggleSettingProps {
    id: string;
    title: string;
    description: string;
    checked: boolean | undefined;
    onChange: (value: boolean) => void;
}

const ToggleSetting: React.FC<ToggleSettingProps> = ({ id, title, description, checked, onChange }) => (
    <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
        {/* Agrupa o texto e o torna clicável */}
        <label htmlFor={id} className="flex-grow cursor-pointer pr-4">
            <p className="font-medium text-white">{title}</p>
            <p className="text-sm text-gray-400">{description}</p>
        </label>
        {/* Contêiner do interruptor */}
        <div className="flex-shrink-0">
            <input 
                id={id} 
                type="checkbox" 
                checked={!!checked} 
                onChange={(e) => onChange(e.target.checked)} 
                className="sr-only peer" 
            />
            <label 
                htmlFor={id} 
                className="relative w-11 h-6 bg-gray-600 rounded-full cursor-pointer transition-colors
                           peer-checked:bg-cyan-500"
            >
                <span className="absolute left-[2px] top-[2px] w-5 h-5 bg-white rounded-full 
                               transition-transform duration-300 ease-in-out
                               peer-checked:translate-x-5"></span>
            </label>
        </div>
    </div>
);

// ----------------------------------------------------------------------
// Componente SliderSetting (Controle Deslizante)
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

// ----------------------------------------------------------------------
// Componente Principal (Layout de "Cards")
// ----------------------------------------------------------------------
interface BrainSettingsProps {
    settings: AppSettings;
    onNestedSettingChange: (field: keyof AppSettings, subField: string, value: any) => void;
    onPermissionChange: (field: keyof Permissions, value: boolean) => void;
}

export const BrainSettings: React.FC<BrainSettingsProps> = ({ settings, onNestedSettingChange, onPermissionChange }) => {
    return (
        // APRIMORAMENTO: Adicionado 'space-y-6' para espaçar os cards
        <div className="space-y-6">
            
            {/* Card 1: Comportamento e Personalidade */}
            <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                <h3 className="text-lg font-semibold text-cyan-300 mb-4">🧠 Comportamento e Personalidade</h3>
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
            </div>

            {/* Card 2: Evolução Autônoma */}
            <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                <h3 className="text-lg font-semibold text-cyan-300 mb-4">🧬 Evolução Autônoma</h3>
                <ToggleSetting
                    id="autoEvolutionEnabled"
                    title="Autoevolução Online"
                    description="Permitir que o Nexus aprenda e se aperfeiçoe sozinho."
                    checked={settings.behavior?.permissions?.autoEvolutionEnabled}
                    onChange={(v) => onPermissionChange('autoEvolutionEnabled', v)}
                />
            </div>
            
            {/* Card 3: Transparência */}
            <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                <h3 className="text-lg font-semibold text-cyan-300 mb-4">🪞 Transparência</h3>
                <ToggleSetting
                    id="transparencyMode"
                    title="Transparência Cognitiva"
                    description="Exibir todos os pensamentos e processos internos em tempo real."
                    checked={settings.behavior?.permissions?.transparencyMode}
                    onChange={(v) => onPermissionChange('transparencyMode', v)}
                />
            </div>

            {/* Card 4: Permissões Autônomas */}
            <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                <h3 className="text-lg font-semibold text-cyan-300 mb-4">🔑 Permissões Autônomas</h3>
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

            {/* Card 5: Parâmetros Cognitivos (Estilo já era de card, mantido) */}
            <div>
                <h3 className="text-lg font-semibold text-cyan-300 mb-4">⚙️ Parâmetros Cognitivos (Avançado)</h3>
                <div className="space-y-5 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                    <SliderSetting
                        id="emotional-intensity"
                        label="Intensidade Emocional"
                        displayValue={`(${(settings.cognitive?.emotionalIntensity ?? 1.0).toFixed(1)})`}
                        value={settings.cognitive?.emotionalIntensity}
                        min={0.5} max={1.5} step={0.1}
                        onChange={(v) => onNestedSettingChange('cognitive', 'emotionalIntensity', v)}
                    />
                    <SliderSetting
                        id="learning-rate"
                        label="Velocidade de Aprendizado"
                        displayValue={`(${(settings.cognitive?.learningRate ?? 1.0).toFixed(1)})`}
                        value={settings.cognitive?.learningRate}
                        min={0.5} max={2} step={0.1}
                        onChange={(v) => onNestedSettingChange('cognitive', 'learningRate', v)}
                    />
                    <SliderSetting
                        id="evolution-cycle"
                        label="Frequência do Ciclo de Evolução"
                        displayValue={`(${(settings.cognitive?.evolutionCycleHours ?? 6)}h)`}
                        value={settings.cognitive?.evolutionCycleHours}
                        min={1} max={24} step={1}
                        onChange={(v) => onNestedSettingChange('cognitive', 'evolutionCycleHours', v)}
                    />
                    <SliderSetting
                        id="evolution-confidence"
                        label="Confiança para Auto-Evolução"
                        displayValue={`(${((settings.cognitive?.evolutionConfidenceThreshold ?? 0.85) * 100).toFixed(0)}%)`}
                        value={settings.cognitive?.evolutionConfidenceThreshold}
                        min={0.5} max={1.0} step={0.05}
                        onChange={(v) => onNestedSettingChange('cognitive', 'evolutionConfidenceThreshold', v)}
                    />
                    <SliderSetting
                        id="memory-decay"
                        label="Decaimento da Memória"
                        displayValue={`(${(settings.cognitive?.memoryDecayHalfLifeDays ?? 30)} dias)`}
                        value={settings.cognitive?.memoryDecayHalfLifeDays}
                        min={7} max={90} step={1}
                        onChange={(v) => onNestedSettingChange('cognitive', 'memoryDecayHalfLifeDays', v)}
                    />
                </div>
            </div>
        </div>
    );
}