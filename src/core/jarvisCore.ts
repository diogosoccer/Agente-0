import { multiAgentRuntime } from "../services/agentRuntime";
import { agentOrchestrator, AgentTask } from "../services/agentOrchestrator";
import { rememberIfImportant } from "../services/jarvisMemory";
import { listJarvisRecords, upsertJarvisRecord } from "../services/jarvisPersistence";
import { createOperationId, withTimeout } from "./stability";
import { verifyResult } from "./verificationEngine";
import { executeWithRecovery } from "./recoveryEngine";

export type JarvisCoreStatus = "idle" | "planning" | "executing" | "verifying" | "recovering" | "done" | "error";

export type JarvisMission = {
  id: string;
  goal: string;
  status: JarvisCoreStatus;
  createdAt: number;
  updatedAt: number;
  attempts: number;
  result?: string;
  error?: string;
  taskId?: string;
};

export type JarvisCoreResult = { mission: JarvisMission; summary: string; delegated: boolean };

const missions = new Map<string, JarvisMission>();
const persist = (mission: JarvisMission) => void upsertJarvisRecord("mission", mission.id, mission as unknown as Record<string, unknown>);
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function taskFinished(task?: AgentTask) {
  return Boolean(task && (task.status === "done" || task.status === "error"));
}

async function waitForTask(taskId: string, timeoutMs = 45000): Promise<AgentTask> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const task = agentOrchestrator.list().find(item => item.id === taskId);
    if (taskFinished(task)) return task!;
    await sleep(250);
  }
  throw new Error("Tempo limite aguardando a execução do agente.");
}

export class JarvisCore {
  async run(goal: string): Promise<JarvisCoreResult> {
    const cleanGoal = goal.trim();
    if (!cleanGoal) throw new Error("Objetivo vazio.");

    const mission: JarvisMission = {
      id: createOperationId("mission"),
      goal: cleanGoal,
      status: "planning",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      attempts: 0,
    };
    missions.set(mission.id, mission);
    persist(mission);

    try {
      const execution = await executeWithRecovery(
        async (attempt) => {
          mission.attempts = attempt;
          mission.status = attempt > 1 ? "recovering" : "planning";
          mission.updatedAt = Date.now();
          persist(mission);

          const task = await withTimeout(
            Promise.resolve(multiAgentRuntime.submit(mission.goal)),
            5000,
            "Delegação JARVIS",
          );
          mission.taskId = task.id;
          mission.status = "executing";
          mission.updatedAt = Date.now();
          persist(mission);

          const finished = await waitForTask(task.id);
          if (finished.status === "error") throw new Error(finished.error || "Agente falhou.");

          mission.status = "verifying";
          mission.updatedAt = Date.now();
          persist(mission);
          return finished;
        },
        mission.goal,
        {
          maxAttempts: 3,
          verify: (task) => verifyResult(mission.goal, {
            success: task.status === "done",
            status: task.status,
            output: task.result,
            evidence: task.result ? [task.result] : [],
          }),
          onRetry: async (_, reason) => {
            mission.status = "recovering";
            mission.error = String(reason);
            mission.updatedAt = Date.now();
            persist(mission);
          },
        },
      );

      const finished = execution.result;
      mission.status = "done";
      mission.result = finished.result || "Missão concluída sem resumo textual.";
      mission.error = undefined;
      mission.updatedAt = Date.now();
      persist(mission);
      rememberIfImportant("Missão concluída: " + mission.goal + ". Resultado: " + mission.result, "system");

      return {
        mission,
        summary: mission.result,
        delegated: Boolean(mission.taskId),
      };
    } catch (error) {
      mission.status = "error";
      mission.error = error instanceof Error ? error.message : "Falha desconhecida";
      mission.updatedAt = Date.now();
      persist(mission);
      throw error;
    }
  }

  list(): JarvisMission[] {
    return [...missions.values()].sort((a, b) => b.createdAt - a.createdAt);
  }

  async hydrate() {
    const rows = await listJarvisRecords("mission", 200);
    for (const row of rows) {
      const mission = row.data as unknown as JarvisMission;
      if (mission?.id && mission?.goal) missions.set(mission.id, mission);
    }
  }
}

export const jarvisCore = new JarvisCore();
