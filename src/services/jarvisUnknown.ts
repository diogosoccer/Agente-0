export type UnknownFindingType =
  | "connection"
  | "abandoned"
  | "automation"
  | "inconsistency"
  | "opportunity"
  | "hypothesis"
  | "improvement"
  | "experiment";

export type UnknownFinding = {
  id: string;
  type: UnknownFindingType;
  title: string;
  explanation: string;
  evidence: string[];
  confidence: number;
  nextStep: string;
};

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
};

const normalize = (value: string) =>
  value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function fingerprint(value: string) {
  return normalize(value).replace(/\s+/g, " ").trim();
}

export function discoverUnknown(): UnknownFinding {
  const opportunities = read<any[]>("az:opps", []);
  const clients = read<any[]>("az:clients", []);
  const tasks = read<any[]>("az:tasks", []);
  const memory = read<any[]>("az:memory", []);
  const approvals = read<any[]>("az:approvals", []);
  const demo = read<boolean>("az:demo", true);
  const skills = read<any[]>("jarvis.skills.v1", []);

  const findings: UnknownFinding[] = [];

  const repeated = new Map<string, number>();
  for (const task of tasks) {
    const goal = typeof task === "string" ? task : task?.title || task?.description || task?.name;
    if (!goal) continue;
    const key = fingerprint(goal);
    repeated.set(key, (repeated.get(key) || 0) + 1);
  }
  const repetition = [...repeated.entries()].sort((a, b) => b[1] - a[1])[0];
  if (repetition && repetition[1] >= 3) {
    findings.push({
      id: "repeated-work",
      type: "automation",
      title: "Existe trabalho repetido pedindo uma habilidade própria.",
      explanation: `Encontrei a tarefa “${repetition[0]}” aparecendo ${repetition[1]} vezes. Isso é um sinal de que o JARVIS poderia transformar esse padrão em uma habilidade reutilizável, em vez de continuar tratando cada ocorrência como uma tarefa isolada.`,
      evidence: [`${repetition[1]} ocorrências semelhantes no histórico local`, `Biblioteca atual: ${skills.length} habilidades`],
      confidence: 0.91,
      nextStep: "Propor uma Skill, revisar suas permissões e só ativá-la após sua aprovação."
    });
  }

  if (opportunities.length > 0 && clients.length === 0) {
    findings.push({
      id: "opportunity-client-gap",
      type: "connection",
      title: "O sistema pesquisa oportunidades, mas ainda não fecha o ciclo com o CRM.",
      explanation: `Há ${opportunities.length} oportunidade(s) registradas e nenhum cliente no CRM. A conexão óbvia é transformar descoberta → análise → proposta em um fluxo único, sem copiar dados manualmente.`,
      evidence: [`Oportunidades: ${opportunities.length}`, "Clientes no CRM: 0"],
      confidence: 0.96,
      nextStep: "Criar uma ação de 'Preparar oportunidade' que gere rascunho de cliente, diagnóstico e proposta para aprovação."
    });
  }

  if (memory.length >= 3 && skills.length === 0) {
    findings.push({
      id: "memory-to-skill",
      type: "connection",
      title: "Sua memória já está acumulando conhecimento, mas a biblioteca de habilidades está vazia.",
      explanation: `O JARVIS já possui ${memory.length} registros de memória, porém nenhuma habilidade registrada. Existe uma oportunidade de converter padrões aprendidos em procedimentos reutilizáveis.`,
      evidence: [`Memórias locais: ${memory.length}`, "Habilidades ativas/propostas: 0"],
      confidence: 0.88,
      nextStep: "Agrupar memórias relacionadas e sugerir uma habilidade somente quando existir um padrão verificável."
    });
  }

  if (approvals.length > 0 && tasks.length > 0) {
    const pending = approvals.filter(a => a?.status === "pending").length;
    if (pending > 0) {
      findings.push({
        id: "approval-bottleneck",
        type: "improvement",
        title: "O gargalo pode estar nas aprovações, não nos agentes.",
        explanation: `Existem ${pending} aprovação(ões) pendente(s) enquanto o sistema também mantém ${tasks.length} tarefa(s). Isso sugere que a próxima melhoria de produtividade pode ser uma fila de aprovações mais inteligente, agrupando ações de baixo risco e destacando apenas o que realmente exige decisão.`,
        evidence: [`Aprovações pendentes: ${pending}`, `Tarefas registradas: ${tasks.length}`],
        confidence: 0.82,
        nextStep: "Criar uma central que agrupe aprovações por risco, projeto e agente."
      });
    }
  }

  if (demo) {
    findings.push({
      id: "demo-reality-gap",
      type: "inconsistency",
      title: "Há uma inconsistência arquitetural escondida: o cérebro já parece operacional, mas ainda está em MODO DEMO.",
      explanation: "O produto tem CRM, memória, financeiro, runtime multiagente e aprovação, mas o estado global ainda indica DEMO. Isso pode mascarar quais partes realmente estão conectadas a dados e ferramentas externas.",
      evidence: ["MODO DEMO ativo", "Módulos de CRM, memória, financeiro, runtime e aprovação presentes"],
      confidence: 0.99,
      nextStep: "Executar um diagnóstico de integração antes de chamar o sistema de produção."
    });
  }

  findings.push({
    id: "cross-agent-builder-business",
    type: "opportunity",
    title: "O Builder e o agente de Negócios podem formar um ciclo que ainda não existe.",
    explanation: "O sistema já separa agentes de construção e negócios. A conexão natural é: detectar uma oportunidade → pesquisar contexto → gerar um site em sandbox → apresentar o resultado → só então pedir aprovação para qualquer contato externo.",
    evidence: ["Agente Builder disponível", "Agente Business disponível", "ApprovalGate disponível"],
    confidence: 0.94,
    nextStep: "Criar o fluxo Opportunity → Research → Builder Preview → Approval como uma habilidade composta."
  });

  return findings.sort((a, b) => b.confidence - a.confidence)[0];
}

export function formatUnknownFinding(finding: UnknownFinding) {
  return [
    "Encontrei algo que você não me pediu para procurar.",
    finding.title,
    finding.explanation,
    `Evidências: ${finding.evidence.join(" • ")}.`,
    `Próximo passo: ${finding.nextStep}`
  ].join(" ");
}
