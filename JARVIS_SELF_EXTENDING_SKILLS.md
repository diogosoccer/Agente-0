# JARVIS — Self-Extending Skills

## Objetivo
Permitir que JARVIS detecte tarefas repetitivas e proponha pequenas ferramentas reutilizáveis.

## Fluxo seguro
1. Registrar objetivos/tarefas concluídas.
2. Detectar repetição (padrão inicial: 7 ocorrências).
3. Mostrar proposta: nome, finalidade, gatilho e impacto.
4. Usuário aprova.
5. Builder gera o módulo em um sandbox/área isolada.
6. Testes são executados.
7. Sentinel verifica permissões.
8. Só então a skill pode ficar ativa.

## Regra
JARVIS nunca cria e ativa automaticamente uma ferramenta com capacidade externa. A proposta é automática; ativação exige aprovação.

## Evolução futura
- geração real de código pelo Builder;
- testes unitários automáticos;
- versionamento/rollback;
- permissões por skill;
- ferramentas HTTP/browser/computer separadas;
- métricas de sucesso;
- detecção semântica de tarefas parecidas, além de correspondência textual.
