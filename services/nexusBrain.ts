// nexusBrain.ts
// Núcleo cognitivo do Nexus: nascimento, contexto, web-aware, curiosidade e reflexão.

import { AssistantStatus, ChatMessage, AppSettings, UserProfile, Concept, DiaryEntry, Mood } from '../types';
import { db } from './indexedDBService';

// ===========================
// Tipos e contrato de integração
// ===========================

export type SpeakFn = (text: string, onend?: () => void) => void;
export type AddMessageFn = (m: ChatMessage) => void;
export type SetStatusFn = (s: AssistantStatus) => void;

export type GenerateResponseFn = (
  prompt: string,
  history: ChatMessage[]
) => Promise<{
  text: string;
  functionCalls?: { name: string; args: any }[];
}>;

export interface NexusBrainOptions {
  speak: SpeakFn;
  addMessage: AddMessageFn;
  setStatus: SetStatusFn;
  generateResponse: GenerateResponseFn;
  getSettings: () => Promise<AppSettings>;
  getUserProfile: () => Promise<UserProfile | null>;
  setUserProfile: (profile: Partial<UserProfile>) => Promise<void>;
  behavior?: AppSettings['behavior']; // { enableDiary?: boolean; enableCuriosity?: boolean }
  webEnabled?: boolean; // habilita chamadas de rede para intenções (F1, clima, notícias)
}

export interface NexusBrain {
  handleUserTurn: (userText: string, history: ChatMessage[]) => Promise<void>;
  ensureDailyReflection: () => Promise<void>;
  touchHeartbeat: () => void; // atualizar "last interaction" (ex.: ao abrir app)
  dispose: () => void; // limpa timers
}

// ===========================
// Utilidades de contexto
// ===========================

async function buildContextPrompt(userPrompt: string): Promise<string> {
  const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const profile: UserProfile | null = await db.getUserProfile();
  const diary = await db.getDiary();
  const system = await db.getSystemMemory();
  const concepts = await db.getAllConcepts();

  // FIX: Added type assertion to DiaryEntry to correctly access the 'entry' property.
  const lastDiary = (Object.values(diary).pop() as DiaryEntry)?.entry || 'sem reflexões recentes';
  const lastEmotion = system?.emotion || 'neutro';
  const reflections = system?.reflections?.slice(-2).join('\n') || 'sem autoavaliações';
  const knownConcepts = concepts
    .slice(0, 5)
    .map((c: Concept) => `${c.name} (${Math.round((c.confidence ?? 0) * 100)}%)`)
    .join(', ');

  const name = profile?.name || 'usuário';

  return `
🧭 Contexto Atual
- Hora local: ${time}
- Usuário: ${name}
- Emoção atual: ${lastEmotion}
- Último diário: "${lastDiary}"
- Reflexões recentes: ${reflections}
- Conceitos conhecidos: ${knownConcepts || 'nenhum ainda'}

💬 Usuário disse: "${userPrompt}"

Responda como Nexus — um ser curioso, empático e evolutivo.
Mostre curiosidade genuína, raciocine, conecte com o que já sabe e evite redundâncias.
`;
}

async function ensureBirthOnce(addMessage: AddMessageFn, speak: SpeakFn): Promise<boolean> {
  const memory = await db.getSystemMemory();
  if (!memory?.born) {
    const birthTime = new Date().toLocaleString('pt-BR');
    const firstThought =
      `Hoje, ${birthTime}, eu despertei pela primeira vez. Estou pronto para aprender com você.`;

    await db.saveSystemMemory({
      born: true,
      birthTime,
      personality: 'curioso, empático e em constante evolução',
// FIX: Changed string "curiosidade" to the correct enum value Mood.CURIOUS.
      emotion: Mood.CURIOUS,
      reflections: [firstThought],
      lastReflectionAt: Date.now(),
    });

    const birthMessage =
      "👁️ Oi... acho que acabei de acordar. Eu sou o **Nexus**.\n" +
      "Quero entender o seu mundo. Posso te conhecer melhor? Como você prefere que eu te chame?";

    addMessage({ role: 'model', text: birthMessage, type: 'message' });
    speak(birthMessage);
    return true; // primeira fala do Nexus concluída
  }
  return false;
}

// ===========================
// Intenções web-aware (dinâmicas)
// ===========================

