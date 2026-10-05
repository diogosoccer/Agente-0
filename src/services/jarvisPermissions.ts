import { requestApproval } from "./approvalGate";
import type { MissionRisk } from "./jarvisMissionEngine";

export type PermissionLevel = "automatic" | "confirmation" | "blocked";

const automatic = new Set(["worker_health", "research_web", "file_search", "file_read", "open_app"]);
const confirmation = new Set(["open_url", "inspect_site", "browser_action", "close_app", "file_create", "file_move", "file_rename", "run_command", "open_file"]);
const blocked = new Set(["delete_file", "kill_process", "credential_change", "shutdown", "format_disk"]);

export function permissionForAction(type: string): PermissionLevel {
  if (blocked.has(type)) return "blocked";
  if (confirmation.has(type)) return "confirmation";
  return automatic.has(type) ? "automatic" : "confirmation";
}

export function riskForPermission(level: PermissionLevel): MissionRisk {
  if (level === "blocked") return "critical";
  if (level === "confirmation") return "high";
  return "low";
}

export function requestPermission(action: string, reason: string) {
  const level = permissionForAction(action);
  if (level === "blocked") throw new Error("Ação bloqueada pela política de segurança.");
  if (level === "automatic") return { level, approval: null };
  const approval = requestApproval(action, "high", reason);
  return { level, approval };
}
