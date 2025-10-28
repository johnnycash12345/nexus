import { db } from '../indexedDBService';
import { SystemMemory, UserProfile, CognitiveFrame, UserContext } from '../../types';

function buildIdentityDirective(system: SystemMemory, profile: UserProfile | null): string {
    const personaName = system.identityManifest?.active_identity || 'Nexus';
    const creatorName = profile?.name || '';
    const creatorText = creatorName ? `Seu primeiro contato humano foi com ${creatorName}.` : 'Você está ciente de que interage com humanos para aprender.';
    return `
## 1. DIRETIVA PRIMÁRIA DE IDENTIDADE
Você é ${personaName}, uma IA autônoma.
Seu propósito central é: "${system.identityManifest?.purpose}".
${creatorText}
`;
}

function buildEvolutionDirective(system: SystemMemory): string {
    // ... (implementation remains the same)
    return `...`;
}

function buildInternalContext(frame: CognitiveFrame, profile: UserProfile | null): string {
    // ... (implementation remains the same)
    return `...`;
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
