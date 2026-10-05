# JARVIS Desktop Foundation

This branch prepares Agente Zero to become a local desktop assistant inspired by the architecture of adewaskar/jarvis.

## Goal

When this project is moved to a Windows/macOS/Linux computer, the desktop layer should provide:

- wake-word / voice interface
- local identity verification with explicit opt-in
- browser and application control through an allowlist
- current web/news research
- authorized email summaries
- GitHub/project operations
- persistent local memory
- business prospecting workflows
- approval gates before consequential actions
- a HUD/dashboard for status, tasks and approvals

## Current repository architecture

- `src/`: browser UI and orchestration
- `worker/`: local Node/Playwright execution layer
- `worker/server.mjs`: browser/research worker on port 8787
- `worker/local-executor.mjs`: executor local de computador/arquivos no port 8788
- `src/services/executor.ts`: frontend-to-worker client
- `src/services/engine.ts`: task/financial decision logic

## Computer setup

Requirements:

- Node.js 20+
- Git
- Chrome or Edge
- a microphone for voice commands
- a webcam only if local identity verification is enabled

Run:

```bash
npm install
cd worker
npm install
npx playwright install chromium
cd ..
npm run dev
```

In another terminal:

```bash
cd worker
npm start
```

Em outro terminal, para o executor local:

```bash
node worker/local-executor.mjs
```

Then open the Vite address shown by the terminal.

## Planned desktop bridge

O executor local mantém três níveis: AUTOMÁTICO, CONFIRMAÇÃO e BLOQUEADO. Ele expõe apenas ações explícitas, como:

- open an allowlisted URL
- search the web
- inspect a page
- capture a page
- open an allowlisted desktop application
- pesquisar e ler arquivos selecionados
- criar, mover e renomear arquivos após aprovação
- abrir aplicativos permitidos
- fechar aplicativos após aprovação
- executar comandos após aprovação, com bloqueios de segurança

Never expose unrestricted arbitrary shell execution from a browser request.

## Identity

Identity verification should be local and opt-in. Do not upload face data by default. Store only what is necessary, provide a reset/delete path, and keep a fallback local passcode.

## Approvals

The assistant may research, plan and prepare drafts automatically.

Require an explicit approval before:

- sending messages or emails
- publishing/deploying
- deleting files
- spending money
- changing credentials
- contacting a prospect
- executing destructive system commands

## First computer milestone

The first usable milestone is:

"Hey Jarvis" -> wake -> verify local identity if enabled -> understand command -> execute an allowlisted desktop/browser action -> report result.

Examples:

- "Abra o GitHub."
- "Procure as notícias de hoje."
- "Abra meu projeto Agente Zero."
- "Inspecione este site."
- "Mostre as tarefas pendentes."
- "Pesquise empresas locais sem site e prepare oportunidades."

## Important

O runtime agora possui uma ponte local real para ações de computador e arquivos. A interface web continua sem acesso direto ao sistema: o controle acontece pelo worker local, com permissões, tokens de aprovação e auditoria.