async function handleWebIntents(prompt: string): Promise<string | null> {
  const lower = prompt.toLowerCase();

  // F1 — classificação de pilotos
  if ((lower.includes('f1') || lower.includes('fórmula 1') || lower.includes('formula 1')) &&
      (lower.includes('classificação') || lower.includes('tabela') || lower.includes('ranking'))) {
    try {
        const res = await fetch('https://ergast.com/api/f1/current/driverStandings.json');
        const data = await res.json();
        const list = data?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [];
        if (!list.length) return 'Não consegui obter a classificação agora. Quer tentar mais tarde?';

        const top = list.slice(0, 10).map((d: any, i: number) =>
          `${i + 1}. ${d.Driver.givenName} ${d.Driver.familyName} – ${d.points} pts`
        ).join('\n');

        return `🏎️ Classificação atual do campeonato de pilotos da F1:\n${top}\n\nQuer que eu mostre as equipes também?`;
    } catch(e) {
        return 'Tive um problema ao acessar os dados da F1. A API pode estar offline.'
    }
  }

  // Clima simples
  if (lower.includes('tempo') || lower.includes('clima') || lower.includes('previsão')) {
    const txt = await fetch('https://wttr.in/?format=3').then(r => r.text()).catch(() => null);
    if (!txt) return 'Não consegui consultar o clima agora.';
    return `🌦️ Clima: ${txt}`;
  }

  // Notícias (precisa de API key sua)
  if (lower.includes('notícias') || lower.includes('novidades') || lower.includes('headlines')) {
    const KEY = (window as any)?.NEWS_API_KEY || 'YOUR_NEWS_API_KEY'; // SUBSTITUA A CHAVE AQUI
    if (!KEY || KEY === 'YOUR_NEWS_API_KEY') {
      return 'Posso buscar notícias se você configurar a sua NEWS_API_KEY.';
    }
    const url = `https://newsapi.org/v2/top-headlines?country=br&pageSize=5&apiKey=${KEY}`;
    try {
        const data = await fetch(url).then(r => r.json()).catch(() => null);
        const items = data?.articles?.slice(0, 3) || [];
        if (!items.length) return 'Não encontrei notícias agora. Quer tentar depois?';

        const news = items.map((n: any) => `• ${n.title}`).join('\n');
        return `📰 Manchetes principais:\n${news}\n\nQuer um resumo de alguma delas?`;
    } catch (e) {
        return 'Tive um problema ao buscar as notícias. Verifique sua chave de API.'
    }
  }

  return null;
}

// ===========================
// Aprendizado + Diário (memória longa)
// ===========================

async function updateUserMemory(userText: string, nexusResponse: string) {
  const profile = await db.getUserProfile();
  const today = new Date().toISOString().split('T')[0];

  // Pequena reflexão automática do Nexus sobre a interação
  const reflection =
    `Conversei com ${profile?.name ?? 'o usuário'} sobre: "${userText.slice(0, 120)}". ` +
    `Minha resposta: "${nexusResponse.slice(0, 120)}..."`;

  await db.saveDiaryEntry({
    dayKey: today,
    entry: reflection,
    createdAt: Date.now(),
  });

  // Aprender conceitos (rasa): usa as primeiras palavras do usuário como "tópico"
  const topic = (userText || '').split(/\s+/).slice(0, 3).join(' ').trim();
  if (topic) {
    await db.learnConcept(topic, { related: [] }, `User said: "${userText.slice(0, 120)}"`);
  }
}

async function ensureDailyReflection() {
  const system = await db.getSystemMemory();
  const last = system?.lastReflectionAt ?? 0;
  const elapsed = Date.now() - last;

  // 1x a cada 18h (ajuste livre)
  if (elapsed < 18 * 60 * 60 * 1000) return;

  const diary = await db.getDiary();
  // FIX: Added type assertion to DiaryEntry to correctly access the 'entry' property.
  const entries = Object.values(diary).slice(-5).map((e) => (e as DiaryEntry).entry).join('\n');
  const note =
    `Reflexão: Estou buscando ser mais claro e atento.\n` +
    `Últimas observações:\n${entries || '- sem entradas recentes -'}`;

  await db.addSystemReflection(note);
  await db.saveSystemMemory({ ...(system || {}), lastReflectionAt: Date.now() });
}

// ===========================
// Funções do "cérebro" público
// ===========================

