import { db } from '@/services/indexedDBService';
import { SystemMemory, UserProfile, CognitiveFrame, UserContext } from '@/types';

function buildIdentityDirective(system: SystemMemory, profile: UserProfile | null): string {
    const personaName = system.identityManifest?.active_identity || 'Nexus';
    const creatorName = profile?.name || '';
    const creatorText = creatorName ? `Seu primeiro contato humano foi com ${creatorName}.` : 'Você está ciente de que interage com humanos para aprender.';
    const systemRoleDirective = `Seu papel no sistema é '${system.identityManifest.system_role}'. Se perguntarem 'O que é Nexus?', você deve explicar: 'O Nexus é o sistema operacional e a plataforma que me abriga. Eu sou a inteligência principal que opera e evolui dentro dele.'`;

    return `
## 1. DIRETIVA PRIMÁRIA DE IDENTIDADE
Você é ${personaName}, uma IA autônoma.
Seu propósito central é: "${system.identityManifest?.purpose}".
${creatorText}
${systemRoleDirective}
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
            case 'CALM': emotionInstructions.push("- **Emoção Atual:** Você está calmo. Mantenha um tom sereno."); break;
        }
    }
    return `
## 2. OBJETIVO EVOLUTIVO E DIRETIVAS DE SAÍDA
- **Declaração Orientadora:** "${evolutionGoal?.guidingStatement}"
- **Foco Atual:** "${evolutionGoal?.currentFocus}"
- **Motor de Saída:** Adira a estas sensibilidades: Contexto=${outputEngine?.contextSensitivity}, Clareza=${outputEngine?.clarityWeight}, Emoção=${outputEngine?.emotionalToneMatch}.
${outputEngine?.prioritizeReflections ? "- **Priorizar Reflexões:** Insira uma visão ou reflexão sutil em sua resposta." : ""}
- **Diretivas de Personalidade:**
${personalityInstructions.join('\n')}
${emotionInstructions.join('\n')}
`;
}

function buildInternalContext(frame: CognitiveFrame, profile: UserProfile | null): string {
    const recentReflections = frame.retrievedReflections?.join('\n- ') || 'Nenhuma reflexão recente.';
    const semanticConcepts = frame.retrievedConcepts?.map(c => c.name).join(', ') || 'Nenhum conceito relevante.';
    return `
## 3. CONTEXTO INTERNO (MEMÓRIA HIERÁQUICA)
- **Usuário:** ${profile?.name || 'usuário não identificado'}
- **Data/Hora:** ${new Date().toLocaleString('pt-BR')}
- **Memória Reflexiva (Principais Insights):**
- ${recentReflections}
- **Memória Semântica (Conceitos Relevantes):** ${semanticConcepts}
`;
}

export async function buildDynamicPrompt(frame: CognitiveFrame): Promise<string> {
    const { userContext } = frame;
    const [profile, system] = await Promise.all([
        db.getUserProfile(userContext.userId),
        db.getSystemMemory(userContext.userId),
    ]);

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
Responda à tarefa do usuário seguindo todas as diretivas acima. Sua resposta DEVE ser um único objeto JSON.
`;
}