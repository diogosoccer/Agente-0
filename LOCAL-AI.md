# JARVIS local-first

O Agente Zero agora funciona sem Gemini/OpenAI e sem chave de API externa.

## O que instalar no computador

1. **Node.js 22 ou superior** — executa o aplicativo.
2. **Ollama** — executa a inteligência artificial localmente.
3. **Qwen3.5 4B** — modelo inicial usado pelo JARVIS.

O Ollama mantém uma API local em `http://127.0.0.1:11434`. O JARVIS detecta automaticamente se ela está disponível.

## Primeira vez no Windows

1. Instale o Ollama pelo site oficial.
2. Execute `CONFIGURAR-JARVIS.bat` uma vez.
3. Execute `INICIAR-JARVIS.bat`.

Depois da primeira configuração, o iniciador verifica automaticamente:
- Node.js;
- Ollama;
- modelo local;
- dependências do projeto;
- Chromium do Worker.

## Importante

Você falou "Java", mas este projeto usa **Node.js**, não Java. Não precisa instalar Java para executar o Agente Zero.

O modelo `qwen3.5:4b` ocupa alguns GB e a velocidade depende do hardware. Ele roda localmente; não exige uma chave Gemini/OpenAI nem cobrança por requisição.

O JARVIS continua tendo fallback determinístico quando a IA local está offline. Assim, o sistema não deixa de iniciar só porque o modelo ainda não está disponível.

## Arquitetura

`voz/interface -> JARVIS Core -> IA local -> planner -> ferramentas -> navegador/worker -> verificação`

A IA local é responsável por conversa, interpretação, raciocínio e planejamento. O Worker continua responsável por ações controladas no computador e pesquisa pública na web.

Ações externas continuam protegidas por aprovação quando necessário.
