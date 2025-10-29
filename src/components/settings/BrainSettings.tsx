import React, { useState } from 'react';
import { AppSettings, Permissions } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';

interface ToggleSettingProps {
    id: string; title: string; description: string; checked: boolean | undefined;
    onChange: (value: boolean) => void;
}

const SettingsSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="mb-8">
        <h3 className="text-lg font-semibold text-cyan-300 mb-4 border-b border-gray-600 pb-2">{title}</h3>
        <div className="space-y-4">{children}</div>
    </section>
);

const ToggleSetting: React.FC<ToggleSettingProps> = ({ id, title, description, checked, onChange }) => (
    <label htmlFor={id} className="flex items-center justify-between p-3 bg-gray-900/50 hover:bg-gray-700/50 rounded-md cursor-pointer transition-colors">
        <div>
            <p className="font-medium text-white">{title}</p>
            <p className="text-sm text-gray-400">{description}</p>
        </div>
        <input id={id} type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="toggle-checkbox" />
    </label>
);

interface BrainSettingsProps {
    settings: AppSettings;
    setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
}

export const BrainSettings: React.FC<BrainSettingsProps> = ({ settings, setSettings }) => {
    const [isAdvancedVisible, setIsAdvancedVisible] = useState(false);
    
    const handleNestedSettingChange = (field: keyof AppSettings, subField: string, value: any) => {
        setSettings(prev => ({
            ...prev, [field]: { ...(prev[field] as object), [subField]: value },
        }));
    };

    const handlePermissionChange = (field: keyof Permissions, value: boolean) => {
        setSettings(prev => ({
            ...prev, behavior: { ...prev.behavior, permissions: { ...prev.behavior.permissions, [field]: value } }
        }));
    };

    return (
        <div className="max-w-xl mx-auto">
            <style>{`.toggle-checkbox{appearance:none;width:40px;height:20px;background-color:#4a5568;border-radius:10px;position:relative;cursor:pointer;transition:background-color .2s}.toggle-checkbox:checked{background-color:#22d3ee}.toggle-checkbox::before{content:'';position:absolute;width:16px;height:16px;background-color:#fff;border-radius:50%;top:2px;left:2px;transition:transform .2s}.toggle-checkbox:checked::before{transform:translateX(20px)}`}</style>
            
            <SettingsSection title="Comportamento e Personalidade">
                <ToggleSetting id="enableProactive" title="Iniciativa Proativa" description="Permitir que o Nexus inicie conversas." checked={settings.behavior?.enableProactive} onChange={(v) => handleNestedSettingChange('behavior', 'enableProactive', v)} />
                <ToggleSetting id="enableCuriosity" title="Curiosidade Autônoma" description="Permitir que o Nexus faça perguntas quando ocioso." checked={settings.behavior?.enableCuriosity} onChange={(v) => handleNestedSettingChange('behavior', 'enableCuriosity', v)} />
                <ToggleSetting id="enableDiary" title="Diário de Bordo" description="Habilitar o Nexus para manter um diário sobre as interações." checked={settings.behavior?.enableDiary} onChange={(v) => handleNestedSettingChange('behavior', 'enableDiary', v)} />
                <ToggleSetting id="enableReflection" title="Reflexão Automática de Fundo" description="Permitir que o Nexus reflita sobre conversas passadas para aprender." checked={settings.behavior?.enableReflection} onChange={(v) => handleNestedSettingChange('behavior', 'enableReflection', v)} />
            </SettingsSection>

            <SettingsSection title="Permissões Autônomas">
                <ToggleSetting id="autoEvolutionEnabled" title="🧬 Autoevolução Online" description="Permitir que o Nexus aprenda e se aperfeiçoe sozinho." checked={settings.behavior?.permissions?.autoEvolutionEnabled} onChange={(v) => handlePermissionChange('autoEvolutionEnabled', v)} />
                <ToggleSetting id="allowApiAccess" title="Acesso a APIs Externas" description="Permitir que o Nexus use APIs como a de notícias e buscas." checked={settings.behavior?.permissions?.allowApiAccess} onChange={(v) => handlePermissionChange('allowApiAccess', v)} />
                <ToggleSetting id="allowSelfModification" title="Auto-modificação da Memória" description="Permitir que o Nexus organize e evolua sua memória." checked={settings.behavior?.permissions?.allowSelfModification} onChange={(v) => handlePermissionChange('allowSelfModification', v)} />
                <ToggleSetting id="transparencyMode" title="🪞 Modo Mente Aberta (Logs Detalhados)" description="Exibir todos os pensamentos e processos internos em tempo real." checked={settings.behavior?.permissions?.transparencyMode} onChange={(v) => handlePermissionChange('transparencyMode', v)} />
            </SettingsSection>
            
            <SettingsSection title="Parâmetros Cognitivos">
                 <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                    <button onClick={() => setIsAdvancedVisible(!isAdvancedVisible)} className="flex justify-between items-center w-full text-left">
                        <h4 className="font-semibold text-white">Configurações Avançadas</h4>
                        <svg className={`w-5 h-5 text-gray-400 transition-transform ${isAdvancedVisible ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    <AnimatePresence>
                    {isAdvancedVisible && (
                        <motion.div initial={{ opacity: 0, height: 0, marginTop: 0 }} animate={{ opacity: 1, height: 'auto', marginTop: '16px' }} exit={{ opacity: 0, height: 0, marginTop: 0 }} className="overflow-hidden">
                            <div className="space-y-4 pt-4 border-t border-gray-700">
                                <div>
                                    <label htmlFor="learning-model" className="block text-sm font-medium text-gray-300 mb-1">Modelo para Aprendizado</label>
                                    <select id="learning-model" value={settings.cognitive?.learningModel || 'gemini-2.5-flash'} onChange={(e) => handleNestedSettingChange('cognitive', 'learningModel', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500">
                                        <option value="gemini-2.5-flash">Gemini Flash (Rápido e Eficiente)</option>
                                        <option value="gemini-2.5-pro">Gemini Pro (Análise Profunda)</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="reflection-frequency" className="block text-sm font-medium text-gray-300 mb-1">Frequência de Reflexão ({settings.cognitive?.reflectionFrequencyMinutes} min)</label>
                                    <input id="reflection-frequency" type="range" min="1" max="60" step="1" value={settings.cognitive?.reflectionFrequencyMinutes || 10} onChange={(e) => handleNestedSettingChange('cognitive', 'reflectionFrequencyMinutes', parseInt(e.target.value, 10))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                                </div>
                                <div>
                                    <label htmlFor="emotional-intensity" className="block text-sm font-medium text-gray-300 mb-1">Intensidade Emocional ({settings.cognitive?.emotionalIntensity.toFixed(1)})</label>
                                    <input id="emotional-intensity" type="range" min="0.5" max="1.5" step="0.1" value={settings.cognitive?.emotionalIntensity || 1.0} onChange={(e) => handleNestedSettingChange('cognitive', 'emotionalIntensity', parseFloat(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                                </div>
                                <div>
                                    <label htmlFor="learning-rate" className="block text-sm font-medium text-gray-300 mb-1">Velocidade de Aprendizado ({settings.cognitive?.learningRate.toFixed(1)})</label>
                                    <input id="learning-rate" type="range" min="0.5" max="2" step="0.1" value={settings.cognitive?.learningRate || 1.0} onChange={(e) => handleNestedSettingChange('cognitive', 'learningRate', parseFloat(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                                </div>
                                <div>
                                    <label htmlFor="evolution-cycle" className="block text-sm font-medium text-gray-300 mb-1">Frequência da Evolução ({settings.cognitive?.evolutionCycleHours}h)</label>
                                    <input id="evolution-cycle" type="range" min="1" max="24" step="1" value={settings.cognitive?.evolutionCycleHours || 6} onChange={(e) => handleNestedSettingChange('cognitive', 'evolutionCycleHours', parseInt(e.target.value, 10))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                                </div>
                            </div>
                        </motion.div>
                    )}
                    </AnimatePresence>
                 </div>
            </SettingsSection>
        </div>
    );
}