import { multiAgentRuntime } from "../services/agentRuntime";
import { agentOrchestrator, AgentTask } from "../services/agentOrchestrator";
import { rememberIfImportant, recallMemoriesDeep, type JarvisImportantMemory } from "../services/jarvisMemory";
import { createActionPlanWithAI, type JarvisActionPlan } from "../services/jarvisActionPlan";
import { listJarvisRecords, upsertJarvisRecord } from "../services/jarvisPersistence";
import { createOperationId, withTimeout } from "./stability";
import { verifyResult } from "./verificationEngine";
import { executeWithRecovery } from "./recoveryEngine";

export type JarvisCoreStatus = "idle" | "planning" | "executing" | "verifying" | "recovering" | "done" | "error";
export type JarvisMission = { id:string; goal:string; status:JarvisCoreStatus; createdAt:number; updatedAt:number; attempts:number; result?:string; error?:string; taskId?:string; plan?:JarvisActionPlan; memoryIds?:string[] };
export type JarvisCoreEvent = { id:string; missionId:string; phase:JarvisCoreStatus; message:string; at:number };
export type JarvisCoreResult = { mission:JarvisMission; summary:string; delegated:boolean; attempts:number; plan?:JarvisActionPlan; memories?:JarvisImportantMemory[] };
type CoreListener=(event:JarvisCoreEvent)=>void;

const missions=new Map<string,JarvisMission>(); const listeners=new Set<CoreListener>();
const emit=(mission:JarvisMission,phase:JarvisCoreStatus,message:string)=>{const event={id:crypto.randomUUID(),missionId:mission.id,phase,message,at:Date.now()};listeners.forEach(listener=>{try{listener(event)}catch{}})};
const persist=(mission:JarvisMission)=>void upsertJarvisRecord("mission",mission.id,mission as unknown as Record<string,unknown>);
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const workerBase=()=> (typeof window!=="undefined"?localStorage.getItem("az:executorUrl"):null)||"http://localhost:8787";

function taskFinished(task?:AgentTask){return Boolean(task&&(task.status==="done"||task.status==="error"))}
async function waitForMissionTask(rootTaskId:string,timeoutMs=45000):Promise<AgentTask>{const started=Date.now();while(Date.now()-started<timeoutMs){const tasks=agentOrchestrator.list();const root=tasks.find(item=>item.id===rootTaskId);if(root?.status==="error")return root;const specialist=tasks.find(item=>item.parentId===rootTaskId);if(taskFinished(specialist))return specialist!;await sleep(250)}throw new Error("Tempo limite aguardando a execução do especialista.")}

function formatMemoryContext(memories:JarvisImportantMemory[]){return memories.length?memories.map((m,i)=>`[Memória ${i+1} | ${m.category}] ${m.content}`).join("\n"):"Nenhuma memória relevante encontrada."}

export class JarvisCore{
 subscribe(listener:CoreListener){listeners.add(listener);return()=>listeners.delete(listener)}
 get(missionId:string){return missions.get(missionId)}
 status(){const all=[...missions.values()];return{total:all.length,active:all.filter(x=>!["done","error"].includes(x.status)).length,completed:all.filter(x=>x.status==="done").length,failed:all.filter(x=>x.status==="error").length}}
 async resume(missionId:string){const mission=missions.get(missionId);if(!mission)throw new Error("Missão não encontrada.");if(mission.status==="done")return{mission,summary:mission.result||"Missão já concluída.",delegated:Boolean(mission.taskId),attempts:mission.attempts,plan:mission.plan};return this.run(mission.goal,mission)}

