# Agente Zero Desktop

Shell Windows do Agente Zero.

## O que ele faz

- inicia o Worker local automaticamente;
- inicia com o Windows;
- mantém o JARVIS em segundo plano;
- permite abrir o JARVIS pela bandeja;
- adiciona Ctrl+Shift+J como fallback para abrir;
- expõe uma ponte segura para o frontend mostrar/ocultar a janela;
- usa o Worker local para as capacidades que realmente precisam acessar o computador.

## Desenvolvimento

1. Instale as dependências do projeto raiz.
2. Gere o frontend com `npm run build`.
3. Inicie o Vite em outro terminal com `npm run dev`.
4. Execute `npm run desktop`.

## Limitação atual

O "JARVIS" por voz continua usando o reconhecimento de voz do Chromium. O Desktop mantém a aplicação viva em segundo plano, mas a confiabilidade de escuta contínua em segundo plano depende do suporte de voz do Windows/Chromium. O atalho Ctrl+Shift+J é o fallback.
