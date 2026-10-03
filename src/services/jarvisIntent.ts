export type JarvisIntent =
  | "unknown_discovery" | "dashboard" | "opportunities" | "crm" | "finance"
  | "memory" | "approvals" | "execution" | "vision" | "agents" | "tasks"
  | "settings" | "status" | "help" | "agent";

export type IntentMatch = { intent: JarvisIntent; confidence: number; label: string; examples: string[] };

const normalize=(s:string)=>s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();

const patterns: Array<{intent:JarvisIntent; label:string; keys:string[]; examples:string[]}> = [
  {intent:"unknown_discovery",label:"Descoberta",keys:["me surpreenda","surpreenda","o que tem de interessante","encontre algo","o que eu nao estou vendo","o que voce faria agora","tem alguma coisa errada"],examples:["Me surpreenda","O que você encontrou?"]},
  {intent:"opportunities",label:"Oportunidades",keys:["oportunidades","empresas sem site","procure empresas","procure vendas","encontre clientes","ache oportunidades"],examples:["Procure oportunidades","Encontre empresas sem site"]},
  {intent:"crm",label:"CRM",keys:["crm","clientes","meus clientes"],examples:["Abra meu CRM","Mostre meus clientes"]},
  {intent:"finance",label:"Financeiro",keys:["financeiro","dinheiro","saldo","receita","despesas","lucro"],examples:["Abra o financeiro","Como está meu dinheiro?"]},
  {intent:"memory",label:"Memória",keys:["memoria","o que voce lembra","lembretes"],examples:["Abra sua memória","O que você lembra?"]},
  {intent:"approvals",label:"Aprovações",keys:["aprovacoes","pendencias","o que precisa da minha aprovacao"],examples:["O que precisa da minha aprovação?"]},
  {intent:"execution",label:"Execução",keys:["executor","navegador","executa","abra no computador","controle do computador"],examples:["Mostre a execução","Abra no navegador"]},
  {intent:"vision",label:"Visão",keys:["camera","cameras","visao","veja"],examples:["Abra as câmeras","Mostre a visão"]},
  {intent:"agents",label:"Agentes",keys:["equipe","agentes","multi agente"],examples:["Mostre sua equipe","Abra os agentes"]},
  {intent:"tasks",label:"Tarefas",keys:["tarefas","pendentes","o que falta fazer"],examples:["Mostre minhas tarefas"]},
  {intent:"settings",label:"Configurações",keys:["configuracoes","configuracao","preferencias"],examples:["Abra as configurações"]},
  {intent:"status",label:"Status",keys:["status do computador","worker","esta tudo funcionando","sistema esta funcionando"],examples:["Está tudo funcionando?"]},
  {intent:"help",label:"Ajuda",keys:["o que voce sabe fazer","como posso falar","quais comandos","me ensine","ajuda"],examples:["O que você sabe fazer?"]},
];

export function understand(input:string): IntentMatch | null {
  const text=normalize(input).replace(/^hey\s+jarvis[,\s]*/,"");
  if(!text)return null;
  let best: IntentMatch|null=null;
  for(const p of patterns){
    const score=p.keys.reduce((n,k)=>n+(text.includes(normalize(k))?1:0),0);
    if(score>0){
      const confidence=Math.min(0.99,0.58+score*0.12);
      if(!best||confidence>best.confidence) best={intent:p.intent,confidence,label:p.label,examples:p.examples};
    }
  }
  return best;
}

export function suggestedPhrases(): IntentMatch[] {
  return patterns.map(p=>({intent:p.intent,confidence:1,label:p.label,examples:p.examples}));
}

export function helpReply():string {
  return "Você não precisa decorar comandos. Fale naturalmente: “me surpreenda”, “procure oportunidades”, “abra meu CRM”, “o que precisa da minha aprovação?”, “analise minhas tarefas” ou “o que você sabe fazer?”.";
}
