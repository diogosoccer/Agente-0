import { auditExecution } from "./jarvisAudit";
import { checkExecutor, runComputerAction, type ComputerAction } from "./executor";
import { requestApproval, assertApproved } from "./approvalGate";

export type LocalTask =
  | { type: "open_app"; value: string; label?: string }
  | { type: "open_file"; value: string; label?: string }
  | { type: "run_command"; command: "system_info" | "git_status" | "node_version" | "npm_version" | "pwd" | "list_files"; label?: string }
  | { type: "worker_health"; label?: string };

export type ExecutionResult = {
  executionId: string;
  status: "success" | "blocked" | "failed";
  result?: unknown;
  approvalId?: string;
  error?: string;
};

const base = () =>
  (typeof window !== "undefined" ? localStorage.getItem("az:executorUrl") : null) ||
  "http://localhost:8787";

export async function requestLocalTaskApproval(task: LocalTask) {
  const action = task.type === "run_command" ? "Executar comando local: " + task.command : task.type;
  const risk = task.type === "run_command" ? "high" : "medium";
  return requestApproval(action, risk, task.label || action);
}

export async function executeApprovedLocalTask(
  approvalId: string,
  task: LocalTask,
): Promise<ExecutionResult> {
  const executionId = crypto.randomUUID();
  assertApproved(approvalId);
  await auditExecution(executionId, task.type, "started", task.label, "user");

  try {
    const root = base();
    if (task.type === "worker_health") {
      const result = await checkExecutor(root);
      await auditExecution(executionId, task.type, "success", JSON.stringify(result), "worker");
      return { executionId, status: "success", result };
    }

    if (task.type === "open_app") {
      const result = await runComputerAction(root, "open_app", task.value);
      await auditExecution(executionId, task.type, "success", JSON.stringify(result), "worker");
      return { executionId, status: "success", result };
    }

    const response = await fetch(root.replace(/\/$/, "") + "/computer/file-or-command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ executionId, approvalId, type: task.type, value: task.value }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || "Worker recusou a tarefa local.");

    await auditExecution(executionId, task.type, "success", JSON.stringify(data), "worker");
    return { executionId, status: "success", result: data };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na execução local.";
    await auditExecution(executionId, task.type, "failed", message, "worker");
    return { executionId, status: "failed", error: message };
  }
}
