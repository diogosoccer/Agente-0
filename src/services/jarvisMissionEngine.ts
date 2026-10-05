import type { JarvisActionPlan, JarvisPlanAction } from "./jarvisActionPlan";
import type { AgentId } from "./agentOrchestrator";
import { multiAgentRuntime } from "./agentRuntime";
import { auditExecution } from "./jarvisAudit";
import { executeApprovedLocalTask, requestLocalTaskApproval, type LocalTask } from "./jarvisExecution";
import { listJarvisRecords, upsertJarvisRecord } from "./jarvisPersistence";
import { chooseRecovery } from "./jarvisRecovery";

export type MissionStatus =
  | "pending" | "running" | "waiting_approval" | "verifying"
  | "recovering" | "completed" | "failed" | "cancelled";

export type MissionStepStatus =
  | "pending" | "running" | "waiting_approval" | "verifying"
  | "success" | "failed" | "skipped";

export type MissionRisk = "low" | "medium" | "high" | "critical";

export type MissionStep = {
  id: string;
  missionId: string;
  index: number;
  action: JarvisPlanAction;
  agent: AgentId;
  status: MissionStepStatus;
  risk: MissionRisk;
  attempts: number;
  maxAttempts: number;
  dependsOn: string[];
  result?: unknown;
  error?: string;
  approvalId?: string;
  approvalType?: "local_task" | "browser" | "computer";
  startedAt?: string;
  finishedAt?: string;
  specialistSummary?: string;
  recoveryStrategy?: string;
};

export type JarvisMission = {
  id: string;
  goal: string;
  summary: string;
  status: MissionStatus;
  currentStep: number;
  totalSteps: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
};

export type MissionRunnerDeps = {
  navigate?: (path: string) => void;
  research?: (query: string) => Promise<unknown>;
  delegate?: (goal: string) => Promise<unknown> | unknown;
  requestApproval?: (step: MissionStep) => Promise<{ id: string }>;
  executeApprovedLocal?: (step: MissionStep, approvalId: string) => Promise<unknown>;
};

const now = () => new Date().toISOString();
const riskOf = (a: JarvisPlanAction): MissionRisk => {
  if (a.type === "navigate" || a.type === "worker_health" || a.type === "research_web") return "low";
  if (a.type === "delegate") return "medium";
  return "high";
};

const agentForAction = (action: JarvisPlanAction): AgentId => {
  if (action.type === "research_web" || action.type === "inspect_site") return "researcher";
  if (action.type === "navigate" || action.type === "open_url" || action.type === "browser_action") return "operator";
  if (action.type === "open_app" || action.type === "open_file" || action.type === "run_command") return "operator";
  if (action.type === "delegate") return "planner";
  if (action.type === "worker_health") return "sentinel";
  return "analyst";
};

const saveMission = (mission: JarvisMission) =>
  upsertJarvisRecord("mission", mission.id, mission as unknown as Record<string, unknown>);

const saveStep = (step: MissionStep) =>
  upsertJarvisRecord("task", step.id, step as unknown as Record<string, unknown>);

async function transition(mission: JarvisMission, status: MissionStatus, detail?: string) {
  mission.status = status;
  mission.updatedAt = now();
  if (detail) mission.error = detail;
  await saveMission(mission);
  await auditExecution(mission.id, "mission:" + status, status === "completed" ? "success" : status === "failed" ? "failed" : "started", detail);
}

export function buildMissionFromPlan(plan: JarvisActionPlan): {
  mission: JarvisMission;
  steps: MissionStep[];
} {
  const missionId = crypto.randomUUID();
  const mission: JarvisMission = {
    id: missionId,
    goal: plan.input,
    summary: plan.summary,
    status: "pending",
    currentStep: 0,
    totalSteps: plan.actions.length,
    createdAt: now(),
    updatedAt: now(),
  };
  const steps = plan.actions.map((action, index) => ({
    id: crypto.randomUUID(),
    missionId,
    index,
    action,
    agent: agentForAction(action),
    status: "pending" as const,
    risk: riskOf(action),
    attempts: 0,
    maxAttempts: riskOf(action) === "low" ? 3 : 1,
    dependsOn: index > 0 ? [String(index - 1)] : [],
  }));
  return { mission, steps };
}

