import{useState}from"react";
import{evolutionRegistry,type EvolutionProposal}from"../services/jarvisEvolution";

export function JarvisEvolution(){
 const[items,setItems]=useState<EvolutionProposal[]>(evolutionRegistry.list());
 const refresh=()=>setItems(evolutionRegistry.list());
 const pending=items.filter(x=>x.status==="pending");
 return <main className="pageShell evolutionPage"><section className="panel"><div className="panelhead"><div><span className="eyebrow">SELF-EVOLUTION // HUMAN GATE</span><h1>Capacidades que JARVIS ainda não possui</h1></div><span className="liveBadge">PERMISSION REQUIRED</span></div>
 <p>Quando uma tarefa está fora das capacidades atuais, JARVIS pode estudar como adicionar a função. Ele não altera o próprio código nem ativa uma integração sem sua autorização.</p>
 {pending.length===0&&<div className="jEmpty">Nenhuma proposta aguardando sua decisão.</div>}
 <div className="skillList">{items.map(x=><article key={x.id}><div><strong>{x.title}</strong><small>{x.task} · {x.status}</small><p>{x.diagnosis}</p><details><summary>Ver estudo e plano</summary><ul>{x.study.map(s=><li key={s}>{s}</li>)}</ul><b>Alteração proposta</b><p>{x.proposedChange}</p><b>Permissões</b><ul>{x.permissions.map(s=><li key={s}>{s}</li>)}</ul><b>Testes</b><ul>{x.tests.map(s=><li key={s}>{s}</li>)}</ul></details></div>{x.status==="pending"&&<div className="evolutionActions"><button className="primary" onClick={()=>{evolutionRegistry.approve(x.id);refresh()}}>AUTORIZAR ESTUDO/IMPLEMENTAÇÃO</button><button onClick={()=>{evolutionRegistry.reject(x.id);refresh()}}>RECUSAR</button></div>}</article>)}</div>
 </section></main>
}
