export type JarvisAction =
  | { type: "navigate"; path: string }
  | { type: "speak"; text: string }
  | { type: "open_url"; url: string }
  | { type: "inspect"; url: string }
  | { type: "worker_health" }
  | { type: "unknown_discovery" }\n  | { type: "help" };

import { understand, helpReply } from "./jarvisIntent";\n\nconst normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

export function parseJarvisCommand(input: string): JarvisAction[] {
  const text = normalize(input).replace(/^hey\s+jarvis[,\s]*/i, "");
  const actions: JarvisAction[] = [];

  if (!text) return actions;\n\n  const intent = understand(text);\n  if (intent?.intent === "help") { actions.push({ type: "help" }); return actions; }

  if (
    text === "me surpreenda" ||
    text === "surpreenda-me" ||
    text === "surpreenda me" ||
    text.includes("jarvis unknown") ||
    text.includes("unknown discovery")
  ) {
    actions.push({ type: "unknown_discovery" });
    return actions;
  }

  if (intent?.intent === "dashboard" || text.includes("visao geral") || text.includes("dashboard") || text === "inicio") {
    actions.push({ type: "navigate", path: "/" });
  } else if (intent?.intent === "opportunities" || text.includes("oportunidades") || text.includes("empresas sem site")) {
    actions.push({ type: "navigate", path: "/oportunidades" });
  } else if (intent?.intent === "crm" || text.includes("clientes") || text.includes("crm")) {
    actions.push({ type: "navigate", path: "/clientes" });
  } else if (intent?.intent === "finance" || text.includes("financeiro") || text.includes("dinheiro")) {
    actions.push({ type: "navigate", path: "/financeiro" });
  } else if (intent?.intent === "memory" || text.includes("memoria")) {
    actions.push({ type: "navigate", path: "/memoria" });
  } else if (intent?.intent === "approvals" || text.includes("aprovacoes") || text.includes("aprovações")) {
    actions.push({ type: "navigate", path: "/aprovacoes" });
  } else if (intent?.intent === "execution" || text.includes("execucao") || text.includes("executor")) {
    actions.push({ type: "navigate", path: "/execucao" });
  } else if (intent?.intent === "vision" || text.includes("camera") || text.includes("cameras") || text.includes("visao") || text.includes("visão")) {
    actions.push({ type: "navigate", path: "/visao" });
  } else if (intent?.intent === "agents" || text.includes("equipe") || text.includes("agentes") || text.includes("multi agente")) {
    actions.push({ type: "navigate", path: "/equipe" });
  } else if (intent?.intent === "tasks" || text.includes("tarefas")) {
    actions.push({ type: "navigate", path: "/tarefas" });
  } else if (intent?.intent === "settings" || text.includes("configuracoes") || text.includes("configurações")) {
    actions.push({ type: "navigate", path: "/configuracoes" });
  }

  const urlMatch = input.match(/https?:\/\/[^\s]+/i);
  if ((text.startsWith("abra ") || text.startsWith("abre ")) && urlMatch) {
    actions.push({ type: "open_url", url: urlMatch[0].replace(/[.,!?]+$/, "") });
  }

  if (text.includes("status do computador") || text.includes("worker")) {
    actions.push({ type: "worker_health" });
  }

  if (intent?.intent === "status" && actions.length === 0) actions.push({ type: "worker_health" });\n\n  if (actions.length === 0) {
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
