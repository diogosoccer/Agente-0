import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Volume2, VolumeX, Activity, ExternalLink } from "lucide-react";
import { parseJarvisCommand, speak, workerHealth } from "../services/jarvis";

type Props = { go: (path: string) => void };

export function JarvisConsole({ go }: Props) {
  const [listening, setListening] = useState(false);
  const [wake, setWake] = useState(false);
  const [heard, setHeard] = useState("");
  const [reply, setReply] = useState("Pronto. Diga “Hey Jarvis” ou escreva um comando.");
  const [voice, setVoice] = useState(true);
  const [worker, setWorker] = useState("não verificado");
  const recognitionRef = useRef<any>(null);

  const execute = async (input: string) => {
    setHeard(input);
    const actions = parseJarvisCommand(input);
    for (const action of actions) {
      if (action.type === "navigate") {
        go(action.path);
        setReply("Abrindo " + action.path + ".");
      } else if (action.type === "open_url") {
        setReply("Solicitando abertura de " + action.url);
        try {
          const base = localStorage.getItem("az:executorUrl") || "http://localhost:8787";
          const r = await fetch(base.replace(/\/$/, "") + "/open", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: action.url, approved: true }),
          });
          if (!r.ok) throw new Error("Falha ao abrir");
          setReply("Página aberta.");
        } catch {
          window.open(action.url, "_blank", "noopener,noreferrer");
          setReply("Abri a página no navegador.");
        }
      } else if (action.type === "worker_health") {
        try {
          const base = localStorage.getItem("az:executorUrl") || "http://localhost:8787";
          const h = await workerHealth(base);
          setWorker(h.status);
          setReply("Worker " + h.status + ".");
        } catch {
          setWorker("offline");
          setReply("O Worker está offline.");
        }
      } else if (action.type === "speak") {
        setReply(action.text);
      }
    }
    if (voice) speak(actions[actions.length - 1].type === "speak" ? actions[actions.length - 1].text : (actions[actions.length - 1].type === "navigate" ? "Abrindo." : reply));
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

  return <div className="jarvisConsole">
    <section className={"jarvisCore " + (wake ? "wake" : "")}>
      <div className="jarvisOrb"><Activity size={42} /></div>
      <span className="eyebrow">J.A.R.V.I.S. / DESKTOP CONTROL</span>
      <h1>{wake ? "Estou ouvindo." : "Central de comando"}</h1>
      <p>Comandos locais, voz e conexão com o Browser Worker.</p>
      <div className="jarvisActions">
        <button className="primary" onClick={listening ? stop : start}>{listening ? <MicOff size={17}/> : <Mic size={17}/>} {listening ? "Parar escuta" : "Ativar escuta"}</button>
        <button className="ghost" onClick={() => { setVoice(!voice); if (voice) window.speechSynthesis?.cancel(); }} >{voice ? <Volume2 size={17}/> : <VolumeX size={17}/>} Voz {voice ? "ligada" : "desligada"}</button>
      </div>
    </section>
    <div className="jarvisGrid">
      <section className="panel"><span className="eyebrow">ÚLTIMO COMANDO</span><h2>{heard || "—"}</h2><p>{reply}</p></section>
      <section className="panel"><span className="eyebrow">COMPUTADOR</span><h2>Worker: {worker}</h2><button className="ghost" onClick={async()=>{try{const base=localStorage.getItem("az:executorUrl")||"http://localhost:8787";const h=await workerHealth(base);setWorker(h.status);setReply("Worker " + h.status + ".");}catch{setWorker("offline");setReply("Worker offline.");}}}>Testar conexão</button></section>
    </div>
    <section className="panel">
      <span className="eyebrow">EXEMPLOS</span>
      <div className="cards">
        {["Abra o dashboard","Mostre minhas oportunidades","Abra o CRM","Mostre o financeiro","Mostre a memória","Qual o status do computador?"].map(x=><button className="miniCard" key={x} onClick={()=>execute(x)}><b>{x}</b><ExternalLink size={15}/></button>)}
      </div>
    </section>
  </div>;
}
