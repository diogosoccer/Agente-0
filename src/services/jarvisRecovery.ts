import type { JarvisPlanAction } from "./jarvisActionPlan";

export type RecoveryDecision = {
  strategy: string;
  action: JarvisPlanAction;
};

export function chooseRecovery(step: { action: JarvisPlanAction; attempts: number }): RecoveryDecision | null {
  const action = step.action;

  if (action.type === "research_web") {
    const suffix = step.attempts <= 1
      ? " Priorize fontes alternativas e resultados recentes."
      : " Amplie a pesquisa e procure fontes independentes.";
    return {
      strategy: "pesquisa-alternativa",
      action: { ...action, query: action.query + suffix, label: action.label + " — recuperação" },
    };
  }

  if (action.type === "worker_health") {
    return {
      strategy: "revalidar-worker",
      action,
    };
  }

  if (action.type === "delegate") {
    return {
      strategy: "replanejamento",
      action: { ...action, goal: action.goal + " Reavalie a estratégia antes de executar novamente." },
    };
  }

  if (action.type === "browser_action") {
    return {
      strategy: "revalidar-navegador",
      action,
    };
  }

  if (action.type === "inspect_site" || action.type === "open_url") {
    return {
      strategy: "revalidar-web",
      action,
    };
  }

  if (action.type === "navigate") {
    return {
      strategy: "revalidar-navegação",
      action,
    };
  }

  return {
    strategy: "revalidar-aprovação",
    action,
  };
}