async function verifyStep(step: MissionStep, result: unknown) {
  if (result === undefined || result === null) return false;
  if (typeof result === "object" && result !== null && "ok" in result && (result as {ok?: boolean}).ok === false) return false;
  if (step.action.type === "browser_action") {
    const r = result as Record<string, unknown>;
    if (r.ok !== true) return false;
    if (step.action.action === "extract") return typeof r.text === "string" && r.text.trim().length > 0;
    if (step.action.action === "screenshot") return typeof r.screenshot === "string" && r.screenshot.length > 0;
    if (step.action.action === "fill") return r.filled === true;
    if (step.action.action === "press") return typeof r.pressed === "string" && r.pressed.length > 0;
    if (step.action.action === "click" || step.action.action === "navigate") return typeof r.url === "string" && r.url.length > 0;
  }
  return true;
}

function dependenciesSatisfied(step: MissionStep, steps: MissionStep[]) { return step.dependsOn.every(dep => { const byIndex = steps.find(s => String(s.index) === dep); return Boolean(byIndex && byIndex.status === "success"); }); }

async function runStep(step: MissionStep, deps: MissionRunnerDeps) {
  const action = step.action;
  if (action.type === "navigate") {
    deps.navigate?.(action.path);
    return { ok: true, navigatedTo: action.path };
  }
  if (action.type === "worker_health") {
    const result = await fetch("http://localhost:8787/health", { signal: AbortSignal.timeout(3000) }).then(r => {
      if (!r.ok) throw new Error("Worker offline.");
      return r.json();
    });
    return result;
  }
  if (action.type === "research_web") {
    if (!deps.research) throw new Error("Callback de pesquisa não configurado.");
    return deps.research(action.query);
  }
  if (action.type === "delegate") {
    if (!deps.delegate) throw new Error("Callback de delegação não configurado.");
    return deps.delegate(action.goal);
  }
  if (action.type === "open_url" || action.type === "inspect_site" || action.type === "browser_action") {
    if (!deps.requestApproval) throw new Error("Ação externa requer aprovação explícita.");
    const approval = await deps.requestApproval(step);
    step.approvalId = approval.id;
    step.approvalType = "browser";
    step.status = "waiting_approval";
    await saveStep(step);
    return { waitingApproval: true, approvalId: approval.id };
  }
  if (action.type === "open_app") {
    const approval = deps.requestApproval
      ? await deps.requestApproval(step)
      : await requestLocalTaskApproval({ type: "open_app", value: action.app, label: action.label });
    step.approvalId = approval.id;
    step.approvalType = "local_task";
    step.status = "waiting_approval";
    await saveStep(step);
    return { waitingApproval: true, approvalId: approval.id };
  }
  if (action.type === "open_file") {
    const approval = deps.requestApproval
      ? await deps.requestApproval(step)
      : await requestLocalTaskApproval({ type: "open_file", value: action.path, label: action.label });
    step.approvalId = approval.id;
    step.status = "waiting_approval";
    await saveStep(step);
    return { waitingApproval: true, approvalId: approval.id };
  }
  if (action.type === "run_command") {
    const approval = deps.requestApproval
      ? await deps.requestApproval(step)
      : await requestLocalTaskApproval({ type: "run_command", command: action.command, label: action.label });
    step.approvalId = approval.id;
    step.status = "waiting_approval";
    await saveStep(step);
    return { waitingApproval: true, approvalId: approval.id };
  }
  const exhaustive: never = action;
  return exhaustive;
}

