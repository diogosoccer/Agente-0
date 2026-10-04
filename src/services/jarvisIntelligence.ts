export type MissionStatus="queued"|"researching"|"planning"|"awaiting_approval"|"executing"|"verifying"|"done"|"blocked";
export type Mission={id:string;goal:string;status:MissionStatus;steps:string[];createdAt:string;updatedAt:string;result?:string};
export type Insight={id:string;kind:"opportunity"|"risk"|"improvement"|"memory"|"skill";title:string;detail:string;confidence:number;createdAt:string};
const MKEY="jarvis.missions.v1", IKEY="jarvis.insights.v1";
const read=<T,>(key:string,fallback:T):T=>{try{return JSON.parse(localStorage.getItem(key)||"null")??fallback}catch{return fallback}};
const write=(key:string,v:unknown)=>localStorage.setItem(key,JSON.stringify(v));
export function createMission(goal:string):Mission{
 const now=new Date().toISOString();
 const mission:Mission={id:crypto.randomUUID(),goal:goal.trim(),status:"queued",steps:["Entender objetivo","Pesquisar contexto autorizado","Planejar solução","Aguardar aprovação quando necessário","Executar somente ações permitidas","Verificar resultado","Registrar aprendizado"],createdAt:now,updatedAt:now};
 write(MKEY,[mission,...read<Mission[]>(MKEY,[])]);
 return mission;
}
export function updateMission(id:string,patch:Partial<Mission>){
 const missions=read<Mission[]>(MKEY,[]).map(m=>m.id===id?{...m,...patch,updatedAt:new Date().toISOString()}:m);
 write(MKEY,missions); return missions.find(m=>m.id===id);
}
export function listMissions(){return read<Mission[]>(MKEY,[])}
export function addInsight(input:Omit<Insight,"id"|"createdAt">):Insight{
 const item:Insight={...input,id:crypto.randomUUID(),createdAt:new Date().toISOString()};
 write(IKEY,[item,...read<Insight[]>(IKEY,[])]); return item;
}
export function listInsights(){return read<Insight[]>(IKEY,[])}
export function scanLocalIntelligence():Insight[]{
 const memory=read<any[]>("az:memory",[]), opps=read<any[]>("az:opps",[]), tasks=read<any[]>("az:tasks",[]);
 const findings:Insight[]=[];
 if(opps.length) findings.push({id:"opps",kind:"opportunity",title:"Oportunidades podem virar missões compostas",detail:`${opps.length} oportunidade(s) já existem no contexto local. O próximo passo é ligar descoberta → pesquisa → proposta → projeto.`,confidence:.95,createdAt:new Date().toISOString()});
 if(memory.length>=3) findings.push({id:"memory",kind:"memory",title:"A memória já pode alimentar decisões",detail:`${memory.length} registros locais podem ser recuperados por contexto antes de iniciar uma nova missão.`,confidence:.9,createdAt:new Date().toISOString()});
 if(tasks.length) findings.push({id:"tasks",kind:"improvement",title:"Tarefas antigas podem ser agrupadas em habilidades",detail:"Padrões repetidos devem virar Skills revisáveis, com permissões explícitas e rollback.",confidence:.88,createdAt:new Date().toISOString()});
 return findings;
}
export function capabilityPipeline(task:string){
 return {task,stages:["gap_detected","research_plan","architecture","sandbox","tests","sentinel_review","user_approval","activation","rollback_ready"] as const};
}
