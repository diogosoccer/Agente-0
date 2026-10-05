export type PermissionLevel = "automatic" | "confirmation" | "blocked";

export type LocalAction =
  | { action: "open_app"; app: string }
  | { action: "close_app"; app: string }
  | { action: "file_search"; root?: string; query: string; limit?: number }
  | { action: "file_read"; path: string }
  | { action: "file_create"; path: string; content: string }
  | { action: "file_move"; source: string; destination: string }
  | { action: "file_rename"; source: string; name: string }
  | { action: "run_command"; command: string };

const base = () => (typeof window !== "undefined" ? localStorage.getItem("az:localExecutorUrl") : null) || "http://127.0.0.1:8788";

async function post(path: string, payload: Record<string, unknown>, timeout = 30000) {
  const response = await fetch(base() + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeout),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || "Executor local recusou a operação.");
  return data;
}

export async function checkLocalExecutor() {
  try {
    const response = await fetch(base() + "/health", { signal: AbortSignal.timeout(2500) });
    return response.ok ? await response.json() : { status: "offline" };
  } catch {
    return { status: "offline" };
  }
}

export async function getPermission(action: string): Promise<{ permission: PermissionLevel }> {
  return post("/permissions/check", { action });
}

export async function executeLocalAction(action: LocalAction, approvalToken?: string, id = crypto.randomUUID()) {
  const permission = (await getPermission(action.action)).permission;
  if (permission === "blocked") throw new Error("Ação bloqueada pela política de segurança.");
  if (permission === "confirmation" && !approvalToken) {
    const approval = await post("/approve", { id, ...action });
    return { ok: false, waitingApproval: true, id, approvalToken: approval.approvalToken, permission };
  }
  return post("/action", { id, ...action, approvalToken });
}

export async function approveAndExecuteLocalAction(action: LocalAction, _approvalToken: string, id: string) {
  const permission = (await getPermission(action.action)).permission;
  if (permission === "blocked") throw new Error("Ação bloqueada pela política de segurança.");
  if (permission === "automatic") return post("/action", { id, ...action });
  const approval = await post("/approve", { id, ...action });
  if (typeof approval.approvalToken !== "string") throw new Error("Executor local não gerou token de execução.");
  return post("/action", { id, ...action, approvalToken: approval.approvalToken });
}

export type VerificationStatus = "EXECUTED" | "VERIFIED" | "FAILED" | "UNCERTAIN";

export async function verifyLocalAction(action: LocalAction) {
  return post("/verify", action as unknown as Record<string, unknown>, 10000) as Promise<{
    ok: boolean;
    status: VerificationStatus;
    verified: boolean;
    evidence?: unknown;
    error?: string;
  }>;
}