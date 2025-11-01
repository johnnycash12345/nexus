// ---------------------------------------------------------------------------
// 🧠 LUMEN / NEXUS - ENTRY POINT (index.tsx)
// Arquivo principal de inicialização do Front-end React (React 18+)
// ---------------------------------------------------------------------------

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// ✅ Verificação robusta do container principal
const container = document.getElementById('root');
if (!container) {
  console.error('[NEXUS-CORE] ❌ Elemento raiz não encontrado. Verifique se o index.html contém <div id="root"></div>.');
  throw new Error('Elemento root não encontrado.');
}

// ✅ Criação do root React 18+
const root = createRoot(container);

// 🌍 Log de inicialização (útil para diagnóstico do build)
console.log('%c[NEXUS-CORE] 🧭 Iniciando ciclo cognitivo...', 'color:#00d4ff; font-weight:bold;');
console.log('%c[React] Ambiente inicializado com sucesso ✅', 'color:#22cc88;');

// ✅ Renderização com modo estrito + fallback visual de inicialização
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// ---------------------------------------------------------------------------
// 🛡️ Mecanismo de proteção contra erros globais
// ---------------------------------------------------------------------------
window.addEventListener('error', (event) => {
  console.error('[NEXUS-GLOBAL] Erro não capturado:', event.message, event.filename, event.lineno);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[NEXUS-GLOBAL] Promessa rejeitada sem tratamento:', event.reason);
});
