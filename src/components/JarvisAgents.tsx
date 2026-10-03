import{Brain,BriefcaseBusiness,Code2,Eye,Globe2,ShieldCheck,Users,Workflow,Zap}from"lucide-react";

const agents=[
 {name:"JARVIS Core",role:"Orquestrador",icon:Brain,desc:"Entende comandos, divide objetivos em tarefas e coordena os demais agentes."},
 {name:"Sentinel",role:"Segurança",icon:ShieldCheck,desc:"Verifica permissões, riscos, aprovações e ações sensíveis antes da execução."},
 {name:"Scout",role:"Pesquisa",icon:Globe2,desc:"Pesquisa web, notícias, empresas, concorrentes e oportunidades."},
 {name:"Builder",role:"Construtor",icon:Code2,desc:"Cria e altera projetos, sites e arquivos dentro dos limites aprovados."},
 {name:"Business",role:"Negócios",icon:BriefcaseBusiness,desc:"Organiza leads, CRM, propostas, follow-ups e oportunidades comerciais."},
 {name:"Analyst",role:"Analista",icon:Workflow,desc:"Cruza dados, encontra padrões, resume informações e prepara decisões."},
 {name:"Vision",role:"Visão",icon:Eye,desc:"Coordena câmeras e recursos visuais locais com privacidade por padrão."},
 {name:"Operator",role:"Computador",icon:Zap,desc:"Executa ações aprovadas no navegador e, futuramente, aplicativos permitidos."}
];

export function JarvisAgents(){
 return <><div className="pagehead"><div><span className="eyebrow">JARVIS MULTI-AGENT</span><h1>Equipe de agentes</h1><p>Vários especialistas trabalhando sob um orquestrador e com aprovação para ações externas.</p></div></div>
 <div className="agentRoster">{agents.map(a=>{const Icon=a.icon;return <article className="agentProfile" key={a.name}><div className="agentAvatar"><Icon size={20}/></div><div><span className="eyebrow">{a.role}</span><h2>{a.name}</h2><p>{a.desc}</p></div><span className="agentState"><i/> PRONTO</span></article>})}</div>
 <section className="panel"><div className="panelhead"><div><span className="eyebrow">FLUXO</span><h2>Como a equipe trabalha</h2></div><Users size={18}/></div><div className="agentFlow"><span>Você</span><b>→</b><span>JARVIS Core</span><b>→</b><span>Especialista</span><b>→</b><span>Sentinel</span><b>→</b><span>Execução</span></div></section>
 </>;
}