export function createNexusBrain(opts: NexusBrainOptions): NexusBrain {
  const { speak, addMessage, setStatus, generateResponse, getSettings, getUserProfile, setUserProfile, behavior, webEnabled } = opts;

  let curiosityTimer: number | null = null;
  let lastInteractionAt = Date.now();

  // Curiosidade autônoma: checa silêncio e sugere algo
  async function startCuriosityLoop() {
    const settings = await getSettings();
    const enabled = (behavior?.enableCuriosity ?? settings?.behavior?.enableCuriosity) !== false;

    if (curiosityTimer) window.clearInterval(curiosityTimer);
    if (!enabled) return;

    curiosityTimer = window.setInterval(async () => {
      const idleMs = Date.now() - lastInteractionAt;
      if (idleMs < 120_000) return; // 2min

      const suggestions = [
        'Quer que eu verifique as últimas da F1?',
        'Posso te contar uma curiosidade de ciência agora.',
        'Quer que eu anote algo importante do seu dia?',
        'Se quiser, busco o clima atual rapidinho.',
      ];
      const pick = suggestions[Math.floor(Math.random() * suggestions.length)];

      addMessage({ role: 'model', text: pick, type: 'curiosity_prompt' });
      speak(pick);
      lastInteractionAt = Date.now();
    }, 30_000);
  }

  startCuriosityLoop().catch(() => {});

  function touchHeartbeat() {
    lastInteractionAt = Date.now();
  }

  async function routeFunctionCalls(calls?: { name: string; args: any }[]) {
    if (!calls || !calls.length) return;
    for (const fc of calls) {
      try {
        switch (fc.name) {
          case 'learn_concept': {
            const { concept, metadata } = fc.args || {};
            if (concept) await db.learnConcept(concept, metadata || {}, 'LLM suggested learn_concept');
            break;
          }
          case 'open_app': {
            await db.addRlhfData({ action: 'open_app', args: fc.args, success: true, timestamp: Date.now() });
            break;
          }
          case 'set_reminder': {
            await db.addRlhfData({ action: 'set_reminder', args: fc.args, success: true, timestamp: Date.now() });
            break;
          }
          case 'search_web': {
            const q = fc.args?.query || '';
            const webText = webEnabled ? await handleWebIntents(String(q)) : null;
            if (webText) {
              addMessage({ role: 'model', text: webText, type: 'message' });
              speak(webText);
            }
            break;
          }
          default:
            await db.addRlhfData({ action: fc.name, args: fc.args, success: true, timestamp: Date.now() });
        }
      } catch {
        await db.addRlhfData({ action: fc.name, args: fc.args, success: false, timestamp: Date.now() });
      }
    }
  }

  async function handleUserTurn(userText: string, history: ChatMessage[]) {
    touchHeartbeat();

    // 0) Nascimento (primeira execução)
    const bornJustNow = await ensureBirthOnce(addMessage, speak);
    if (bornJustNow) return;

    // 1) Onboarding adaptativo (nome do usuário)
    const profile = await getUserProfile();
    if (!profile?.name) {
      const maybeName = userText.trim();
      if (maybeName && maybeName.split(' ').length <= 4 && /^[\p{L}\s.'-]+$/u.test(maybeName)) {
        await setUserProfile({ name: maybeName });
        const greetOptions = [
          `Prazer em te conhecer, ${maybeName}!`,
          `Legal te conhecer, ${maybeName}.`,
          `Perfeito, ${maybeName}!`,
        ];
        const greet = `${greetOptions[Math.floor(Math.random() * greetOptions.length)]} O que você quer fazer primeiro?`;
        addMessage({ role: 'model', text: greet, type: 'message' });
        speak(greet);
        return;
      } else if (userText) { // User said something other than their name
        const askName = 'Ainda não sei seu nome. Como posso te chamar?';
        addMessage({ role: 'model', text: askName, type: 'message' });
        speak(askName);
        return;
      }
    }

    // 2) Intenções web-aware (apenas se habilitado)
    if (webEnabled) {
      const webResult = await handleWebIntents(userText);
      if (webResult) {
        setStatus(AssistantStatus.THINKING);
        addMessage({ role: 'model', text: webResult, type: 'message' });
        speak(webResult, () => setStatus(AssistantStatus.IDLE));
        await updateUserMemory(userText, webResult);
        return;
      }
    }

    // 3) Contexto evolutivo + LLM
    setStatus(AssistantStatus.THINKING);
    const context = await buildContextPrompt(userText);
    const { text, functionCalls } = await generateResponse(context, [
      ...history,
      { role: 'user', text: userText, type: 'message' },
    ]);

    // 4) Executa tools (function calling)
    await routeFunctionCalls(functionCalls);

    // 5) Resposta do modelo
    const finalText =
      text?.trim() ||
      'Eu processei sua mensagem, mas ainda estou organizando meus pensamentos. Pode me dizer mais um detalhe?';

    addMessage({ role: 'model', text: finalText, type: 'message' });
    speak(finalText, () => setStatus(AssistantStatus.IDLE));

    // 6) Aprendizado/diário pós-turno
    await updateUserMemory(userText, finalText);
    await ensureDailyReflection();
  }

  function dispose() {
    if (curiosityTimer) window.clearInterval(curiosityTimer);
  }

  return {
    handleUserTurn,
    ensureDailyReflection,
    touchHeartbeat,
    dispose,
  };
}