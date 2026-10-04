export type AgentId="core"|"scout"|"researcher"|"planner"|"builder"|"business"|"analyst"|"vision"|"operator"|"archivist"|"sentinel";
export type AgentStatus="idle"|"thinking"|"working"|"blocked"|"done"|"error";
export type TaskPriority="low"|"normal"|"high"|"critical";
export type AgentTask={id:string,agent:AgentId,goal:string,status:AgentStatus,priority:TaskPriority,parentId?:string,dependsOn?:string[],result?:string,error?:string,createdAt:number,updatedAt:number};
export type AgentEvent={id:string,taskId:string,type:"task.created"|"task.started"|"task.progress"|"task.completed"|"task.failed"|"approval.required",message:string,at:number};
export type AgentProfile={id:AgentId,name:string,role:string,systemPrompt:string,tools:string[],canAct:boolean};
export const AGENT_PROFILES:AgentProfile[]=[
{id:"core",name:"JARVIS Core",role:"Orquestrador",systemPrompt:"Decomponha objetivos, escolha especialistas, acompanhe dependências e consolide resultados.",tools:["router","memory","events"],canAct:false},
{id:"scout",name:"Scout",role:"Descoberta",systemPrompt:"Encontre oportunidades e dados relevantes sem executar ações externas.",tools:["web"],canAct:false},
{id:"researcher",name:"Researcher",role:"Pesquisa",systemPrompt:"Investigue fontes e sintetize fatos com rastreabilidade.",tools:["web","browser"],canAct:false},
{id:"planner",name:"Planner",role:"Planejamento",systemPrompt:"Transforme objetivos em tarefas pequenas, ordenadas e verificáveis.",tools:["planner"],canAct:false},
{id:"builder",name:"Builder",role:"Software",systemPrompt:"Analise, escreva e valide software no escopo autorizado.",tools:["github","filesystem","browser"],canAct:true},
{id:"business",name:"Business",role:"Negócios",systemPrompt:"Analise oportunidades, CRM, propostas e projetos.",tools:["crm","research"],canAct:false},
{id:"analyst",name:"Analyst",role:"Análise",systemPrompt:"Compare resultados, métricas e evidências.",tools:["analytics","memory"],canAct:false},
{id:"vision",name:"Vision",role:"Visão",systemPrompt:"Interprete entradas visuais autorizadas localmente.",tools:["camera","screen"],canAct:false},
{id:"operator",name:"Operator",role:"Computador",systemPrompt:"Execute apenas ações locais explicitamente permitidas e aprovadas.",tools:["computer"],canAct:true},
{id:"archivist",name:"Archivist",role:"Memória",systemPrompt:"Organize fatos, decisões e resultados úteis para memória.",tools:["memory"],canAct:false},
{id:"sentinel",name:"Sentinel",role:"Segurança",systemPrompt:"Valide política, escopo, risco e aprovação antes de ações externas.",tools:["policy","audit"],canAct:true}
];
const now=()=>Date.now();
export class AgentOrchestrator{
 private tasks=new Map<string,AgentTask>(); private listeners=new Set<(e:AgentEvent)=>void>();
 subscribe(fn:(e:AgentEvent)=>void){this.listeners.add(fn);return()=>this.listeners.delete(fn)}
 emit(taskId:string,type:AgentEvent["type"],message:string){const e={id:crypto.randomUUID(),taskId,type,message,at:now()};this.listeners.forEach(fn=>fn(e))}
 create(goal:string,priority:TaskPriority="normal",parentId?:string){const id=crypto.randomUUID();const t={id,agent:"core" as AgentId,goal,status:"idle" as AgentStatus,priority,parentId,createdAt:now(),updatedAt:now()};this.tasks.set(id,t);this.emit(id,"task.created",goal);return t}
 assign(taskId:string,agent:AgentId){const t=this.tasks.get(taskId);if(!t)throw Error("Tarefa não encontrada");t.agent=agent;t.status="working";t.updatedAt=now();this.emit(taskId,"task.started",AGENT_PROFILES.find(a=>a.id===agent)?.name??agent);return t}
 complete(taskId:string,result:string){const t=this.tasks.get(taskId);if(!t)throw Error("Tarefa não encontrada");t.status="done";t.result=result;t.updatedAt=now();this.emit(taskId,"task.completed",result);return t}
 fail(taskId:string,error:string){const t=this.tasks.get(taskId);if(!t)throw Error("Tarefa não encontrada");t.status="error";t.error=error;t.updatedAt=now();this.emit(taskId,"task.failed",error);return t}
 list(){return [...this.tasks.values()].sort((a,b)=>b.createdAt-a.createdAt)}
}
export const agentOrchestrator=new AgentOrchestrator();
