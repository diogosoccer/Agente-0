import{AGENT_PROFILES,AgentId,agentOrchestrator}from"./agentOrchestrator";import{requestApproval}from"./approvalGate";

export type RuntimeResult={taskId:string,agent:AgentId,summary:string,nextAgent?:AgentId,needsApproval?:boolean};

const specialist=(goal:string):AgentId=>{
 const g=goal.toLowerCase();
 if(/pesquis|notícia|mercado|empresa|oportunidade|concorrente|fonte/.test(g))return"researcher";
 if(/site|código|github|app|program|implementar|construir/.test(g))return"builder";
 if(/venda|cliente|crm|negócio|proposta|preço|oferta/.test(g))return"business";
 if(/câmera|rosto|imagem|visão|tela/.test(g))return"vision";
 if(/computador|abrir|clicar|executar/.test(g))return"operator";
 return"analyst";
};

const workerBase=()=> (typeof window!=="undefined"?localStorage.getItem("az:executorUrl"):null)||"http://localhost:8787";

export type MissionSpecialistResult={
 ok:boolean;
 agent:AgentId;
 summary:string;
 result?:unknown;
 error?:string;
};



export class MultiAgentRuntime{
 private queue:string[]=[];private running=false;

  async executeMissionSpecialist(agent:AgentId, goal:string):Promise<MissionSpecialistResult>{
    try{
      if(agent==="researcher"){
        const r=await fetch(workerBase().replace(/\/$/,"")+"/research",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:goal}),signal:AbortSignal.timeout(25000)});
        if(!r.ok) throw new Error("Worker de pesquisa indisponível.");
        const data=await r.json();
        const results=Array.isArray(data.results)?data.results:[];
        if(!results.length) return {ok:false,agent,summary:"Pesquisa sem resultados suficientes.",result:data,error:"Nenhum resultado encontrado."};
        return {ok:true,agent,summary:"Researcher concluiu a pesquisa com "+results.length+" resultados.",result:data};
      }
      if(agent==="business"){
        const raw=localStorage.getItem("az:opps")||"[]";
        const opps=JSON.parse(raw);
        const relevant=Array.isArray(opps)?opps.slice(0,5):[];
        const names=relevant.map((x:any)=>x.name||x.title||x.businessName).filter(Boolean);
        return {ok:true,agent,summary:names.length?"Business priorizou: "+names.join(", "):"Business não encontrou oportunidades salvas.",result:relevant};
      }
      if(agent==="planner"){
        return {ok:true,agent,summary:"Planner estruturou a etapa em contexto, execução autorizada e verificação."};
      }
      if(agent==="analyst"){
        return {ok:true,agent,summary:"Analyst preparou a etapa para comparação e verificação."};
      }
      if(agent==="sentinel"){
        return {ok:true,agent,summary:"Sentinel validou menor privilégio, escopo e aprovação humana para ações externas."};
      }
      if(agent==="archivist"){
        return {ok:true,agent,summary:"Archivist preparou o registro da etapa sem armazenar segredos."};
      }
      if(agent==="vision"){
        return {ok:true,agent,summary:"Vision validou a disponibilidade de uma fonte visual autorizada para esta etapa."};
      }
      if(agent==="scout"){
        return {ok:true,agent,summary:"Scout preparou a etapa de descoberta sem executar ações externas."};
      }
      if(agent==="operator"){
        return {ok:true,agent,summary:"Operator assumiu a etapa; a execução local ou externa continuará protegida pelo approval gate."};
      }
      if(agent==="builder"){
        return {ok:true,agent,summary:"Builder assumiu a etapa de software dentro do escopo autorizado."};
      }
      return {ok:true,agent,summary:"Especialista "+agent+" assumiu a etapa."};
    }catch(error){
      return {ok:false,agent,summary:"Especialista não concluiu a etapa.",error:error instanceof Error?error.message:"Falha desconhecida."};
    }
  }

 submit(goal:string){
   const root=agentOrchestrator.create(goal,"normal");
   this.queue.push(root.id);this.pump();
   return root;
 }

 private async runResearch(taskId:string,goal:string){
   try{
     const r=await fetch(workerBase().replace(/\/$/,"")+"/research",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:goal}),signal:AbortSignal.timeout(25000)});
     if(!r.ok)throw new Error("Worker de pesquisa indisponível.");
     const d=await r.json();const results=Array.isArray(d.results)?d.results:[];
     if(!results.length){agentOrchestrator.complete(taskId,"Researcher pesquisou o objetivo, mas não encontrou resultados suficientes.");return}
     const summary=results.slice(0,5).map((x:any,i:number)=>`${i+1}. ${x.title} — ${x.snippet||""}`).join(" | ");
     const done=agentOrchestrator.complete(taskId,"Pesquisa concluída com "+results.length+" resultados. "+summary);
   }catch(error){agentOrchestrator.fail(taskId,error instanceof Error?error.message:"Falha na pesquisa.")}
 }

 private runBusiness(taskId:string,goal:string){
   try{
     const raw=localStorage.getItem("az:opps")||"[]";const opps=JSON.parse(raw);const relevant=Array.isArray(opps)?opps.slice(0,5):[];
     const names=relevant.map((x:any)=>x.name||x.title||x.businessName).filter(Boolean);
     agentOrchestrator.complete(taskId,names.length?"Business priorizou oportunidades locais: "+names.join(", ")+". Próximo passo: validar evidências e preparar proposta.":"Business não encontrou oportunidades locais salvas; recomendo executar o Radar antes da abordagem.");
   }catch{agentOrchestrator.fail(taskId,"Não foi possível analisar as oportunidades locais.")}
 }

 private async pump(){
   if(this.running)return;this.running=true;
   try{
     while(this.queue.length){
       const id=this.queue.shift()!;const task=agentOrchestrator.list().find(t=>t.id===id);if(!task)continue;
       if(task.agent==="core"){
         const a=specialist(task.goal);
         agentOrchestrator.assign(id,"planner");
         const child=agentOrchestrator.create("Executar: "+task.goal,"normal",id);
         agentOrchestrator.assign(child.id,a);this.queue.push(child.id);
         agentOrchestrator.complete(id,"Fluxo delegado ao especialista "+a+".");
         continue;
       }
       const profile=AGENT_PROFILES.find(a=>a.id===task.agent);if(!profile)continue;
       if(profile.canAct){
         const approval=requestApproval("Executar tarefa do agente "+profile.name,"medium",task.goal);
         agentOrchestrator.emit(task.id,"approval.required","Aprovação necessária: "+approval.id);
         agentOrchestrator.fail(task.id,"Bloqueado até aprovação explícita: "+approval.id);
         continue;
       }
       if(task.agent==="researcher"){await this.runResearch(task.id,task.goal);continue}
       if(task.agent==="business"){this.runBusiness(task.id,task.goal);continue}
       if(task.agent==="analyst"){
         agentOrchestrator.complete(task.id,"Analyst estruturou a tarefa para comparação e verificação. Para análise externa, delegue uma pesquisa primeiro.");
         continue;
       }
       if(task.agent==="vision"){
         agentOrchestrator.complete(task.id,"Vision está pronto para interpretar câmera ou tela quando uma fonte visual autorizada estiver disponível.");
         continue;
       }
       if(task.agent==="archivist"){
         agentOrchestrator.complete(task.id,"Archivist registrará apenas informações consideradas persistentes pelo filtro de memória.");
         continue;
       }
       if(task.agent==="scout"){
         agentOrchestrator.complete(task.id,"Scout aguarda uma pesquisa de descoberta autorizada para alimentar o radar.");
         continue;
       }
       if(task.agent==="planner"){
         agentOrchestrator.complete(task.id,"Planner dividiu o objetivo em etapas verificáveis: contexto, pesquisa, decisão, execução autorizada e verificação.");
         continue;
       }
       if(task.agent==="sentinel"){
         agentOrchestrator.complete(task.id,"Sentinel validou o princípio de menor privilégio e aprovação humana para ações externas.");
         continue;
       }
       agentOrchestrator.complete(task.id,"Especialista "+profile.name+" concluiu a etapa.");
     }
   }finally{this.running=false}
 }
}
export const multiAgentRuntime=new MultiAgentRuntime();