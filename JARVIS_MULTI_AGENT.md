# JARVIS Multi-Agent Runtime

O sistema agora possui um runtime multiagente real no frontend: tarefas têm identidade, agente responsável, prioridade, estado, eventos e resultado.

## Fluxo
Usuário -> Core -> Planner -> especialistas -> Sentinel -> aprovação -> Operator/Builder -> Analyst/Archivist -> Core.

## Diferença entre agentes
Cada agente possui papel, prompt, ferramentas permitidas e capacidade de agir. Os agentes podem ser instâncias do mesmo modelo ou modelos diferentes; a arquitetura não depende disso.

## Próxima integração
Conectar cada perfil a um provider/modelo real e ao worker local. O worker deve validar permissões novamente; o frontend nunca deve ser a única barreira de segurança.

## Regras
- tarefas destrutivas ou externas passam pelo ApprovalGate;
- agentes de pesquisa não ganham poder de execução;
- memória é separada de execução;
- eventos permitem acompanhar tarefas longas;
- resultados devem ser verificáveis antes de serem consolidados.
