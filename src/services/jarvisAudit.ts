import { upsertJarvisRecord } from "./jarvisPersistence";

export type JarvisAuditOutcome = "started" | "success" | "failed" | "blocked";

export type JarvisAuditEntry = {
  id: string;
  executionId: string;
  action: string;
  outcome: JarvisAuditOutcome;
  actor: "user" | "jarvis" | "worker";
  detail?: string;
  startedAt: string;
  finishedAt?: string;
};

export async function auditExecution(
  executionId: string,
  action: string,
  outcome: JarvisAuditOutcome,
  detail?: string,
  actor: JarvisAuditEntry["actor"] = "jarvis",
) {
  const entry: JarvisAuditEntry = {
    id: crypto.randomUUID(),
    executionId,
    action,
    outcome,
    actor,
    detail,
    startedAt: new Date().toISOString(),
    ...(outcome === "started" ? {} : { finishedAt: new Date().toISOString() }),
  };
  await upsertJarvisRecord("execution", entry.id, entry as unknown as Record<string, unknown>);
  await upsertJarvisRecord("event", entry.id, {
    type: "execution.audit",
    executionId,
    action,
    outcome,
    actor,
    detail: detail || "",
    at: entry.finishedAt || entry.startedAt,
  });
  return entry;
}