export async function runMission(
  mission: JarvisMission,
  steps: MissionStep[],
  deps: MissionRunnerDeps = {},
): Promise<{ mission: JarvisMission; steps: MissionStep[] }> {
  await transition(mission, "running");
  for (let i = mission.currentStep; i < steps.length; i++) {
    const step = steps[i];
    mission.currentStep = i;
    if (!dependenciesSatisfied(step, steps)) { step.status = "skipped"; step.error = "Dependência anterior não concluída."; await saveStep(step); mission.status = "failed"; mission.error = step.error; mission.updatedAt = now(); await saveMission(mission); await auditExecution(step.id, "step:" + step.action.type, "failed", step.error); return { mission, steps }; }
    step.status = "running";
    step.attempts += 1;
    step.startedAt = now();
    await saveMission(mission);
    await saveStep(step);
    await auditExecution(step.id, "step:" + step.action.type, "started", step.action.label);

    try {
      const specialistGoal = step.action.type === "research_web"
        ? step.action.query
        : step.action.type === "delegate"
          ? step.action.goal
          : step.action.label;
      const specialist = await multiAgentRuntime.executeMissionSpecialist(step.agent, specialistGoal);
      step.specialistSummary = specialist.summary;
      await saveStep(step);
      await auditExecution(step.id, "specialist:" + step.agent, specialist.ok ? "success" : "failed", specialist.summary);
      if (!specialist.ok) throw new Error(specialist.error || "Especialista não concluiu a etapa.");

      const result = step.action.type === "research_web"
        ? specialist.result
        : await runStep(step, deps);
      if (result && typeof result === "object" && "waitingApproval" in result) {
        mission.status = "waiting_approval";
        mission.updatedAt = now();
        await saveMission(mission);
        await auditExecution(step.id, "step:" + step.action.type, "blocked", "Aguardando aprovação.");
        return { mission, steps };
      }

      step.status = "verifying";
      step.result = result;
      mission.status = "verifying";
      mission.updatedAt = now();
      await saveMission(mission);
      await saveStep(step);

      const verificationInput = {
        specialist: step.specialistSummary,
        result,
      };
      await auditExecution(step.id, "verification:input", "started", JSON.stringify(verificationInput).slice(0, 2000));
      if (!(await verifyStep(step, result))) {
        await auditExecution(step.id, "verification:result", "failed", "Resultado não apresentou evidência suficiente.");
        throw new Error("Verificação da etapa falhou.");
      }
      await auditExecution(step.id, "verification:result", "success", "Resultado validado com evidência disponível.");
      step.status = "success";
      step.finishedAt = now();
      await saveStep(step);
      await auditExecution(step.id, "step:" + step.action.type, "success", "Etapa verificada.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida.";
      step.error = message;
      step.status = "failed";
      await saveStep(step);
      await auditExecution(step.id, "step:" + step.action.type, "failed", message);

      if (step.attempts < step.maxAttempts) {
        const recovery = chooseRecovery(step);
        if (recovery) {
          step.action = recovery.action;
          step.recoveryStrategy = recovery.strategy;
          step.specialistSummary = undefined;
          await auditExecution(step.id, "recovery:strategy", "started", recovery.strategy);
        }
        step.status = "pending";
        mission.status = "recovering";
        mission.error = message;
        mission.updatedAt = now();
        await saveMission(mission);
        await saveStep(step);
        i -= 1;
        continue;
      }

      mission.status = "failed";
      mission.error = message;
      mission.updatedAt = now();
      await saveMission(mission);
      return { mission, steps };
    }
  }

  mission.status = "completed";
  mission.completedAt = now();
  mission.updatedAt = now();
  mission.currentStep = steps.length;
  await saveMission(mission);
  await auditExecution(mission.id, "mission:completed", "success", "Todas as etapas foram executadas e verificadas.");
  return { mission, steps };
}

export async function resumeMission(
  missionId: string,
  deps: MissionRunnerDeps = {},
) {
  const missions = await listJarvisRecords("mission", 100);
  const tasks = await listJarvisRecords("task", 500);
  const missionRow = missions.find(r => r.id === missionId);
  if (!missionRow) throw new Error("Missão não encontrada.");
  const mission = missionRow.data as unknown as JarvisMission;
  const steps = tasks
    .filter(r => (r.data as {missionId?: string})?.missionId === missionId)
    .map(r => r.data as unknown as MissionStep)
    .sort((a,b) => a.index - b.index);
  if (!steps.length) throw new Error("Missão sem etapas persistidas.");
  const firstIncomplete = steps.findIndex(s => s.status !== "success");
  mission.currentStep = firstIncomplete < 0 ? steps.length : firstIncomplete;
  return runMission(mission, steps, deps);
}

export async function completeApprovedMissionStep(
  missionId: string,
  approvalId: string,
  result: unknown,
  deps: MissionRunnerDeps = {},
) {
  const missions = await listJarvisRecords("mission", 100);
  const tasks = await listJarvisRecords("task", 500);
  const missionRow = missions.find(r => r.id === missionId);
  if (!missionRow) throw new Error("Missão não encontrada.");
  const mission = missionRow.data as unknown as JarvisMission;
  const steps = tasks.filter(r => (r.data as {missionId?: string})?.missionId === missionId)
    .map(r => r.data as unknown as MissionStep).sort((a,b) => a.index-b.index);
  const step = steps.find(s => s.approvalId === approvalId);
  if (!step) throw new Error("Etapa de aprovação não encontrada.");
  if (step.status === "success") return { mission, steps };
  if (!(await verifyStep(step, result))) throw new Error("Resultado aprovado não passou na verificação.");
  step.result = result;
  step.status = "success";
  step.finishedAt = now();
  await saveStep(step);
  await auditExecution(step.id, "step:approved", "success", "Ação aprovada e verificada.");
  mission.currentStep = step.index + 1;
  mission.status = "running";
  mission.updatedAt = now();
  await saveMission(mission);
  return runMission(mission, steps, deps);
}

export async function approveAndResumeMission(
  missionId: string,
  approvalId: string,
  deps: MissionRunnerDeps = {},
) {
  const missions = await listJarvisRecords("mission", 100);
  const tasks = await listJarvisRecords("task", 500);
  const missionRow = missions.find(r => r.id === missionId);
  if (!missionRow) throw new Error("Missão não encontrada.");
  const mission = missionRow.data as unknown as JarvisMission;
  const steps = tasks.filter(r => (r.data as {missionId?: string})?.missionId === missionId)
    .map(r => r.data as unknown as MissionStep).sort((a,b) => a.index-b.index);
  const step = steps.find(s => s.approvalId === approvalId);
  if (!step) throw new Error("Etapa de aprovação não encontrada.");
  const local = step.action.type === "open_app"
    ? ({type:"open_app",value:step.action.app,label:step.action.label} as LocalTask)
    : step.action.type === "open_file"
      ? ({type:"open_file",value:step.action.path,label:step.action.label} as LocalTask)
      : step.action.type === "run_command"
        ? ({type:"run_command",command:step.action.command,label:step.action.label} as LocalTask)
        : null;
  if (!local) throw new Error("Aprovação não corresponde a uma tarefa local.");
  const result = deps.executeApprovedLocal
    ? await deps.executeApprovedLocal(step, approvalId)
    : await executeApprovedLocalTask(approvalId, local);
  step.result = result;
  step.status = "success";
  step.finishedAt = now();
  await saveStep(step);
  await auditExecution(step.id, "step:approved", "success", "Ação aprovada e verificada.");
  mission.currentStep = step.index + 1;
  mission.status = "running";
  await saveMission(mission);
  return runMission(mission, steps, deps);
}

export async function createAndRunMission(
  plan: JarvisActionPlan,
  deps: MissionRunnerDeps = {},
) {
  const { mission, steps } = buildMissionFromPlan(plan);
  await saveMission(mission);
  for (const step of steps) await saveStep(step);
  await auditExecution(mission.id, "mission:created", "started", plan.summary);
  return runMission(mission, steps, deps);
}

export async function cancelMission(missionId: string) {
  const missions = await listJarvisRecords("mission", 100);
  const row = missions.find(r => r.id === missionId);
  if (!row) throw new Error("Missão não encontrada.");
  const mission = row.data as unknown as JarvisMission;
  if (mission.status === "completed" || mission.status === "failed" || mission.status === "cancelled") return mission;
  mission.status = "cancelled";
  mission.updatedAt = now();
  mission.error = "Missão cancelada pelo usuário.";
  await saveMission(mission);
  await auditExecution(mission.id, "mission:cancelled", "blocked", mission.error);
  return mission;
}
