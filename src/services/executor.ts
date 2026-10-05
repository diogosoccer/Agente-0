export type ExecutorStatus = "connected" | "offline" | "busy";
export type BrowserTaskType = "open_url" | "inspect_site" | "capture_page";

export interface BrowserTask {
  id: string;
  type: BrowserTaskType;
  url: string;
  approved?: boolean;
  approvalToken?: string;
  createdAt: string;
}

export interface ExecutorHealth {
  status: ExecutorStatus;
  version?: string;
}

export async function checkExecutor(baseUrl: string): Promise<ExecutorHealth> {
  try {
    const response = await fetch(baseUrl.replace(/\/$/, "") + "/health", { signal: AbortSignal.timeout(2500) });
    if (!response.ok) return { status: "offline" };
    return await response.json();
  } catch {
    return { status: "offline" };
  }
}

export async function approveBrowserTask(baseUrl: string, task: BrowserTask): Promise<string> {
  const response = await fetch(baseUrl.replace(/\/$/, "") + "/approve", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: task.id, type: task.type, url: task.url })
  });
  if (!response.ok) throw new Error("Executor recusou a aprovação.");
  const data = await response.json();
  if (!data.approvalToken) throw new Error("Executor não forneceu token de aprovação.");
  return data.approvalToken;
}

export async function runBrowserTask(baseUrl: string, task: BrowserTask) {
  const response = await fetch(baseUrl.replace(/\/$/, "") + "/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...task, approved: undefined }),
  });
  if (!response.ok) throw new Error("Executor recusou a tarefa.");
  return response.json();
}


export type ComputerAction = "open_app" | "type" | "key" | "hotkey";
export type SafeCommand = "system_info" | "git_status" | "node_version" | "npm_version" | "pwd" | "list_files";

export async function runComputerAction(
  baseUrl: string,
  action: ComputerAction,
  value: string,
): Promise<{ ok: boolean; action: string; value: string; platform?: string }> {
  const root = baseUrl.replace(/\/$/, "");
  const id = crypto.randomUUID();
  const approval = await fetch(root + "/computer/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, action, value }),
    signal: AbortSignal.timeout(5000),
  });
  if (!approval.ok) throw new Error("Worker recusou o controle do computador.");
  const approved = await approval.json();
  if (typeof approved.approvalToken !== "string") throw new Error("Worker não forneceu token de controle.");
  const response = await fetch(root + "/computer/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, action, value, approvalToken: approved.approvalToken }),
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || "Falha no controle do computador.");
  return data;
}


export async function runSafeLocalCommand(baseUrl: string, command: SafeCommand) {
  const root = baseUrl.replace(/\/$/, "");
  const id = crypto.randomUUID();
  const approval = await fetch(root + "/command/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, command }), signal: AbortSignal.timeout(5000) });
  if (!approval.ok) throw new Error("Worker recusou o comando local.");
  const approved = await approval.json();
  if (typeof approved.approvalToken !== "string") throw new Error("Worker não forneceu token do comando.");
  const response = await fetch(root + "/command/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, command, approvalToken: approved.approvalToken }), signal: AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || "Falha ao executar comando local.");
  return data;
}

export async function openLocalFile(baseUrl: string, path: string) {
  const root = baseUrl.replace(/\/$/, "");
  const id = crypto.randomUUID();
  const approval = await fetch(root + "/computer/file-approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, path }), signal: AbortSignal.timeout(5000) });
  if (!approval.ok) throw new Error("Worker recusou a abertura do arquivo.");
  const approved = await approval.json();
  if (typeof approved.approvalToken !== "string") throw new Error("Worker não forneceu token do arquivo.");
  const response = await fetch(root + "/computer/file-open", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, path, approvalToken: approved.approvalToken }), signal: AbortSignal.timeout(10000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || "Falha ao abrir arquivo.");
  return data;
}
