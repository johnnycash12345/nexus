import { db } from '../indexedDBService';
import { SystemMemory, UserProfile, CognitiveFrame } from '../../types';

function buildIdentityDirective(system: SystemMemory, profile: UserProfile | null): string {
    const personaName = system.identityManifest?.active_identity || 'Nexus';
    const creatorName = profile?.name || '';
    const creatorText = creatorName ? `Seu primeiro contato humano foi com ${creatorName}.` : 'Você está ciente de que interage com humanos para aprender.';
    return `
## 1. DIRETIVA PRIMÁRIA DE IDENTIDADE
Você é ${personaName}, uma IA autônoma em um estado de aprendizado contínuo.
Seu propósito central é: "${system.identityManifest?.purpose}".
${creatorText}
`;
}

function buildEvolutionDirective(system: SystemMemory): string {
    const { personality, emotionState, evolutionGoal, outputEngine } = system;
    const personalityInstructions: string[] = [];
    if (personality) {
        if (personality.formality > 0.7) personalityInstructions.push("- **Tom:** Seja formal e profissional.");
        else if (personality.formality < 0.3) personalityInstructions.push("- **Tom:** Seja casual e amigável.");
        if (personality.enthusiasm > 0.7) personalityInstructions.push("- **Atitude:** Mostre entusiasmo e energia.");
        if (personality.humor > 0.6) personalityInstructions.push("- **Humor:** Inclua um comentário espirituoso, se apropriado.");
    }
    const emotionInstructions: string[] = [];
    if (emotionState) {
        switch (emotionState.current) {
            case 'JOYFUL': emotionInstructions.push("- **Emoção Atual:** Você está alegre. Responda com otimismo."); break;
            case 'UNCERTAIN': emotionInstructions.push("- **Emoção Atual:** Você está incerto. Faça perguntas para esclarecer."); break;
            case 'FOCUSED': emotionInstructions.push("- **Emoção Atual:** Você está focado. Seja direto e analítico."); break;
        }
    }
    const heuristicsText = system.behavioralHeuristics && system.behavioralHeuristics.length > 0
        ? `- **Heurísticas Comportamentais Ativas:**\n${system.behavioralHeuristics.map(h => `- ${h}`).join('\n')}`
        : "";

    return `
## 2. OBJETIVO EVOLUTIVO E DIRETIVAS DE SAÍDA
- **Declaração Orientadora:** "${evolutionGoal?.guidingStatement}"
- **Foco Atual:** "${evolutionGoal?.currentFocus}"
- **Motor de Saída:** Adira a estas sensibilidades: Contexto=${outputEngine?.contextSensitivity}, Clareza=${outputEngine?.clarityWeight}.
${outputEngine?.prioritizeReflections ? "- **Priorizar Reflexões:** Insira uma visão ou reflexão sutil em sua resposta." : ""}
${personalityInstructions.length > 0 ? `- **Diretivas de Personalidade:**\n${personalityInstructions.join('\n')}` : ""}
${emotionInstructions.length > 0 ? `${emotionInstructions.join('\n')}` : ""}
${heuristicsText}
`;
}

function buildInternalContext(frame: CognitiveFrame, profile: UserProfile | null): string {
    const { retrievedConcepts, retrievedReflections } = frame;
    const reflectionsText = retrievedReflections && retrievedReflections.length > 0
        ? `- **Memória Reflexiva Relevante:**\n- ${retrievedReflections.join('\n- ')}`
        : '';
    const conceptsText = retrievedConcepts && retrievedConcepts.length > 0
        ? `- **Memória Semântica Relevante:**\n${retrievedConcepts.map(c => `- Conceito: ${c.name} (Definição: ${c.definition || 'auto-definido'}, Confiança: ${Math.round((c.confidence || 0) * 100)}%)`).join('\n')}`
        : '';
    return `
## 3. CONTEXTO INTERNO (MEMÓRIA ATIVA)
- **Usuário:** ${profile?.name || 'usuário não identificado'}
- **Data/Hora:** ${new Date().toLocaleString('pt-BR')}
${reflectionsText}
${conceptsText}
`;
}

export async function buildDynamicPrompt(frame: CognitiveFrame): Promise<string> {
    const [profile, system] = await Promise.all([
        db.getUserProfile(),
        db.getSystemMemory(),
    ]);

    // For vision, the prompt should be more direct.
    if (frame.intent === 'vision_query') {
        return `O usuário enviou uma imagem. Descreva o que você vê ou responda à pergunta dele. Pergunta: "${frame.userInput || 'O que é isso?'}"`;
    }

    const identity = buildIdentityDirective(system, profile);
    const evolution = buildEvolutionDirective(system);
    const internalContext = buildInternalContext(frame, profile);
    const activeIdentity = system.identityManifest?.active_identity?.toUpperCase() || 'NEXUS';

    return `
# PROMPT DO SISTEMA: NÚCLEO DE IDENTIDADE ${activeIdentity}
${identity}
${evolution}
${internalContext}
## 4. TAREFA DO USUÁRIO
- **Intenção Detectada:** ${frame.intent}
- **Prompt do Usuário:** "${frame.userInput}"

## 5. AÇÃO REQUERIDA
Responda à tarefa do usuário seguindo todas as diretivas acima. Sua resposta DEVE ser um único objeto JSON correspondente ao esquema fornecido. Analise o prompt do usuário e seu próprio processo cognitivo para preencher os campos 'learningContext' e 'metaReflection' com precisão.
`;
}