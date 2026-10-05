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

export type JarvisCoreEvent = {
  id: string;
  missionId: string;
  phase: JarvisCoreStatus;
  message: string;
  at: number;
};
export type JarvisCoreResult = { mission: JarvisMission; summary: string; delegated: boolean; attempts: number };
type CoreListener = (event: JarvisCoreEvent) => void;

const missions = new Map<string, JarvisMission>();
const listeners = new Set<CoreListener>();
const emit = (mission: JarvisMission, phase: JarvisCoreStatus, message: string) => {
  const event: JarvisCoreEvent = { id: crypto.randomUUID(), missionId: mission.id, phase, message, at: Date.now() };
  listeners.forEach(listener => { try { listener(event); } catch {} });
};
const persist = (mission: JarvisMission) => void upsertJarvisRecord("mission", mission.id, mission as unknown as Record<string, unknown>);
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function taskFinished(task?: AgentTask) {
  return Boolean(task && (task.status === "done" || task.status === "error"));
}

async function waitForMissionTask(rootTaskId: string, timeoutMs = 45000): Promise<AgentTask> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const tasks = agentOrchestrator.list();
    const root = tasks.find(item => item.id === rootTaskId);
    if (root?.status === "error") return root;

    const specialist = tasks.find(item => item.parentId === rootTaskId);
    if (taskFinished(specialist)) return specialist!;

    await sleep(250);
  }
  throw new Error("Tempo limite aguardando a execução do especialista.");
}

export class JarvisCore {
  subscribe(listener: CoreListener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  get(missionId: string) {
    return missions.get(missionId);
  }

  status() {
    const all = [...missions.values()];
    return {
      total: all.length,
      active: all.filter(item => !["done", "error"].includes(item.status)).length,
      completed: all.filter(item => item.status === "done").length,
      failed: all.filter(item => item.status === "error").length,
    };
  }

  async resume(missionId: string) {
    const mission = missions.get(missionId);
    if (!mission) throw new Error("Missão não encontrada.");
    if (mission.status === "done") return { mission, summary: mission.result || "Missão já concluída.", delegated: Boolean(mission.taskId), attempts: mission.attempts };
    return this.run(mission.goal, mission);
  }
  async run(goal: string, existingMission?: JarvisMission): Promise<JarvisCoreResult> {
    const cleanGoal = goal.trim();
    if (!cleanGoal) throw new Error("Objetivo vazio.");

    const mission: JarvisMission = existingMission || {
      id: createOperationId("mission"),
      goal: cleanGoal,
      status: "planning",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      attempts: 0,
    };
    missions.set(mission.id, mission);
    persist(mission);
    emit(mission, "planning", "JARVIS Core iniciou a missão.");

    try {
      const execution = await executeWithRecovery(
        async (attempt) => {
          mission.attempts = attempt;
          emit(mission, attempt > 1 ? "recovering" : "planning", attempt > 1 ? "Tentando recuperação da missão." : "Planejando execução.");
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
          emit(mission, "executing", "Execução delegada ao sistema de agentes.");
          mission.updatedAt = Date.now();
          persist(mission);

          const finished = await waitForMissionTask(task.id);
          if (finished.status === "error") throw new Error(finished.error || "Agente falhou.");

          mission.status = "verifying";
          emit(mission, "verifying", "Verificando o resultado.");
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
            emit(mission, "recovering", "Recuperação acionada: " + String(reason));
            mission.status = "recovering";
            mission.error = String(reason);
            mission.updatedAt = Date.now();
            persist(mission);
          },
        },
      );

      const finished = execution.result;
      mission.status = "done";
      emit(mission, "done", "Missão concluída e validada.");
      mission.result = finished.result || "Missão concluída sem resumo textual.";
      mission.error = undefined;
      mission.updatedAt = Date.now();
      persist(mission);
      rememberIfImportant("Missão concluída: " + mission.goal + ". Resultado: " + mission.result, "system");

      return {
        mission,
        summary: mission.result,
        delegated: Boolean(mission.taskId),
        attempts: mission.attempts,
      };
    } catch (error) {
      mission.status = "error";
      emit(mission, "error", mission.error || "Falha na missão.");
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
