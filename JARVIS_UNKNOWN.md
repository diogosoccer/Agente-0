# JARVIS // UNKNOWN

O comando secreto `JARVIS // UNKNOWN` é o modo de descoberta não solicitada do Agente Zero.

Quando o usuário diz **"JARVIS, me surpreenda"**, o sistema não escolhe uma curiosidade aleatória. Ele inspeciona sinais que já existem dentro do próprio sistema e procura algo que merece ser trazido à atenção do usuário.

## Tipos de descoberta

- conexão entre módulos;
- trabalho repetido que pode virar habilidade;
- inconsistência de estado;
- gargalo operacional;
- oportunidade;
- hipótese;
- melhoria;
- experimento.

## Primeira implementação

O motor `src/services/jarvisUnknown.ts` analisa o estado local de:

- oportunidades;
- clientes;
- tarefas;
- memória;
- aprovações;
- modo DEMO/REAL;
- biblioteca de habilidades.

Ele calcula evidências e confiança e escolhe a descoberta mais relevante.

A resposta começa com:

> Encontrei algo que você não me pediu para procurar.

## Limite importante

Esta versão é introspecção determinística do estado do aplicativo. Ela ainda não é um modelo geral que entende todo o computador, todos os repositórios ou toda a web.

A evolução planejada é adicionar fontes de observação autorizadas — GitHub, arquivos, tarefas, histórico, web e integrações — e fazer o motor comparar sinais entre elas.

O princípio permanece: **descobrir primeiro; agir somente depois de autorização quando houver efeito externo.**
