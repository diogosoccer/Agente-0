# JARVIS — arquitetura ampliada

## Objetivo
Um assistente pessoal de computador local, multimodal e multiagente. O navegador é a interface; o worker local é a ponte para o computador; os agentes são especialistas; o Sentinel controla permissões.

## Camadas
1. Interface/HUD
2. Voz e wake word
3. Visão e câmeras
4. Orquestrador de tarefas
5. Agentes especializados
6. Worker local
7. Memória
8. Integrações externas
9. Auditoria e aprovações

## Agentes
Core, Sentinel, Scout, Builder, Business, Analyst, Vision, Operator, Researcher, Planner e Archivist podem existir como perfis lógicos. Eles não precisam ser modelos diferentes: o orquestrador pode escolher modelo, prompt e ferramentas por função.

## Recursos previstos
- wake word local real
- speech-to-text e text-to-speech
- visão de câmera e tela
- identidade facial local opcional
- memória de sessão/projeto
- pesquisa web/notícias
- browser automation
- e-mail em modo leitura inicialmente
- GitHub e criação de software
- CRM/propostas/projetos
- tarefas em background
- notificações
- aprovações
- auditoria
- perfis/vozes
- modo offline
- plugins/ferramentas
- recuperação de erros
- checkpoints e retomada de tarefas

## Segurança
- default-deny
- allowlist para aplicativos/domínios
- confirmação para enviar, publicar, excluir, gastar, alterar credenciais ou contatar terceiros
- tokens nunca no frontend
- câmera/microfone sempre com permissão do sistema
- identidade facial opt-in
- dados biométricos não persistidos por padrão
- logs de ações
- botão de parada de emergência no desktop

## Regra de produto
JARVIS pode pesquisar, analisar, planejar e preparar. Ações externas irreversíveis continuam atrás de aprovação explícita.

## Estado real
A fundação é funcional, mas integrações que dependem de APIs, modelos, permissões do sistema e credenciais precisam ser conectadas no computador. Não declarar uma capacidade como funcionando quando só existe a interface.
