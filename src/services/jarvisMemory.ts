export type JarvisMemoryCategory = "preferencia" | "objetivo" | "decisao" | "contexto" | "aprendizado" | "correcao";
export type JarvisImportantMemory = { id:string; category:JarvisMemoryCategory; title:string; content:string; importance:number; createdAt:string; source:"conversation"|"system" };
const KEY="az:memory";
const read=():JarvisImportantMemory[]=>{try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch{return[]}};
const write=(items:JarvisImportantMemory[])=>localStorage.setItem(KEY,JSON.stringify(items.slice(0,200)));
const normalize=(s:string)=>s.toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g,"");
const sensitive=/(senha|password|token|api[- ]?key|chave secreta|secret|codigo de acesso|cartao|cvv|documento|cpf|rg)\\s*[:=]?/i;
const transient=/(^|\\s)(oi|ola|olá|bom dia|boa tarde|boa noite|obrigado|valeu|toca|toque|coloque|play|noticias|notícias)(\\s|$)/i;
export function assessImportance(text:string){
 const value=text.trim(); if(!value||sensitive.test(value)) return {important:false,score:0,reason:"transitório ou sensível"};
 const n=normalize(value); let score=0; let reason="";
 if(/\\b(lembre|memorize|guarde|nao esqueca|não esqueca|nao esqueça|não esqueça)\\b/.test(n)){score+=1;reason="pedido explícito de memória"}
 if(/\\b(eu prefiro|eu gosto|eu nao gosto|eu não gosto|meu objetivo|quero no longo prazo|daqui pra frente|sempre|nunca|evite|prefiro)\\b/.test(n)){score+=.8;reason=reason||"preferência ou regra persistente"}
 if(/\\b(decidi|decisão|decisao|vamos usar|vamos fazer|fica definido|escolhi|a partir de agora)\\b/.test(n)){score+=.8;reason=reason||"decisão"}
 if(/\\b(meu projeto|meu negócio|meu negocio|meu app|meu site|estou construindo|estou criando|meta)\\b/.test(n)){score+=.55;reason=reason||"contexto de longo prazo"}
 if(/\\b(na verdade|correção|correcao|está errado|esta errado|o certo é|o certo e)\\b/.test(n)){score+=.7;reason=reason||"correção importante"}
 if(value.length>180&&/[?!.]/.test(value))score+=.15;
 return {important:score>=.55,score,reason:reason||"baixo valor de longo prazo"};
}
export function rememberIfImportant(text:string, source:"conversation"|"system"="conversation"){
 const a=assessImportance(text); if(!a.important)return null;
 const clean=text.trim().replace(/\\s+/g," ");
 const item:JarvisImportantMemory={id:crypto.randomUUID(),category:/prefiro|gosto|sempre|nunca|evite/.test(normalize(clean))?"preferencia":/decidi|decisao|decisão|definido/.test(normalize(clean))?"decisao":/correcao|correção|certo/.test(normalize(clean))?"correcao":/objetivo|meta|longo prazo/.test(normalize(clean))?"objetivo":"contexto",title:"Memória importante",content:clean,importance:Math.min(1,a.score),createdAt:new Date().toISOString(),source};
 const existing=read(); const duplicate=existing.some(x=>normalize(x.content)===normalize(clean)); if(duplicate)return null;
 write([item,...existing]); return item;
}
export function listImportantMemories(){return read().sort((a,b)=>b.importance-a.importance||b.createdAt.localeCompare(a.createdAt));}
export function forgetMemory(id:string){write(read().filter(x=>x.id!==id));}
