import { understand } from "./jarvisIntent";
import { understandWithAI } from "./jarvisIntentAI";

export type JarvisAction =
  | { type: "navigate"; path: string }
  | { type: "speak"; text: string }
  | { type: "open_url"; url: string }
  | { type: "inspect"; url: string }
  | { type: "worker_health" }
  | { type: "unknown_discovery" }
  | { type: "help" };

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

function actionsForIntent(intent: string): JarvisAction[] {
  switch (intent) {
    case "unknown_discovery": return [{ type: "unknown_discovery" }];
    case "help": return [{ type: "help" }];
    case "dashboard": return [{ type: "navigate", path: "/" }];
    case "opportunities": return [{ type: "navigate", path: "/oportunidades" }];
    case "crm": return [{ type: "navigate", path: "/clientes" }];
    case "finance": return [{ type: "navigate", path: "/financeiro" }];
    case "memory": return [{ type: "navigate", path: "/memoria" }];
    case "approvals": return [{ type: "navigate", path: "/aprovacoes" }];
    case "execution": return [{ type: "navigate", path: "/execucao" }];
    case "vision": return [{ type: "navigate", path: "/visao" }];
    case "agents": return [{ type: "navigate", path: "/equipe" }];
    case "tasks": return [{ type: "navigate", path: "/tarefas" }];
    case "settings": return [{ type: "navigate", path: "/configuracoes" }];
    case "status": return [{ type: "worker_health" }];
    case "agent": return [{ type: "speak", text: "Vou delegar essa tarefa para o sistema multiagente." }];
    default: return [];
  }
}

export function parseJarvisCommand(input: string): JarvisAction[] {
  const text = normalize(input).replace(/^hey\s+jarvis[,\s]*/i, "");
  if (!text) return [];

  const localIntent = understand(text);
  if (localIntent) {
    const actions = actionsForIntent(localIntent.intent);
    if (actions.length) return actions;
  }

  const urlMatch = input.match(/https?:\/\/[^\s]+/i);
  if ((text.startsWith("abra ") || text.startsWith("abre ")) && urlMatch) {
    return [{ type: "open_url", url: urlMatch[0].replace(/[.,!?]+$/, "") }];
  }

  if (text.includes("status do computador") || text.includes("worker")) {
    return [{ type: "worker_health" }];
  }

  return [{ type: "speak", text: "Ainda não tenho uma ação conectada para esse pedido." }];
}

export async function parseJarvisCommandWithAI(input: string): Promise<JarvisAction[]> {
  const text = normalize(input).replace(/^hey\s+jarvis[,\s]*/i, "");
  if (!text) return [];

  const base = localStorage.getItem("az:executorUrl") || "http://localhost:8787";
  const ai = await understandWithAI(input, base);
  if (ai && ai.confidence >= 0.55) {
    const actions = actionsForIntent(ai.intent);
    if (actions.length) return actions;
  }

  return parseJarvisCommand(input);
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
