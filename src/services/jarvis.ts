export type JarvisAction =
  | { type: "navigate"; path: string }
  | { type: "speak"; text: string }
  | { type: "open_url"; url: string }
  | { type: "inspect"; url: string }
  | { type: "worker_health" };

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

export function parseJarvisCommand(input: string): JarvisAction[] {
  const text = normalize(input).replace(/^hey\s+jarvis[,\s]*/i, "");
  const actions: JarvisAction[] = [];

  if (!text) return actions;
  if (text.includes("visao geral") || text.includes("dashboard") || text === "inicio") {
    actions.push({ type: "navigate", path: "/" });
  } else if (text.includes("oportunidades") || text.includes("empresas sem site")) {
    actions.push({ type: "navigate", path: "/oportunidades" });
  } else if (text.includes("clientes") || text.includes("crm")) {
    actions.push({ type: "navigate", path: "/clientes" });
  } else if (text.includes("financeiro") || text.includes("dinheiro")) {
    actions.push({ type: "navigate", path: "/financeiro" });
  } else if (text.includes("memoria")) {
    actions.push({ type: "navigate", path: "/memoria" });
  } else if (text.includes("aprovacoes") || text.includes("aprovações")) {
    actions.push({ type: "navigate", path: "/aprovacoes" });
  } else if (text.includes("execucao") || text.includes("executor")) {
    actions.push({ type: "navigate", path: "/execucao" });
  } else if (text.includes("camera") || text.includes("cameras") || text.includes("visao") || text.includes("visão")) {\n    actions.push({ type: "navigate", path: "/visao" });\n  } else if (text.includes("equipe") || text.includes("agentes") || text.includes("multi agente")) {\n    actions.push({ type: "navigate", path: "/equipe" });\n  } else if (text.includes("tarefas")) {
    actions.push({ type: "navigate", path: "/tarefas" });
  } else if (text.includes("configuracoes") || text.includes("configurações")) {
    actions.push({ type: "navigate", path: "/configuracoes" });
  }

  const urlMatch = input.match(/https?:\/\/[^\s]+/i);
  if ((text.startsWith("abra ") || text.startsWith("abre ")) && urlMatch) {
    actions.push({ type: "open_url", url: urlMatch[0].replace(/[.,!?]+$/, "") });
  }

  if (text.includes("status do computador") || text.includes("worker")) {
    actions.push({ type: "worker_health" });
  }

  if (actions.length === 0) {
    actions.push({ type: "speak", text: "Entendi o comando, mas essa ação ainda não está conectada. Use o modo Agente para tarefas complexas." });
  }
  return actions;
}

export function speak(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "pt-BR";
  utterance.rate = 1;
  window.speechSynthesis.speak(utterance);
}

export async function workerHealth(baseUrl: string) {
  const response = await fetch(baseUrl.replace(/\/$/, "") + "/health", {
    signal: AbortSignal.timeout(2500),
  });
  if (!response.ok) throw new Error("Worker offline");
  return response.json() as Promise<{status:string;version?:string}>;
}
