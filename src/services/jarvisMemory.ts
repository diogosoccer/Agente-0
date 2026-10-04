import { listJarvisRecords, upsertJarvisRecord, deleteJarvisRecord } from "./jarvisPersistence";
export type JarvisMemoryCategory = "Estratégia" | "Clientes" | "Operação" | "Financeiro" | "Aprendizados";
export type JarvisImportantMemory = { id:string; category:JarvisMemoryCategory; title:string; content:string; importance:number; createdAt:string; source:"conversation"|"system"; reason?:string };
const KEY="az:memory";
const read=():JarvisImportantMemory[]=>{try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch{return[]}};
const write=(items:JarvisImportantMemory[])=>localStorage.setItem(KEY,JSON.stringify(items.slice(0,300)));
const normalize=(s:string)=>s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim();
const sensitive=/(senha|password|token|api[- ]?key|chave secreta|secret|codigo de acesso|cartao|cvv|cpf|rg|numero do documento)/i;
const transient=/(^(oi|ola|olá|bom dia|boa tarde|boa noite|obrigado|obrigada|valeu|tchau)[!,. ]*$|\b(toca|toque|coloque|play|noticias|notícia|horario|que horas|como esta o tempo|piada)\b)/i;
const lowValue=/(^(ok|beleza|blz|sim|nao|não|entendi|certo|show|legal|haha)[!,. ]*$|\b(me ajuda|o que e|o que é|como faco|como faço|qual e|qual é)\b.*\?)/i;
export function assessImportance(text:string){
 const value=text.trim(); if(!value||sensitive.test(value)||transient.test(value)||lowValue.test(value)) return {important:false,score:0,reason:"sem valor persistente ou sensível"};
 const n=normalize(value); let score=0; let reason="";
 if(/\b(lembre|memorize|guarde|nao esqueca|nao esqueça|não esqueça|registre isso|salve isso)\b/.test(n)){score+=1;reason="pedido explícito de memória"}
 if(/\b(eu prefiro|eu gosto|eu nao gosto|eu não gosto|meu objetivo|meu sonho|daqui pra frente|sempre|nunca|evite|prefiro|quero que voce sempre|quero que você sempre)\b/.test(n)){score+=.85;reason=reason||"preferência ou regra persistente"}
 if(/\b(decidi|decisao|decisão|vamos usar|vamos fazer|fica definido|escolhi|a partir de agora|definimos)\b/.test(n)){score+=.85;reason=reason||"decisão de longo prazo"}
 if(/\b(eu sou|eu trabalho|moro em|minha cidade|meu negocio|meu negócio|meu projeto|meu app|meu site|estou construindo|estou criando|estou desenvolvendo|minha meta|meu objetivo)\b/.test(n)){score+=.7;reason=reason||"contexto pessoal ou de projeto"}
 if(/\b(cliente|empresa|marca|venda|repositorio|repositório|github|lovable|agente zero|jarvis)\b/.test(n)&&value.length>=45){score+=.45;reason=reason||"contexto relevante do trabalho"}
 if(/\b(na verdade|correcao|correção|está errado|esta errado|o certo e|o certo é|corrigindo)\b/.test(n)){score+=.75;reason=reason||"correção importante"}
 if(value.length>140&&/[?!.]/.test(value))score+=.15;
 return {important:score>=.55,score:Math.min(1,score),reason:reason||"relevância contextual"};
}
const categoryFor=(n:string):JarvisMemoryCategory=>/cliente|empresa|marca|venda|contato/.test(n)?"Clientes":/dinheiro|receita|preco|preço|custo|finance/.test(n)?"Financeiro":/erro|correcao|correção|aprendi|aprendizado|licao|lição/.test(n)?"Aprendizados":/prefer|objetivo|decidi|decisao|decisão|meta|estrateg|estratég/.test(n)?"Estratégia":"Operação";
export function rememberIfImportant(text:string,source:"conversation"|"system"="conversation"){
 const a=assessImportance(text); if(!a.important)return null;
 const clean=text.trim().replace(/\s+/g," "); const n=normalize(clean); const existing=read();
 if(existing.some(x=>normalize(x.content)===n))return null;
 const related=existing.find(x=>{const words=n.split(" ").filter(w=>w.length>4);return words.slice(0,10).filter(w=>normalize(x.content).includes(w)).length>=3});
 if(related&&a.score>=related.importance){const merged={...related,content:clean,importance:a.score,createdAt:new Date().toISOString(),reason:a.reason};write(existing.map(x=>x.id===related.id?merged:x));void upsertJarvisRecord("memory",merged.id,merged as unknown as Record<string,unknown>);window.dispatchEvent(new Event("jarvis-memory-updated"));return merged}
 const item:JarvisImportantMemory={id:crypto.randomUUID(),category:categoryFor(n),title:"Memória importante",content:clean,importance:a.score,createdAt:new Date().toISOString(),source,reason:a.reason};
 write([item,...existing]); void upsertJarvisRecord("memory", item.id, item as unknown as Record<string, unknown>); window.dispatchEvent(new Event("jarvis-memory-updated"));return item;
}
export function listImportantMemories(){return read().sort((a,b)=>b.importance-a.importance||b.createdAt.localeCompare(a.createdAt));}
export function forgetMemory(id:string){write(read().filter(x=>x.id!==id)); void deleteJarvisRecord("memory", id); window.dispatchEvent(new Event("jarvis-memory-updated"));}

export async function hydrateImportantMemories(){
 const rows=await listJarvisRecords("memory",300);
 if(!rows.length)return;
 const remote=rows.map(r=>r.data as unknown as JarvisImportantMemory).filter(x=>x?.id&&x?.content);
 const merged=[...remote,...read().filter(local=>!remote.some(x=>x.id===local.id))].slice(0,300);
 write(merged);
 window.dispatchEvent(new Event("jarvis-memory-updated"));
}