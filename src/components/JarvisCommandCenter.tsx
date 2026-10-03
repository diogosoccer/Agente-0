import{Activity,Brain,ShieldCheck,Wifi,WifiOff}from"lucide-react";
import{JARVIS_CAPABILITIES}from"../services/jarvisCapabilities";

export function JarvisCommandCenter(){
 return <section className="panel jarvisCenter"><div className="panelhead"><div><span className="eyebrow">JARVIS SYSTEM</span><h2>Centro de comando</h2></div><Activity size={18}/></div>
 <div className="jarvisMeters"><div><Brain size={15}/><span>Cérebro</span><b>ORQUESTRADOR</b></div><div><ShieldCheck size={15}/><span>Segurança</span><b>DEFAULT-DENY</b></div><div><Wifi size={15}/><span>Local</span><b>ONLINE</b></div></div>
 <div className="capabilityGrid">{JARVIS_CAPABILITIES.map(c=><article key={c.id} className="capability"><div><strong>{c.name}</strong><small>{c.description}</small></div><span className={"capStatus "+c.status}>{c.status}</span></article>)}</div>
 <div className="jarvisModes"><span><WifiOff size={13}/> Offline: comandos locais</span><span><ShieldCheck size={13}/> Ações externas: aprovação</span></div>
 </section>
}
