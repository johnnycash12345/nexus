import React from "react";

type Appearance = "neutral" | "feminine" | "masculine";

interface AppearanceSelectorProps {
  current: Appearance;
  onChange: (appearance: Appearance) => void;
}

export const AppearanceSelector: React.FC<AppearanceSelectorProps> = ({
  current,
  onChange,
}) => {
  const options: { label: string; value: Appearance }[] = [
    { label: "Neutro", value: "neutral" },
    { label: "Feminino", value: "feminine" },
    { label: "Masculino", value: "masculine" },
  ];

  return (
    <div className="flex gap-3 justify-center">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
            current === opt.value
              ? "bg-cyan-500 text-white shadow-md"
              : "bg-gray-700 hover:bg-gray-600 text-gray-300"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};