 async run(goal:string,existingMission?:JarvisMission):Promise<JarvisCoreResult>{
  const cleanGoal=goal.trim();if(!cleanGoal)throw new Error("Objetivo vazio.");
  const mission=existingMission||{id:createOperationId("mission"),goal:cleanGoal,status:"planning" as const,createdAt:Date.now(),updatedAt:Date.now(),attempts:0};
  missions.set(mission.id,mission);persist(mission);emit(mission,"planning","JARVIS Core iniciou a missão.");
  try{
   const memories=await recallMemoriesDeep(cleanGoal,8);
   mission.memoryIds=memories.map(m=>m.id);mission.updatedAt=Date.now();persist(mission);
   emit(mission,"planning",memories.length?`Memória contextual recuperada: ${memories.length} registro(s).`:"Nenhuma memória contextual relevante.");
   const context=formatMemoryContext(memories);
   const plannerInput=`Objetivo do usuário:\n${cleanGoal}\n\nContexto persistente autorizado:\n${context}\n\nPlaneje sem inventar ações concluídas. Ações externas continuam protegidas por aprovação humana.`;
   let plan:JarvisActionPlan|null=null;
   try{plan=await createActionPlanWithAI(plannerInput,workerBase());if(plan){mission.plan=plan;mission.updatedAt=Date.now();persist(mission);emit(mission,"planning",`Plano IA criado com ${plan.actions.length} etapa(s), confiança ${Math.round(plan.confidence*100)}%.`)}}catch{}
   const execution=await executeWithRecovery(async attempt=>{
    mission.attempts=attempt;mission.status=attempt>1?"recovering":"planning";mission.updatedAt=Date.now();persist(mission);emit(mission,attempt>1?"recovering":"planning",attempt>1?"Tentando recuperação da missão.":"Estruturando execução.");
    const enrichedGoal=plan?[
      "Objetivo original: "+cleanGoal,
      "Memórias relevantes autorizadas:",
      context,
      "Plano produzido pelo JARVIS:",
      plan.summary,
      plan.actions.map((a,i)=>`${i+1}. ${a.label} [${a.type}]`).join("\n"),
      "Nunca considere uma etapa externa executada sem aprovação e evidência."
    ].join("\n\n"):cleanGoal+"\n\nMemórias relevantes:\n"+context;
    const task=await withTimeout(Promise.resolve(multiAgentRuntime.submit(enrichedGoal)),5000,"Delegação JARVIS");
    mission.taskId=task.id;mission.status="executing";mission.updatedAt=Date.now();persist(mission);emit(mission,"executing","Execução delegada ao sistema de agentes.");
    const finished=await waitForMissionTask(task.id);if(finished.status==="error")throw new Error(finished.error||"Agente falhou.");
    mission.status="verifying";mission.updatedAt=Date.now();persist(mission);emit(mission,"verifying","Verificando o resultado.");return finished;
   },cleanGoal,{maxAttempts:3,verify:task=>verifyResult(cleanGoal,{success:task.status==="done",status:task.status,output:task.result,evidence:task.result?[task.result]:[]}),onRetry:async(_,reason)=>{mission.status="recovering";mission.error=String(reason);mission.updatedAt=Date.now();persist(mission);emit(mission,"recovering","Recuperação acionada: "+String(reason))}});
   const finished=execution.result;mission.status="done";mission.result=finished.result||"Missão concluída sem resumo textual.";mission.error=undefined;mission.updatedAt=Date.now();persist(mission);emit(mission,"done","Missão concluída e validada.");rememberIfImportant("Missão concluída: "+cleanGoal+". Resultado: "+mission.result,"system");
   return{mission,summary:mission.result,delegated:Boolean(mission.taskId),attempts:mission.attempts,plan,memories};
  }catch(error){mission.status="error";mission.error=error instanceof Error?error.message:"Falha desconhecida";mission.updatedAt=Date.now();persist(mission);emit(mission,"error",mission.error);throw error}
 }
 list(){return[...missions.values()].sort((a,b)=>b.createdAt-a.createdAt)}
 async hydrate(){const rows=await listJarvisRecords("mission",200);for(const row of rows){const mission=row.data as unknown as JarvisMission;if(mission?.id&&mission?.goal)missions.set(mission.id,mission)}}
}

export const jarvisCore=new JarvisCore();