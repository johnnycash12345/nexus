import React from "react";

// Tipagem de Aparência (mantida, mas exportada para reutilização)
export type Appearance = "neutral" | "feminine" | "masculine";

// Definição da interface de props (mantida)
interface AppearanceSelectorProps {
  /** A aparência selecionada atualmente. */
  current: Appearance;
  /** Função de callback chamada quando a aparência muda. */
  onChange: (appearance: Appearance) => void;
  /** Rótulo opcional para o grupo de botões (melhora a acessibilidade). */
  label?: string;
}

// ----------------------------------------------------------------------
// Configuração das Opções (Movida para fora para clareza e imutabilidade)
// ----------------------------------------------------------------------

interface Option {
  label: string;
  value: Appearance;
  icon: string; // Adicionando um ícone (emoji ou string de ícone)
  colorClass: string; // Classe base de cor
}

const APPEARANCE_OPTIONS: Option[] = [
  {
    label: "Neutro",
    value: "neutral",
    icon: "👤",
    colorClass: "bg-gray-700 hover:bg-gray-600 border-gray-500",
  },
  {
    label: "Feminino",
    value: "feminine",
    icon: "♀️",
    colorClass: "bg-pink-700 hover:bg-pink-600 border-pink-500",
  },
  {
    label: "Masculino",
    value: "masculine",
    icon: "♂️",
    colorClass: "bg-blue-700 hover:bg-blue-600 border-blue-500",
  },
];

// ----------------------------------------------------------------------
// Componente Principal Aprimorado
// ----------------------------------------------------------------------

export const AppearanceSelector: React.FC<AppearanceSelectorProps> = ({
  current,
  onChange,
  label = "Selecione a Aparência",
}) => {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col items-center p-4 bg-gray-800 rounded-xl shadow-lg">
      
      {/* Rótulo superior */}
      <p className="text-gray-300 text-base font-medium mb-3">{label}</p>

      {/* Container dos botões */}
      <div className="flex space-x-4">
        {APPEARANCE_OPTIONS.map((opt) => {
          const isSelected = current === opt.value;
          
          // Estilos de seleção dinâmicos
          const baseStyles = "flex flex-col items-center justify-center p-4 w-24 h-24 rounded-lg cursor-pointer border-2 transition-all duration-200";
          const activeStyles = `shadow-xl ${opt.colorClass} border-opacity-100 transform scale-105 ring-4 ring-offset-2 ring-offset-gray-800 ring-opacity-70`;
          const inactiveStyles = `${opt.colorClass.replace(/bg-\w+-\d+/g, 'bg-opacity-50')} border-opacity-50 opacity-80 hover:opacity-100`;

          return (
            <button
              key={opt.value}
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(opt.value)}
              className={`${baseStyles} ${isSelected ? activeStyles : inactiveStyles}`}
            >
              {/* Ícone */}
              <span className="text-3xl mb-1" aria-hidden="true">{opt.icon}</span>
              
              {/* Rótulo */}
              <span className="text-sm font-semibold text-white mt-1">
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
      
      {/* Feedback Visual Opcional */}
      <p className="text-xs text-gray-500 mt-3">
        Atual: <span className="text-cyan-400 font-bold">{current.charAt(0).toUpperCase() + current.slice(1)}</span>
      </p>
    </div>
  );
};