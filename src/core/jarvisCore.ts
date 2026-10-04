import { multiAgentRuntime } from "../services/agentRuntime";
import { rememberIfImportant } from "../services/jarvisMemory";
import { createOperationId, withTimeout } from "./stability";

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
};

export type JarvisCoreResult = {
  mission: JarvisMission;
  summary: string;
  delegated: boolean;
};

const missions = new Map<string, JarvisMission>();

export class JarvisCore {
  async run(goal: string): Promise<JarvisCoreResult> {
    const mission: JarvisMission = {
      id: createOperationId("mission"),
      goal: goal.trim(),
      status: "planning",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      attempts: 0,
    };
    missions.set(mission.id, mission);
    if (!mission.goal) throw new Error("Objetivo vazio.");

    try {
      mission.status = "executing";
      mission.updatedAt = Date.now();
      const task = await withTimeout(Promise.resolve(multiAgentRuntime.submit(mission.goal)), 5000, "Delegação JARVIS");
      mission.status = "verifying";
      mission.updatedAt = Date.now();
      const summary = "Missão criada e delegada ao sistema multiagente. Acompanhe o resultado pela missão.";
      mission.status = "done";
      mission.result = summary;
      mission.updatedAt = Date.now();
      rememberIfImportant("Missão criada: " + mission.goal, "system");
      return { mission, summary, delegated: Boolean(task?.id) };
    } catch (error) {
      mission.status = "error";
      mission.error = error instanceof Error ? error.message : "Falha desconhecida";
      mission.updatedAt = Date.now();
      throw error;
    }
  }

  list(): JarvisMission[] {
    return [...missions.values()].sort((a,b) => b.createdAt - a.createdAt);
  }
}

export const jarvisCore = new JarvisCore();
