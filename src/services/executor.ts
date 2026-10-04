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
