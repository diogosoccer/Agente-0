import { auditExecution } from "./jarvisAudit";
import { checkExecutor, runComputerAction, openLocalFile, runSafeLocalCommand } from "./executor";
import { executeLocalAction, approveAndExecuteLocalAction, type LocalAction } from "./localExecutor";
import { requestApproval, assertApproved } from "./approvalGate";

export type LocalTask =
  | { type: "open_app"; value: string; label?: string }
  | { type: "open_file"; value: string; label?: string }
  | { type: "close_app"; value: string; label?: string }
  | { type: "file_search"; root?: string; query: string; limit?: number; label?: string }
  | { type: "file_read"; value: string; label?: string }
  | { type: "file_create"; path: string; content?: string; contentFromStep?: number; label?: string }
  | { type: "file_move"; source: string; destination: string; label?: string }
  | { type: "file_rename"; source: string; name: string; label?: string }
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
  const automatic = task.type === "worker_health" || task.type === "file_search" || task.type === "file_read";
  const risk = task.type === "run_command" || !automatic ? "high" : "low";
  return requestApproval(action, risk, task.label || action);
}

export async function executeApprovedLocalTask(
  approvalId: string,
  task: LocalTask,
): Promise<ExecutionResult> {
  const executionId = crypto.randomUUID();
  const needsApproval = !["worker_health", "file_search", "file_read"].includes(task.type);
  if (needsApproval) assertApproved(approvalId);
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

    if (task.type === "open_file") {
      const data = await openLocalFile(root, task.value);
      await auditExecution(executionId, task.type, "success", JSON.stringify(data), "worker");
      return { executionId, status: "success", result: data };
    }

    if (task.type === "run_command" || task.type === "worker_health") {
      const data = task.type === "worker_health" ? await checkExecutor(root) : await runSafeLocalCommand(root, task.command);
      await auditExecution(executionId, task.type, "success", JSON.stringify(data), "worker");
      return { executionId, status: "success", result: data };
    }

    const localAction: LocalAction =
      task.type === "close_app" ? { action: "close_app", app: task.value } :
      task.type === "file_search" ? { action: "file_search", root: task.root, query: task.query, limit: task.limit } :
      task.type === "file_read" ? { action: "file_read", path: task.value } :
      task.type === "file_create" ? { action: "file_create", path: task.path, content: task.content || "" } :
      task.type === "file_move" ? { action: "file_move", source: task.source, destination: task.destination } :
      task.type === "file_rename" ? { action: "file_rename", source: task.source, name: task.name } :
      (() => { throw new Error("Tipo de tarefa local não suportado."); })();

    const data = needsApproval
      ? await approveAndExecuteLocalAction(localAction, crypto.randomUUID(), crypto.randomUUID())
      : await executeLocalAction(localAction, undefined, crypto.randomUUID());
    if (data?.waitingApproval) throw new Error("Executor local aguardando aprovação adicional.");

    await auditExecution(executionId, task.type, "success", JSON.stringify(data), "worker");
    return { executionId, status: "success", result: data };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na execução local.";
    await auditExecution(executionId, task.type, "failed", message, "worker");
    return { executionId, status: "failed", error: message };
  }
}
