import{useEffect,useMemo,useState}from"react";import{Activity,BrainCircuit,ChevronRight,Command,Eye,LockKeyhole,Mic,Network,Radio,Shield,Terminal,Volume2,Zap}from"lucide-react";
import{createActionPlanWithAI,type JarvisActionPlan}from"../services/jarvisActionPlan";
import{multiAgentRuntime}from"../services/agentRuntime";
import{discoverUnknown}from"../services/jarvisUnknown";

type Props={go:(p:string)=>void;addApproval:(a:any)=>void};
type Log={id:string;time:string;text:string;kind:string};
const save=(x:Log[])=>localStorage.setItem("jarvis.session.logs",JSON.stringify(x.slice(0,30)));
const load=():Log[]=>{try{return JSON.parse(localStorage.getItem("jarvis.session.logs")||"[]")}catch{return[]}};
export function JarvisOS({go,addApproval}:Props){
 const[cmd,setCmd]=useState("");const[status,setStatus]=useState("READY");const[plan,setPlan]=useState<JarvisActionPlan|null>(null);const[logs,setLogs]=useState<Log[]>(load);const[thinking,setThinking]=useState(false);
 const[time,setTime]=useState(new Date());const[voice,setVoice]=useState(false);
 useEffect(()=>{const id=setInterval(()=>setTime(new Date()),1000);return()=>clearInterval(id)},[]);
 const push=(text:string,kind="SYSTEM")=>{const x={id:crypto.randomUUID(),time:new Date().toLocaleTimeString("pt-BR"),text,kind};setLogs(v=>{const n=[x,...v];save(n);return n})};
 const run=async(input:string)=>{if(!input.trim()||thinking)return;setCmd("");setThinking(true);setStatus("ANALYZING");push(input,"YOU");const base=localStorage.getItem("az:executorUrl")||"http://localhost:8787";const p=await createActionPlanWithAI(input,base);
  if(!p){setStatus("OFFLINE FALLBACK");push("Não foi possível consultar o Action Planner. Use o Intent Engine local ou conecte o Worker + API.","GUARD");setThinking(false);return}
  setPlan(p);push(p.summary,"PLAN");setStatus(p.requiresApproval?"AWAITING APPROVAL":"EXECUTING");
  for(const a of p.actions){
   if(a.type==="navigate"){go(a.path);push("Navegando para "+a.path,"ACTION")}
   if(a.type==="worker_health"){try{const h=await fetch(base+"/health",{signal:AbortSignal.timeout(3000)});const d=await h.json();push("Worker conectado: "+d.status,"ACTION")}catch{push("Worker local indisponível.","GUARD")}}
   if(a.type==="delegate"){const t=multiAgentRuntime.submit(a.goal);push("Missão delegada ao agente runtime: "+t.id.slice(0,8),"AGENT")}
   if(a.type==="open_url"||a.type==="inspect_site"){addApproval({id:crypto.randomUUID(),type:"execução de navegador",title:a.label,description:"Ação externa preparada pelo Action Planner. Requer aprovação explícita.",createdAt:new Date().toISOString(),status:"pending",execution:{type:a.type,url:a.url}});push("Ação externa bloqueada até aprovação.","GUARD");go("/aprovacoes")}
  }
  setStatus(p.requiresApproval?"AWAITING APPROVAL":"READY");setThinking(false)
 };
 const unknown=useMemo(()=>discoverUnknown(),[logs]);
 return <div className="jarvisOS">
  <div className="jarvisOSNoise"/><header className="jarvisOSHeader"><div className="jarvisOSBrand"><div className="jarvisOSMark"><Radio size={18}/></div><div><b>J.A.R.V.I.S.</b><span>PERSONAL INTELLIGENCE OPERATING SYSTEM</span></div></div><div className="jarvisOSClock">{time.toLocaleTimeString("pt-BR")}<small>LOCAL SESSION</small></div><button className="jarvisOSExit" onClick={()=>go("/")}>AGENTE ZERO <ChevronRight size={13}/></button></header>
  <div className="jarvisOSGrid">
   <aside className="jarvisOSRail"><button onClick={()=>go("/jarvis")} className="active"><BrainCircuit/><span>CORE</span></button><button onClick={()=>go("/runtime")}><Network/><span>AGENTS</span></button><button onClick={()=>go("/visao")}><Eye/><span>VISION</span></button><button onClick={()=>go("/memoria")}><Activity/><span>MEMORY</span></button><button onClick={()=>go("/aprovacoes")}><Shield/><span>GUARD</span></button><button onClick={()=>go("/execucao")}><Terminal/><span>OPS</span></button></aside>
   <main className="jarvisOSMain">
    <div className="jarvisOSTelemetry"><span>CORE <b>ONLINE</b></span><span>LOCAL <b>ENCRYPTED</b></span><span>GUARD <b>DEFAULT DENY</b></span><span>MODE <b>HUMAN IN LOOP</b></span></div>
    <section className={"jarvisReactor "+(thinking?"reacting":"")}><div className="reactorOrbit o1"/><div className="reactorOrbit o2"/><div className="reactorOrbit o3"/><div className="reactorCore"><BrainCircuit size={32}/><b>{status}</b><small>JARVIS CORE</small></div></section>
    <section className="jarvisMission"><span className="eyebrow">MISSION INTERFACE // ACTION PLANNER</span><h1>{thinking?"Deixe-me estruturar isso.":"O que você quer que eu descubra?"}</h1><p>Fale naturalmente. O JARVIS interpreta o objetivo, cria um plano, coordena agentes e para diante de qualquer ação que precise da sua autorização.</p><form onSubmit={e=>{e.preventDefault();run(cmd)}}><Command size={17}/><input value={cmd} onChange={e=>setCmd(e.target.value)} placeholder="Ex.: encontre uma oportunidade e monte um plano para ela"/><button disabled={thinking}><Zap size={17}/></button></form></section>
    <section className="jarvisPanels">
     <div className="jarvisPanel"><div className="jPanelTitle"><span>NEURAL PLAN</span><b>{plan?Math.round(plan.confidence*100)+"% CONFIDENCE":"STANDBY"}</b></div>{plan?<><h2>{plan.summary}</h2><p>{plan.reason||"Plano gerado pelo Action Planner."}</p><div className="jSteps">{plan.actions.map((a,i)=><div key={i}><i>{String(i+1).padStart(2,"0")}</i><span>{a.label}</span><small>{a.type.replaceAll("_"," ")}</small></div>)}</div></>:<div className="jEmpty">Nenhuma missão ativa. O núcleo está observando o contexto autorizado.</div>}</div>
     <div className="jarvisPanel"><div className="jPanelTitle"><span>LIVE EVENT STREAM</span><b>{logs.length} EVENTS</b></div><div className="jLogs">{logs.slice(0,7).map(l=><div key={l.id}><time>{l.time}</time><strong>{l.kind}</strong><span>{l.text}</span></div>)}</div></div>
    </section>
    <section className="jarvisBottom"><div><span className="eyebrow">UNKNOWN ENGINE</span><b>{unknown?"ENCONTREI ALGO PARA INVESTIGAR":"SCANNING SYSTEM STATE"}</b><p>{unknown?.title||"Observando conexões entre memória, tarefas, oportunidades e habilidades."}</p></div><button onClick={()=>run("JARVIS, me surpreenda")}>SURPRISE ME <Zap size={14}/></button><div className="jHealth"><span><LockKeyhole size={13}/> APPROVAL GATE</span><span><Volume2 size={13}/> VOICE READY</span><button onClick={()=>{const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;if(!SR){push("Reconhecimento de voz não suportado neste navegador.","GUARD");return}const r=new SR();r.lang="pt-BR";r.continuous=false;r.interimResults=false;setVoice(true);setStatus("LISTENING");r.onresult=(e:any)=>{setVoice(false);setStatus("ANALYZING");run(e.results[0][0].transcript)};r.onerror=()=>{setVoice(false);setStatus("READY")};r.onend=()=>setVoice(false);r.start()}}><Mic size={13}/> {voice?"LISTENING":"TALK TO JARVIS"}</button></div></section>
   </main>
  </div>
 </div>
}
