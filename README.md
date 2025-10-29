Nexus – Assistente Pessoal Inteligente

O Nexus é um assistente pessoal modular e local-first que integra inteligência artificial, voz, visão e automação em uma única interface. Projetado para ser rápido, personalizável e offline-ready, o Nexus combina múltiplos agentes cognitivos para oferecer uma experiência de interação natural e contínua.

✨ Principais recursos

🗣️ Voz e fala – suporte a síntese e reconhecimento de fala via Gemini e DeepSeek.

👁️ Visão cognitiva – análise de imagem e vídeo por meio do visionService.

🧩 Memória neural – armazenamento e recuperação contextual inteligente via neuralMemory.

🔄 Sincronização – integração com Google Drive e APIs externas (googleAuth, driveSyncService, syncService).

🧠 Agente pró-ativo – execução de tarefas automáticas e reflexão contextual com useProactiveAgent.

⚙️ Interface modular – arquitetura baseada em componentes React e hooks customizados para IA, voz e sincronização.

📦 Arquitetura limpa e extensível – separação clara entre camadas de UI, serviços e lógica cognitiva.

🧰 Tecnologias

Frontend: React + TypeScript + Vite

IA e Voz: Gemini, DeepSeek, LLMs locais/offline

Sincronização: IndexedDB, Google Drive API

Ambiente: Capacitor (compatível com desktop e mobile)

🚀 Visão

O Nexus busca ser um hub pessoal de inteligência, capaz de aprender, refletir e agir em nome do usuário — um verdadeiro “cérebro digital” que conecta dados, ideias e rotinas cotidianas de forma fluida e privada.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
