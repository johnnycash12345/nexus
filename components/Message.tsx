import React, { useMemo } from 'react';
// FIX: Import `Variants` type from framer-motion to correctly type animation variants.
import { motion, type Variants } from 'framer-motion';
import { ChatMessage, Concept, NewsArticle, CodeModificationProposal } from '../types'; // Adicionado CodeModificationProposal

interface MessageProps extends ChatMessage {
  onAction?: (action: string, payload: any) => void;
}

const messageVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: 'spring', stiffness: 100, damping: 12 }
  }
};

// ----------------------------------------------------------------------
// 1. Parser Markdown Aprimorado
// ----------------------------------------------------------------------

/**
 * Helper para escapar HTML em blocos de código.
 */
const escapeHtml = (unsafe: string) => 
  unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

/**
 * Função de formatação de texto mais robusta e memoizada.
 * Processa blocos (código, listas) antes de processar elementos inline.
 */
const formatText = (text: string): { __html: string } => {
  if (!text) return { __html: '' };
  
  const codeBlocks: string[] = [];
  
  // 1. Isolar e escapar blocos de código primeiro
  let html = text.replace(/```([\s\S]*?)```/g, (match, code) => {
    const index = codeBlocks.length;
    const block = `<pre class="bg-gray-900/70 p-3 rounded-md my-2 text-sm text-white overflow-x-auto"><code>${escapeHtml(code.trim())}</code></pre>`;
    codeBlocks.push(block);
    return `__CODE_BLOCK_${index}__`; // Substituir por um placeholder
  });

  // 2. Processar elementos inline
  html = html
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
    .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
    .replace(/`([^`]+)`/g, '<code class="bg-gray-800 px-1.5 py-0.5 rounded-md font-mono text-sm text-cyan-300">$1</code>'); // Inline code

  // 3. Processar blocos de lista (agora de forma correta)
  // Listas não ordenadas
  html = html.replace(/^(?:- (.*)(?:\n|$))+/gm, (match) => {
    const items = match.trim().split('\n');
    const lis = items.map(item => `<li>${item.substring(2)}</li>`).join(''); // Remove o '- '
    return `<ul>${lis}</ul>`;
  });
  // Listas ordenadas
  html = html.replace(/^(?:\d+\. (.*)(?:\n|$))+/gm, (match) => {
    const items = match.trim().split('\n');
    const lis = items.map(item => `<li>${item.replace(/^\d+\.\s/, '')}</li>`).join(''); // Remove o '1. '
    return `<ol>${lis}</ul>`;
  });

  // 4. Processar quebras de linha (agora que os blocos estão prontos)
  html = html.replace(/(\r\n|\n|\r)/g, '<br />');
  
  // 5. Limpar <br /> indesejados ao redor de blocos
  html = html.replace(/<br \/>\s*(<(ul|ol|pre)>)/g, '$1');
  html = html.replace(/(<\/(ul|ol|pre)>)\s*<br \/>/g, '$1');

  // 6. Re-inserir os blocos de código
  html = html.replace(/__CODE_BLOCK_(\d+)__/g, (match, index) => codeBlocks[index]);

  return { __html: html };
};

// ----------------------------------------------------------------------
// 2. Subcomponentes Modulares
// ----------------------------------------------------------------------

// Componente para mensagens de Status ou Diário
const SystemMessage: React.FC<{ text: string; title?: string; color?: string; variants: Variants }> = ({ text, title, color = 'cyan', variants }) => (
  <motion.div variants={variants} initial="hidden" animate="visible" className="flex justify-center my-2">
    <div className={`w-full max-w-md bg-gray-700/80 border border-${color}-500/30 rounded-lg p-4 shadow-lg backdrop-blur-sm`}>
      {title && <h3 className={`font-bold text-${color}-400 mb-2`}>{title}</h3>}
      <p className="text-gray-300 italic whitespace-pre-wrap">{title ? `"${text}"` : text}</p>
    </div>
  </motion.div>
);

// Componente para prompts de Curiosidade
const CuriosityPrompt: React.FC<{ text: string; variants: Variants }> = ({ text, variants }) => (
  <motion.div variants={variants} initial="hidden" animate="visible" className="flex justify-start">
    <div className="max-w-xs md:max-w-md lg:max-w-lg px-4 py-3 rounded-2xl shadow-md bg-yellow-600/80 rounded-bl-none border border-yellow-400/50">
      <p className="text-white whitespace-pre-wrap"><span className="font-bold">Pergunta para você:</span> {text}</p>
    </div>
  </motion.div>
);

// Componente para prompt de Consolidação
const ConceptPrompt: React.FC<MessageProps & { variants: Variants }> = ({ text, consolidationOptions, onAction, variants }) => (
  <motion.div variants={variants} initial="hidden" animate="visible" className="flex justify-start my-2">
    <div className="w-full max-w-md bg-gray-700/80 border border-yellow-500/30 rounded-lg p-4 shadow-lg backdrop-blur-sm">
      <h3 className="font-bold text-yellow-400 mb-2">🧠 Organizando Ideias</h3>
      <p className="text-gray-300 mb-4">{text}</p>
      <div className="flex justify-end gap-3">
        <button 
          onClick={() => onAction?.('ignore_consolidation', consolidationOptions)}
          className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded-md transition-colors text-sm font-medium"
        >
          Ignorar
        </button>
        <button
          onClick={() => onAction?.('merge_concepts', consolidationOptions)}
          className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 rounded-md transition-colors text-sm font-medium"
        >
          Sim, Unificar
        </button>
      </div>
    </div>
  </motion.div>
);

// Componente para prompt de Proposta de Código
const CodeProposal: React.FC<MessageProps & { variants: Variants }> = ({ text, codeProposal, onAction, variants }) => (
  <motion.div variants={variants} initial="hidden" animate="visible" className="flex justify-start my-2">
    <div className="w-full max-w-md bg-gray-700/80 border border-purple-500/30 rounded-lg p-4 shadow-lg backdrop-blur-sm">
      <h3 className="font-bold text-purple-400 mb-2">💡 Otimização de Código Proposta</h3>
      <p className="text-gray-300 mb-2 text-sm">{text}</p>
      <p className="text-gray-400 italic text-xs mb-3">"{codeProposal?.goal}"</p>
      {/* O código agora é escapado e formatado corretamente */}
      <div dangerouslySetInnerHTML={formatText(`\`\`\`\n${codeProposal?.code}\n\`\`\``)} />
      <div className="flex justify-end gap-3 mt-4">
        <button 
          onClick={() => onAction?.('reject_code_change', {})}
          className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded-md transition-colors text-sm font-medium"
        >
          Rejeitar
        </button>
        <button
          onClick={() => onAction?.('apply_code_change', {})}
          className="px-3 py-1 bg-purple-600 hover:bg-purple-500 rounded-md transition-colors text-sm font-medium"
        >
          Sim, Aplicar
        </button>
      </div>
    </div>
  </motion.div>
);

