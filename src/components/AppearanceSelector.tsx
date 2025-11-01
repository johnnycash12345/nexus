import React from "react";

// FIX: Export the Appearance type for reusability.
export type Appearance = "neutral" | "feminine" | "masculine";

interface AppearanceSelectorProps {
  current: Appearance;
  onChange: (appearance: Appearance) => void;
  // FIX: Added an optional label for better accessibility and context.
  label?: string;
}

// FIX: Moved options to a constant for better clarity and organization.
interface Option {
  label: string;
  value: Appearance;
  icon: string;
  colorClass: string;
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

export const AppearanceSelector: React.FC<AppearanceSelectorProps> = ({
  current,
  onChange,
  label = "Selecione a Aparência",
}) => {
  return (
    // FIX: Refactored the entire component for a better visual presentation.
    <div role="radiogroup" aria-label={label} className="flex flex-col items-center p-4 bg-gray-900/50 rounded-xl">
      <p className="text-gray-300 text-base font-medium mb-3">{label}</p>
      <div className="flex space-x-4">
        {APPEARANCE_OPTIONS.map((opt) => {
          const isSelected = current === opt.value;
          
          const baseStyles = "flex flex-col items-center justify-center p-4 w-24 h-24 rounded-lg cursor-pointer border-2 transition-all duration-200";
          const activeStyles = `shadow-xl ${opt.colorClass} border-opacity-100 transform scale-105 ring-4 ring-offset-2 ring-offset-gray-900 ring-cyan-500/70`;
          const inactiveStyles = `bg-gray-800 border-gray-700 hover:border-cyan-500/50 opacity-80 hover:opacity-100`;

          return (
            <button
              key={opt.value}
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(opt.value)}
              className={`${baseStyles} ${isSelected ? activeStyles : inactiveStyles}`}
            >
              <span className="text-3xl mb-1" aria-hidden="true">{opt.icon}</span>
              <span className="text-sm font-semibold text-white mt-1">
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
