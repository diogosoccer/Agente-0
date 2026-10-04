export type EvolutionStatus="pending"|"approved"|"rejected"|"implemented";
export type EvolutionProposal={
 id:string;
 task:string;
 title:string;
 diagnosis:string;
 study:string[];
 proposedChange:string;
 permissions:string[];
 risks:string[];
 tests:string[];
 status:EvolutionStatus;
 createdAt:string;
};

const KEY="jarvis.evolution.v1";
const read=():EvolutionProposal[]=>{try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch{return[]}};
const write=(v:EvolutionProposal[])=>localStorage.setItem(KEY,JSON.stringify(v));

export function studyCapabilityGap(task:string):EvolutionProposal{
 const clean=task.trim();
 const now=new Date().toISOString();
 const proposal:EvolutionProposal={
  id:crypto.randomUUID(),
  task:clean,
  title:"Nova capacidade necessária",
  diagnosis:"JARVIS não possui uma ferramenta, integração ou permissão suficiente para concluir esta tarefa com segurança.",
  study:[
   "Identificar exatamente qual parte da tarefa não está disponível.",
   "Verificar se uma capacidade existente pode ser reutilizada antes de criar código novo.",
   "Definir a menor extensão necessária e separar pesquisa, preparação e execução.",
   "Mapear permissões, dados externos, APIs e riscos envolvidos.",
   "Definir testes para validar a nova capacidade sem executar ações externas."
  ],
  proposedChange:"Criar uma nova Skill/integração isolada, com permissões explícitas, testes e rollback. Nenhum código será ativado automaticamente.",
  permissions:["Sua aprovação para implementar","Sua aprovação separada para ações externas de alto impacto"],
  risks:["A nova capacidade pode precisar de credenciais ou APIs externas.","Integrações externas podem ter limites próprios.","Uma implementação insegura deve ser bloqueada pelo Guard/Sentinel."],
  tests:["Teste unitário da capacidade","Teste em sandbox/dados fictícios","Teste de permissões","Validação manual antes da ativação"],
  status:"pending",
  createdAt:now
 };
 write([proposal,...read()]);
 return proposal;
}

export const evolutionRegistry={
 list:()=>read(),
 approve:(id:string)=>{const v=read().map(x=>x.id===id?{...x,status:"approved" as const}:x);write(v);return v.find(x=>x.id===id)},
 reject:(id:string)=>{const v=read().map(x=>x.id===id?{...x,status:"rejected" as const}:x);write(v);return v.find(x=>x.id===id)},
 markImplemented:(id:string)=>{const v=read().map(x=>x.id===id?{...x,status:"implemented" as const}:x);write(v);return v.find(x=>x.id===id)}
};
