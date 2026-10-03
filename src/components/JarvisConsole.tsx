import { useEffect, useRef, useState } from "react";
import { Activity, ArrowRight, BrainCircuit, CheckCircle2, Command, ExternalLink, Eye, LockKeyhole, Mic, MicOff, Network, Radar, Sparkles, Volume2, VolumeX, Zap } from "lucide-react";
import { parseJarvisCommandWithAI, speak, workerHealth } from "../services/jarvis";
import { discoverUnknown, formatUnknownFinding } from "../services/jarvisUnknown";
import { helpReply } from "../services/jarvisIntent";
import { createActionPlanWithAI, type JarvisActionPlan } from "../services/jarvisActionPlan";
import { multiAgentRuntime } from "../services/agentRuntime";

type Props = {
  go: (path: string) => void;
  addApproval?: (approval: any) => void;
};

export function JarvisConsole({ go, addApproval }: Props) {
  const [listening, setListening] = useState(false);
  const [wake, setWake] = useState(false);
  const [heard, setHeard] = useState("");
  const [reply, setReply] = useState("Sistemas online. Aguardando uma missão.");
  const [voice, setVoice] = useState(true);
  const [worker, setWorker] = useState("standby");
  const [planning, setPlanning] = useState(false);
  const [plan, setPlan] = useState<JarvisActionPlan | null>(null);
  const [command, setCommand] = useState("");
  const recognitionRef = useRef<any>(null);

  const execute = async (input: string) => {
    const value = input.trim();
    if (!value) return;
    setCommand("");
    setHeard(value);
    setPlanning(true);
    setPlan(null);

    const aiPlan = await createActionPlanWithAI(
      value,
      localStorage.getItem("az:executorUrl") || "http://localhost:8787"
    );

    if (aiPlan && aiPlan.confidence >= 0.55) {
      setPlan(aiPlan);
      setPlanning(false);
      let finalReply = aiPlan.summary;

      for (const action of aiPlan.actions) {
        if (action.type === "navigate") {
          go(action.path);
          finalReply = aiPlan.summary;
        } else if (action.type === "worker_health") {
          try {
            const base = localStorage.getItem("az:executorUrl") || "http://localhost:8787";
            const h = await workerHealth(base);
            setWorker(h.status);
            finalReply = "Computador: " + h.status + ". " + aiPlan.summary;
          } catch {
            setWorker("offline");
            finalReply = "O Worker está offline. " + aiPlan.summary;
          }
        } else if (action.type === "delegate") {
          const task = multiAgentRuntime.submit(action.goal);
          finalReply = "Missão delegada ao Multi-Agent Runtime. ID " + task.id.slice(0, 8) + ".";
        } else if (action.type === "open_url" || action.type === "inspect_site") {
          if (addApproval) {
            addApproval({
              id: crypto.randomUUID(),
              type: "execução de navegador",
              title: action.label,
              description: "Plano JARVIS aguardando sua aprovação antes de acessar uma fonte externa.",
              createdAt: new Date().toISOString(),
              status: "pending",
              execution: { type: action.type === "open_url" ? "open_url" : "inspect_site", url: action.url }
            });
          }
          finalReply = "Preparei a ação. Ela está bloqueada até sua aprovação.";
          go("/aprovacoes");
        }
      }

      setReply(finalReply);
      if (voice) speak(finalReply);
      return;
    }

    const actions = await parseJarvisCommandWithAI(value);
    let spokenReply = "Não encontrei um plano confiável para essa missão.";

    for (const action of actions) {
      if (action.type === "navigate") {
        go(action.path);
        spokenReply = "Abrindo " + action.path + ".";
      } else if (action.type === "open_url") {
        spokenReply = "Essa abertura precisa passar pela Central de Aprovações.";
        go("/aprovacoes");
      } else if (action.type === "help") {
        spokenReply = helpReply();
      } else if (action.type === "unknown_discovery") {
        spokenReply = formatUnknownFinding(discoverUnknown());
      } else if (action.type === "worker_health") {
        try {
          const base = localStorage.getItem("az:executorUrl") || "http://localhost:8787";
          const h = await workerHealth(base);
          setWorker(h.status);
          spokenReply = "Worker " + h.status + ".";
        } catch {
          setWorker("offline");
          spokenReply = "O Worker está offline.";
        }
      } else if (action.type === "speak") {
        spokenReply = action.text;
      }
    }

    setPlanning(false);
    setReply(spokenReply);
    if (voice) speak(spokenReply);
  };

  const start = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setReply("Seu navegador não oferece reconhecimento de voz. Use Chrome ou Edge.");
      return;
    }
    if (recognitionRef.current) recognitionRef.current.stop();
    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onstart = () => setListening(true);
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.onresult = (event: any) => {
      const text = Array.from(event.results as any)
        .slice(event.resultIndex)
        .map((r: any) => r[0]?.transcript || "")
        .join(" ")
        .trim();
      if (!text) return;
      const normalized = text.toLowerCase();
      if (normalized.includes("hey jarvis") || normalized.startsWith("jarvis")) {
        setWake(true);
        execute(text);
        window.setTimeout(() => setWake(false), 1800);
      }
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const stop = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    setWake(false);
  };

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const quick = [
    "Me diga o que merece minha atenção hoje",
    "Pesquise oportunidades de negócio",
    "Abra minhas aprovações",
    "JARVIS, me surpreenda",
    "Analise meu sistema e encontre algo estranho",
    "Crie um plano para encontrar empresas sem site"
  ];

  return <div className={"jarvisConsole " + (wake ? "jarvisAwake" : "")}>
    <section className="jarvisInterface">
      <div className="jarvisAtmosphere" />
      <div className="jarvisTelemetry telemetryA"><span>CORE // ONLINE</span><b>99.7%</b></div>
      <div className="jarvisTelemetry telemetryB"><span>SECURITY // DEFAULT DENY</span><b>ARMED</b></div>
      <div className="jarvisTelemetry telemetryC"><span>LOCAL WORKER</span><b>{worker.toUpperCase()}</b></div>

      <div className={"jarvisHalo " + (planning ? "planning" : "")}>
        <div className="jarvisHaloRing ringOne" />
        <div className="jarvisHaloRing ringTwo" />
        <div className="jarvisHaloRing ringThree" />
        <div className="jarvisCoreSphere">
          <Radar size={38} />
          <span>{planning ? "THINKING" : wake ? "LISTENING" : "READY"}</span>
        </div>
      </div>

      <div className="jarvisIdentity">
        <span className="eyebrow">J.A.R.V.I.S. // PERSONAL INTELLIGENCE OS</span>
        <h1>{planning ? "Construindo uma ação." : wake ? "Estou ouvindo." : "O que vamos descobrir?"}</h1>
        <p>Uma interface viva para raciocínio, visão, agentes, memória e controle local — não apenas um chat.</p>
      </div>

      <form className="jarvisCommandBar" onSubmit={e => { e.preventDefault(); execute(command); }}>
        <Command size={17}/>
        <input value={command} onChange={e => setCommand(e.target.value)} placeholder="Diga uma missão ao JARVIS..." />
        <button type="submit" disabled={planning}><ArrowRight size={18}/></button>
      </form>

      <div className="jarvisControls">
        <button className="primary" onClick={listening ? stop : start}>
          {listening ? <MicOff size={16}/> : <Mic size={16}/>} {listening ? "Desativar escuta" : "Hey Jarvis"}
        </button>
        <button className="ghost" onClick={() => { setVoice(!voice); if (voice) window.speechSynthesis?.cancel(); }}>
          {voice ? <Volume2 size={16}/> : <VolumeX size={16}/>} Voz {voice ? "ON" : "OFF"}
        </button>
        <button className="ghost" onClick={() => execute("JARVIS, me surpreenda")}><Sparkles size={16}/> UNKNOWN</button>
      </div>
    </section>

    <div className="jarvisStatusStrip">
      <div><BrainCircuit size={15}/><span>REASONING</span><b>AI ACTION PLANNER</b></div>
      <div><Network size={15}/><span>AGENTS</span><b>MULTI-AGENT RUNTIME</b></div>
      <div><LockKeyhole size={15}/><span>GUARD</span><b>APPROVAL GATE</b></div>
      <div><Eye size={15}/><span>VISION</span><b>LOCAL-FIRST</b></div>
    </div>

    {plan && <section className="jarvisPlan">
      <div className="jarvisPlanHeader">
        <div><span className="eyebrow">ACTION PLAN // {Math.round(plan.confidence * 100)}% CONFIDENCE</span><h2>{plan.summary}</h2></div>
        <span className={plan.requiresApproval ? "planBadge approval" : "planBadge"}>{plan.requiresApproval ? "APPROVAL REQUIRED" : "READY"}</span>
      </div>
      <p className="jarvisReason">{plan.reason || "O plano foi montado a partir do significado do seu pedido."}</p>
      <div className="jarvisPlanSteps">
        {plan.actions.map((action, index) => <div className="jarvisPlanStep" key={index}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <div><b>{action.label}</b><small>{action.type.replace("_", " ")}</small></div>
          <CheckCircle2 size={16}/>
        </div>)}
      </div>
    </section>}

    <div className="jarvisLowerGrid">
      <section className="panel jarvisReadout">
        <span className="eyebrow">NEURAL READOUT</span>
        <h2>{heard || "Nenhuma missão registrada"}</h2>
        <p>{reply}</p>
        <div className="readoutMeta"><Activity size={13}/> <span>SESSION ACTIVE</span><i/> <span>LOCAL MEMORY</span></div>
      </section>
      <section className="panel jarvisQuick">
        <div className="panelhead"><div><span className="eyebrow">NATURAL MISSIONS</span><h2>Você não precisa decorar comandos</h2></div><Zap size={17}/></div>
        {quick.map(x => <button className="jarvisQuickRow" key={x} onClick={() => execute(x)}><span>{x}</span><ExternalLink size={14}/></button>)}
      </section>
    </div>
  </div>;
}
