import{useMemo,useState}from"react";
import{BrainCircuit,CheckCircle2,Compass,FlaskConical,GitBranch,Lightbulb,LockKeyhole,Play,RefreshCw,Shield,Target,Zap}from"lucide-react";
import{addInsight,capabilityPipeline,createMission,listInsights,listMissions,scanLocalIntelligence,updateMission,type Mission}from"../services/jarvisIntelligence";
import{studyCapabilityGap}from"../services/jarvisEvolution";
export function JarvisIntelligence(){
 const[,refresh]=useState(0); const missions=listMissions(); const insights=listInsights(); const [goal,setGoal]=useState("");
 const local=useMemo(()=>scanLocalIntelligence(),[refresh]);
 const launch=()=>{if(!goal.trim())return;createMission(goal);setGoal("");refresh(x=>x+1)};
 const evolve=(task:string)=>{studyCapabilityGap(task);refresh(x=>x+1)};
 const advance=(m:Mission)=>{const order:Mission["status"][]=["queued","researching","planning","awaiting_approval","executing","verifying","done"];const i=order.indexOf(m.status);updateMission(m.id,{status:order[Math.min(i+1,order.length-1)]});refresh(x=>x+1)};
 return <div>
  <div className="pagehead"><div><span className="eyebrow">JARVIS // INTELLIGENCE FABRIC</span><h1>Cérebro operacional</h1><p>Missões, memória contextual, descoberta, evolução e verificação em um único ciclo.</p></div><button className="primary" onClick={()=>{local.forEach(x=>addInsight(x));refresh(x=>x+1)}}><RefreshCw size={16}/> Escanear sistema</button></div>
  <div className="metrics">
   <div className="metric"><BrainCircuit size={18}/><span>CORE</span><strong>ONLINE</strong><small>Orquestração</small></div>
   <div className="metric"><Target size={18}/><span>MISSÕES</span><strong>{missions.length}</strong><small>Ciclo persistente</small></div>
   <div className="metric"><Lightbulb size={18}/><span>INSIGHTS</span><strong>{insights.length+local.length}</strong><small>Descobertas locais</small></div>
   <div className="metric"><Shield size={18}/><span>GUARD</span><strong>DEFAULT DENY</strong><small>Humano no loop</small></div>
  </div>
  <section className="panel"><div className="panelhead"><div><span className="eyebrow">MISSION ENGINE</span><h2>Transformar uma ideia em missão</h2></div><Zap size={18}/></div><div className="actionsRow"><input className="input" value={goal} onChange={e=>setGoal(e.target.value)} placeholder="Ex.: encontre oportunidades de sites e prepare a melhor para aprovação"/><button className="primary" onClick={launch}><Play size={15}/> Criar missão</button></div></section>
  <div className="grid2">
   <section className="panel"><div className="panelhead"><div><span className="eyebrow">MISSION QUEUE</span><h2>Missões persistentes</h2></div><Compass size={18}/></div>{missions.length===0?<div className="notice">Nenhuma missão criada ainda.</div>:missions.slice(0,8).map(m=><article className="miniCard" key={m.id} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",gap:12}}><h3>{m.goal}</h3><span className="badge">{m.status.replaceAll("_"," ")}</span></div><p>{m.steps.join(" → ")}</p><button className="ghost" onClick={()=>advance(m)}>Avançar ciclo</button></article>)}</section>
   <section className="panel"><div className="panelhead"><div><span className="eyebrow">UNKNOWN ENGINE</span><h2>O que JARVIS encontrou</h2></div><Lightbulb size={18}/></div>{[...local,...insights].slice(0,8).map((x,i)=><article className="miniCard" key={x.id+"-"+i}><h3>{x.title}</h3><p>{x.detail}</p><span className="badge">{Math.round(x.confidence*100)}% confiança</span></article>)}</section>
  </div>
  <section className="panel"><div className="panelhead"><div><span className="eyebrow">EVOLUTION PIPELINE</span><h2>Quando faltar uma capacidade</h2></div><GitBranch size={18}/></div><div className="cards">{["Pesquisa técnica","Arquitetura isolada","Sandbox","Testes","Sentinel","Sua aprovação","Ativação + rollback"].map((x,i)=><div className="miniCard" key={x}><span className="badge">{String(i+1).padStart(2,"0")}</span><h3>{x}</h3><p>{i<5?"Preparação sem alterar o sistema principal.":i===5?"Nenhuma nova capacidade é ativada sem autorização.":"Capacidade ativada com caminho de reversão."}</p></div>)}</div><div className="actionsRow" style={{marginTop:12}}><button className="primary" onClick={()=>evolve(goal||"Adicionar uma capacidade ainda não disponível")}><FlaskConical size={15}/> Estudar nova capacidade</button><span className="notice"><LockKeyhole size={14}/> Pesquisa não significa ativação automática.</span></div></section>
  <section className="panel"><div className="panelhead"><div><span className="eyebrow">AUTONOMY LOOP</span><h2>Observar → pensar → preparar → aprovar → executar → verificar → aprender</h2></div><CheckCircle2 size={18}/></div><div className="cards"><div className="miniCard"><h3>Researcher</h3><p>Pesquisa e reúne evidências antes da decisão.</p></div><div className="miniCard"><h3>Builder</h3><p>Prepara software em escopo isolado e verificável.</p></div><div className="miniCard"><h3>Operator</h3><p>Executa somente ações locais permitidas e aprovadas.</p></div><div className="miniCard"><h3>Sentinel</h3><p>Bloqueia ações fora do escopo e mantém o humano no loop.</p></div></div></section>
 </div>
}
