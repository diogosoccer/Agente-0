export type ExecutorStatus = "connected" | "offline" | "busy";
export type BrowserTaskType = "open_url" | "inspect_site" | "capture_page";

export interface BrowserTask {
  id: string;
  type: BrowserTaskType;
  url: string;
  approved: boolean;
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

export async function runBrowserTask(baseUrl: string, task: BrowserTask) {
  const response = await fetch(baseUrl.replace(/\/$/, "") + "/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task),
  });
  if (!response.ok) throw new Error("Executor recusou a tarefa.");
  return response.json();
}
