export type JarvisPlanAction =
  | { type: "navigate"; path: string; label: string }
  | { type: "worker_health"; label: string }
  | { type: "research_web"; query: string; label: string }
  | { type: "open_url"; url: string; label: string; requiresApproval: true }
  | { type: "inspect_site"; url: string; label: string; requiresApproval: true }
  | { type: "browser_action"; url: string; action: "navigate" | "click" | "fill" | "press" | "extract" | "screenshot"; selector?: string; value?: string; label: string; requiresApproval: true }
  | { type: "open_app"; app: string; label: string; requiresApproval: true }
  | { type: "close_app"; app: string; label: string; requiresApproval: true }
  | { type: "open_file"; path: string; label: string; requiresApproval: true }
  | { type: "file_search"; root?: string; query: string; limit?: number; label: string }
  | { type: "file_read"; path: string; label: string }
  | { type: "file_create"; path: string; content?: string; contentFromStep?: number; label: string; requiresApproval: true }
  | { type: "file_move"; source: string; destination: string; label: string; requiresApproval: true }
  | { type: "file_rename"; source: string; name: string; label: string; requiresApproval: true }
  | { type: "run_command"; command: "system_info" | "git_status" | "node_version" | "npm_version" | "pwd" | "list_files"; label: string; requiresApproval: true }
  | { type: "delegate"; goal: string; label: string };

export type JarvisActionPlan = {
  id: string;
  input: string;
  summary: string;
  intent: string;
  confidence: number;
  reason?: string;
  actions: JarvisPlanAction[];
  requiresApproval: boolean;
};

export async function createActionPlanWithAI(
  input: string,
  baseUrl = "http://localhost:8787"
): Promise<JarvisActionPlan | null> {
  try {
    const response = await fetch(baseUrl.replace(/\/$/, "") + "/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input }),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data?.plan || !Array.isArray(data.plan.actions)) return null;
    return {
      id: typeof data.plan.id === "string" ? data.plan.id : crypto.randomUUID(),
      input,
      summary: typeof data.plan.summary === "string" ? data.plan.summary : "Plano criado.",
      intent: typeof data.plan.intent === "string" ? data.plan.intent : "agent",
      confidence: Number(data.plan.confidence) || 0,
      reason: typeof data.plan.reason === "string" ? data.plan.reason : undefined,
      requiresApproval: Boolean(data.plan.requiresApproval),
      actions: data.plan.actions,
    };
  } catch {
    return null;
  }
}


function enrichPersonalPlan(plan: JarvisActionPlan, input: string): JarvisActionPlan {
  const text = input.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const actions = [...plan.actions];

  const add = (action: JarvisPlanAction) => actions.push(action);

  const appOpen = text.match(/(?:abra|abrir|inicie|iniciar)\s+(?:o\s+|a\s+)?(chrome|google chrome|edge|firefox|calculadora|bloco de notas|explorador)/i);
  if (appOpen && !actions.some(a => a.type === "open_app")) {
    const app = appOpen[1].toLowerCase().replace("google chrome", "chrome").replace("bloco de notas", "bloco").replace("explorador", "explorer");
    add({ type: "open_app", app, label: "Abrir " + app, requiresApproval: true });
  }

  const appClose = text.match(/(?:feche|fechar|encerre|encerrar)\s+(?:o\s+|a\s+)?(chrome|google chrome|edge|firefox|calculadora|bloco de notas|explorador)/i);
  if (appClose && !actions.some(a => a.type === "close_app")) {
    const app = appClose[1].toLowerCase().replace("google chrome", "chrome").replace("bloco de notas", "bloco").replace("explorador", "explorer");
    add({ type: "close_app", app, label: "Fechar " + app, requiresApproval: true });
  }

  const fileSearch = text.match(/(?:pesquise|procure|encontre|busque)\s+(?:o\s+|um\s+|um arquivo\s+|o arquivo\s+)?(?:arquivo\s+)?["“]?([^"”]+)["”]?/i);
  if (fileSearch && /arquivo|file/.test(text) && !actions.some(a => a.type === "file_search")) {
    add({ type: "file_search", query: fileSearch[1].trim(), label: "Pesquisar arquivos por nome" });
  }

  const move = input.match(/(?:mova|mover)\s+["“]?(.+?)["”]?\s+(?:para|em)\s+["“]?(.+?)["”]?(?:\.|$)/i);
  if (move && !actions.some(a => a.type === "file_move")) {
    add({ type: "file_move", source: move[1].trim(), destination: move[2].trim(), label: "Mover arquivo", requiresApproval: true });
  }

  const rename = input.match(/(?:renomeie|renomear)\s+["“]?(.+?)["”]?\s+(?:para|como)\s+["“]?(.+?)["”]?(?:\.|$)/i);
  if (rename && !actions.some(a => a.type === "file_rename")) {
    add({ type: "file_rename", source: rename[1].trim(), name: rename[2].trim(), label: "Renomear arquivo", requiresApproval: true });
  }

  if (/salve|guardar|grave/.test(text) && /arquivo|documento/.test(text) && !actions.some(a => a.type === "file_create")) {
    const sourceIndex = Math.max(0, actions.length - 1);
    add({
      type: "file_create",
      path: "%USERPROFILE%\\Desktop\\JARVIS-resultado.txt",
      contentFromStep: sourceIndex,
      label: "Salvar resultado em arquivo",
      requiresApproval: true
    });
  }

  return {
    ...plan,
    actions,
    totalSteps: actions.length,
    requiresApproval: plan.requiresApproval || actions.some(a => "requiresApproval" in a && a.requiresApproval)
  };
}
