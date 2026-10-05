export type JarvisPlanAction =
  | { type: "navigate"; path: string; label: string }
  | { type: "worker_health"; label: string }
  | { type: "research_web"; query: string; label: string }
  | { type: "open_url"; url: string; label: string; requiresApproval: true }
  | { type: "inspect_site"; url: string; label: string; requiresApproval: true }\n  | { type: "browser_action"; url: string; action: "navigate" | "click" | "fill" | "press" | "extract" | "screenshot"; selector?: string; value?: string; label: string; requiresApproval: true }
  | { type: "open_app"; app: string; label: string; requiresApproval: true }
  | { type: "open_file"; path: string; label: string; requiresApproval: true }
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