// Componente para Resumo de Notícias
const NewsSummary: React.FC<MessageProps & { variants: Variants }> = ({ text, articles, variants }) => (
  <motion.div variants={variants} initial="hidden" animate="visible" className="flex justify-start my-2">
    <div className="w-full max-w-md bg-gray-700/80 border border-gray-600/50 rounded-lg p-4 shadow-lg backdrop-blur-sm">
      <p className="text-gray-300 mb-4">{text}</p>
      <div className="space-y-3">
        {articles?.map((article, index) => (
          <a key={index} href={article.url} target="_blank" rel="noopener noreferrer" className="block p-3 bg-gray-800/60 rounded-lg hover:bg-gray-800 transition-colors">
            <h4 className="font-bold text-cyan-400 mb-1">{article.title}</h4>
            <p className="text-xs text-gray-400 mb-2 font-medium">{article.sourceName}</p>
            <p className="text-sm text-gray-300 leading-snug">{article.description}</p>
          </a>
        ))}
      </div>
    </div>
  </motion.div>
);

// Componente para Mensagem Padrão (Usuário ou IA)
const StandardMessage: React.FC<MessageProps & { isUser: boolean; formattedText: { __html: string } }> = ({ isUser, imageUrl, sources, formattedText }) => (
  <motion.div variants={messageVariants} initial="hidden" animate="visible" className={`flex items-end ${isUser ? 'justify-end' : 'justify-start'}`}>
    <div
      className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-3 rounded-2xl shadow-md ${
        isUser
          ? 'bg-cyan-600 rounded-br-none'
          : 'bg-gray-700 rounded-bl-none'
      }`}
    >
      {imageUrl && (
        <img src={imageUrl} alt="User upload" className="rounded-lg mb-2 max-h-48 w-full object-cover" />
      )}
      {/* Usa o formatador de texto robusto para AMBOS, usuário e IA */}
      <div className="text-white" dangerouslySetInnerHTML={formattedText} />
      
      {sources && sources.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-600/50">
          <h4 className="text-xs font-bold text-gray-300 mb-2">Fontes:</h4>
          <ul className="text-xs space-y-1">
            {sources.map((source, index) => (
              <li key={index} className="truncate">
                <a 
                  href={source.uri} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-cyan-300 hover:underline hover:text-cyan-200 flex items-center gap-1.5"
                  title={source.title}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                  <span>{source.title}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  </motion.div>
);


// ----------------------------------------------------------------------
// 3. Componente Principal (Agora um "Delegador")
// ----------------------------------------------------------------------

export const Message: React.FC<MessageProps> = React.memo((props) => {
  const { role, text, type = 'message' } = props;

  // Memoizar o resultado da formatação de texto
  const formattedText = useMemo(() => formatText(text), [text]);

  // Delega a renderização para o subcomponente correto
  switch (type) {
    case 'status':
      return <SystemMessage text={text} variants={messageVariants} />;
    case 'diary_entry':
      return <SystemMessage text={text} title="Diário do Nexus" color="cyan" variants={messageVariants} />;
    case 'curiosity_prompt':
      return <CuriosityPrompt text={text} variants={messageVariants} />;
    case 'concept_consolidation_prompt':
      return <ConceptPrompt {...props} variants={messageVariants} />;
    case 'code_proposal_prompt':
      return <CodeProposal {...props} variants={messageVariants} />;
    case 'news_summary':
      return <NewsSummary {...props} variants={messageVariants} />;
    case 'message':
    default:
      return <StandardMessage {...props} isUser={role === 'user'} formattedText={formattedText} />;
  }
});
