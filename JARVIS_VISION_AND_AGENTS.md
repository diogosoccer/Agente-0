# JARVIS — visão, câmeras e equipe de agentes

Esta branch transforma o Agente Zero em uma base de assistente de computador local.

## Visão
- Até 5 slots de câmera no navegador.
- Seleção individual de cada câmera disponível no sistema.
- Pré-visualização ao vivo.
- Permissão explícita antes de abrir câmera.
- Processamento visual local por padrão.
- Nenhum frame é enviado para servidor pela camada de visão.
- Nenhuma foto do rosto é persistida por esta camada.
- Verificação de identidade é opt-in e fica desativada por padrão.

## Equipe
- JARVIS Core: orquestração.
- Sentinel: segurança/aprovação.
- Scout: pesquisa.
- Builder: construção de software/sites.
- Business: CRM e oportunidades.
- Analyst: análise.
- Vision: câmeras/visão.
- Operator: computador/navegador.

## Próximas integrações
1. Modelo de raciocínio configurável.
2. Wake word real em segundo plano no desktop.
3. Memória persistente local + memória de projeto.
4. Gmail/Outlook somente leitura inicialmente.
5. Pesquisa web e notícias atuais.
6. Browser automation com allowlist.
7. Sistema de tarefas com eventos em tempo real.
8. Gerador/alterador de sites conectado ao GitHub.
9. Identidade facial local opcional, sem upload.
10. Atalhos de computador e abertura de aplicativos por allowlist.
11. Central de aprovações para enviar, publicar, excluir, gastar ou alterar credenciais.
12. Auditoria completa de cada ação.
13. Modo offline para comandos locais.
14. Perfis e vozes diferentes para agentes, sem fingir serem pessoas reais.
15. Fallback manual sempre disponível.

## Limite importante
“100% funcional” depende das permissões do computador, APIs/credenciais que o usuário conectar e modelos que escolher. O código deve deixar essas dependências explícitas, em vez de fingir que ações externas funcionam sem autorização.
