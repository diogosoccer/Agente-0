import { requestApproval } from "./approvalGate";

export type PermissionLevel = "automatic" | "confirmation" | "blocked";
export type PermissionRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type PermissionOrigin = "planner" | "user" | "system" | "recovery" | "automation";

export type PermissionDecision = {
  action: string;
  risk: PermissionRisk;
  resource?: string;
  origin: PermissionOrigin;
  reason: string;
  requiresConfirmation: boolean;
  allowed: boolean;
  timestamp: string;
  level: PermissionLevel;
};

const automatic = new Set(["worker_health","research_web","file_search","file_read","open_app","navigate"]);
const medium = new Set(["open_file","file_create","file_move","file_rename","run_command"]);
const high = new Set(["close_app","shell_command","open_url","inspect_site","browser_action","send_email","send_message","publish","deploy","contact_prospect"]);
const blocked = new Set(["delete_file","kill_process","credential_change","change_credentials","shutdown","format_disk","spend_money","destructive_command"]);

function riskForAction(action: string): PermissionRisk {
  if (blocked.has(action)) return "CRITICAL";
  if (high.has(action)) return "HIGH";
  if (medium.has(action)) return "MEDIUM";
  return automatic.has(action) ? "LOW" : "HIGH";
}

function levelForRisk(risk: PermissionRisk): PermissionLevel {
  if (risk === "CRITICAL") return "blocked";
  if (risk === "HIGH" || risk === "MEDIUM") return "confirmation";
  return "automatic";
}

export function permissionForAction(action: string): PermissionLevel {
  return levelForRisk(riskForAction(action));
}

export function riskForPermission(level: PermissionLevel): PermissionRisk {
  if (level === "blocked") return "CRITICAL";
  if (level === "confirmation") return "HIGH";
  return "LOW";
}

export function evaluatePermission(action: string, options: { resource?: string; origin?: PermissionOrigin; reason?: string } = {}): PermissionDecision {
  const risk = riskForAction(action);
  const level = levelForRisk(risk);
  return {
    action, risk, resource: options.resource, origin: options.origin ?? "planner",
    reason: options.reason ?? "Política padrão do Agente-0.",
    requiresConfirmation: level === "confirmation",
    allowed: level !== "blocked",
    timestamp: new Date().toISOString(),
    level,
  };
}

export function requestPermission(action: string, reason: string, options: { resource?: string; origin?: PermissionOrigin } = {}) {
  const decision = evaluatePermission(action, { ...options, reason });
  if (!decision.allowed) throw new Error("Ação bloqueada pela política de segurança.");
  if (!decision.requiresConfirmation) return { decision, approval: null };
  const approval = requestApproval(action, decision.risk === "MEDIUM" ? "medium" : "high", reason);
  return { decision, approval };
}
