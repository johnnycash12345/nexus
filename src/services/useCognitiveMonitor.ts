import { useState, useEffect } from 'react';
import { cognitiveMonitor, type MonitorState } from '../services/CognitiveMonitorService';

/**
 * Hook customizado que assina o CognitiveMonitorService
 * e atualiza o estado do componente de forma segura.
 */
export function useCognitiveMonitor(limit?: number): MonitorState {
  
  // O `useState` com função garante que o `getState` 
  // é chamado apenas na primeira renderização.
  const [state, setState] = useState(() => cognitiveMonitor.getState(limit));

  useEffect(() => {
    // 1. Inscreve-se para mudanças quando o componente é montado.
    const unsubscribe = cognitiveMonitor.subscribe(() => {
      // 2. Quando o serviço notifica, o componente atualiza seu estado.
      setState(cognitiveMonitor.getState(limit));
    });

    // 3. [AQUI ESTÁ A CORREÇÃO DO ERRO #306]
    // Quando o componente é desmontado (ex: modal fechado), 
    // a função de limpeza do useEffect é chamada, o que executa o `unsubscribe`.
    // O serviço não tentará mais notificar este componente,
    // e o `setState` acima nunca será chamado em um componente desmontado.
    return unsubscribe;
    
  }, [limit]); // Recria a inscrição se o 'limit' mudar

  return state;
}

// ---------------------------------------------------
// Em seu componente de UI (ex: um painel de monitoramento):
//
// import { useCognitiveMonitor } from '../hooks/useCognitiveMonitor';
//
// const MonitorPanel = () => {
//   // O hook cuida de tudo: pegar o estado e se manter atualizado.
//   const { thoughts, isEnabled } = useCognitiveMonitor();
//
//   if (!isEnabled) return null;
//
//   return (
//     <div>
//       <h3>Pensamentos do Sistema</h3>
//       <ul>
//         {thoughts.map(t => <li key={t.timestamp}>{t.data}</li>)}
//       </ul>
//     </div>
//   );
// }